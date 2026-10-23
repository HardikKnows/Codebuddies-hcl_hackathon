from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.api.deps import Ctx, require_permission
from app.core.errors import AppError
from app.core.permissions import Permission
from app.db.session import get_db
from app.models.enums import AuditOutcome, Availability
from app.schemas.imports import ImportReport
from app.services import audit, catalog_import, exports, inventory_import
from app.services.csv_files import MAX_UPLOAD_BYTES, read_upload

router = APIRouter(tags=["import-export"])


def _read(file: UploadFile) -> tuple[str, str]:
    filename = (file.filename or "upload.csv")[:200]
    return filename, read_upload(filename, file.file.read(MAX_UPLOAD_BYTES + 1))


def _audited_apply(action: str, ctx: Ctx, file: UploadFile, run):
    """Apply an import; file-level rejections are audited as failed attempts too."""
    try:
        filename, text = _read(file)
        return run(filename, text)
    except AppError as exc:
        if exc.code != "IMPORT_FAILED":  # the services audit their own database failures
            audit.record(action=action, outcome=AuditOutcome.FAILED, actor=ctx.user, request_id=ctx.request_id,
                         details={"filename": file.filename, "code": exc.code, "message": exc.message})
        raise


@router.post("/ops/imports/products/preview", response_model=ImportReport)
def preview_product_import(
    file: UploadFile = File(...),
    update_existing: bool = Form(False, alias="updateExisting"),
    ctx: Ctx = Depends(require_permission(Permission.CATALOG_IMPORT)),
    db: Session = Depends(get_db),
):
    """Validates every row against the database and reports what would happen. Changes nothing."""
    filename, text = _read(file)
    planned = catalog_import.analyze(db, text, update_existing=update_existing)
    return catalog_import.report(filename, planned, applied=False, update_existing=update_existing)


@router.post("/ops/imports/products", response_model=ImportReport)
def apply_product_import(
    file: UploadFile = File(...),
    update_existing: bool = Form(False, alias="updateExisting"),
    ctx: Ctx = Depends(require_permission(Permission.CATALOG_IMPORT)),
    db: Session = Depends(get_db),
):
    return _audited_apply("catalog.import", ctx, file, lambda filename, text: catalog_import.apply(
        db, ctx.user, filename, text, update_existing=update_existing, request_id=ctx.request_id))


@router.post("/ops/imports/inventory/preview", response_model=ImportReport)
def preview_inventory_import(
    file: UploadFile = File(...),
    ctx: Ctx = Depends(require_permission(Permission.INVENTORY_ADJUST)),
    db: Session = Depends(get_db),
):
    filename, text = _read(file)
    return inventory_import.report(filename, inventory_import.analyze(db, ctx.user, text), applied=False)


@router.post("/ops/imports/inventory", response_model=ImportReport)
def apply_inventory_import(
    file: UploadFile = File(...),
    ctx: Ctx = Depends(require_permission(Permission.INVENTORY_ADJUST)),
    db: Session = Depends(get_db),
):
    return _audited_apply("inventory.import", ctx, file, lambda filename, text: inventory_import.apply(
        db, ctx.user, filename, text, request_id=ctx.request_id))


def _csv_response(content: bytes, filename: str) -> Response:
    return Response(
        content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"', "Cache-Control": "no-store"},
    )


@router.get("/ops/exports/catalog.csv")
def export_catalog(ctx: Ctx = Depends(require_permission(Permission.INVENTORY_VIEW)), db: Session = Depends(get_db)):
    content, count, filename = exports.catalog_csv(db)
    audit.record(action="export.catalog", outcome=AuditOutcome.SUCCESS, actor=ctx.user, entity_type="catalog",
                 request_id=ctx.request_id, details={"rows": count, "filename": filename})
    return _csv_response(content, filename)


@router.get("/ops/exports/inventory.csv")
def export_inventory(
    store_id: int | None = Query(None, alias="storeId"),
    status: Availability | None = None,
    q: str | None = Query(None, max_length=100),
    ctx: Ctx = Depends(require_permission(Permission.INVENTORY_VIEW)),
    db: Session = Depends(get_db),
):
    """Exports the dashboard's current filters. Store managers and staff only ever get their own store."""
    try:
        scoped_store = exports.export_store_scope(ctx.user, store_id)
        content, count, filename = exports.inventory_csv(db, store_id=scoped_store, status=status, q=q)
    except AppError as exc:
        audit.record(action="export.inventory", outcome=AuditOutcome.DENIED if exc.status_code == 403 else AuditOutcome.FAILED,
                     actor=ctx.user, entity_type="store", entity_id=store_id, request_id=ctx.request_id,
                     details={"requestedStoreId": store_id, "code": exc.code, "message": exc.message})
        raise
    audit.record(action="export.inventory", outcome=AuditOutcome.SUCCESS, actor=ctx.user, entity_type="store",
                 entity_id=scoped_store or "ALL", request_id=ctx.request_id,
                 details={"storeId": scoped_store, "status": status, "q": q, "rows": count, "filename": filename})
    return _csv_response(content, filename)
