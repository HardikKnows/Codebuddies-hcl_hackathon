"""Product catalog CSV import. Preview and apply run the same validation; apply always re-validates the file."""

import json
import math
import re
from dataclasses import dataclass, field
from decimal import Decimal
from urllib.parse import urlparse

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, joinedload

from app.core.errors import AppError
from app.models import Brand, Category, Product, User
from app.models.enums import AuditOutcome
from app.schemas.imports import ImportReport, ImportRowOut
from app.services import audit
from app.services.csv_files import parse_csv

REQUIRED = {"sku", "name", "brand", "category", "price"}
OPTIONAL = {"description", "image_url", "specifications"}
ALIASES = {"product_id": "sku", "product_name": "name", "image": "image_url", "specs": "specifications"}
EXPORT_COLUMNS = ["sku", "name", "brand", "category", "description", "price", "image_url", "specifications"]

SKU_RE = re.compile(r"^[A-Z0-9][A-Z0-9-]{1,19}$")
PRICE_RE = re.compile(r"^\d{1,8}(\.\d{1,2})?$")
SPEC_KEY_RE = re.compile(r"^[a-z][a-z0-9_]{0,39}$")
MAX_SPECS = 30


def coerce_spec_value(value: str):
    if value.lower() in ("yes", "no"):
        return value.lower() == "yes"
    if re.fullmatch(r"-?\d{1,15}", value):
        return int(value)
    if re.fullmatch(r"-?\d{1,15}\.\d{1,6}", value):
        return float(value)
    return value


def parse_spec_pairs(raw: str) -> dict:
    """'ram_gb=16;cpu=Intel Core i7' -> {'ram_gb': 16, 'cpu': 'Intel Core i7'} (trusted seed data)."""
    specs = {}
    for pair in raw.split(";"):
        key, _, value = pair.partition("=")
        if key.strip():
            specs[key.strip()] = coerce_spec_value(value.strip())
    return specs


def parse_specifications(raw: str) -> tuple[dict | None, str | None]:
    """Validated parsing for uploads: key=value pairs separated by ';', or a JSON object of simple values."""
    raw = raw.strip()
    if not raw:
        return {}, None
    if raw.startswith("{"):
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            return None, "Specifications JSON is not valid."
        if not isinstance(data, dict):
            return None, "Specifications JSON must be an object."
        items = list(data.items())
    else:
        items = []
        for pair in raw.split(";"):
            if not pair.strip():
                continue
            key, sep, value = pair.partition("=")
            if not sep:
                return None, f"Specification '{pair.strip()[:40]}' is not in key=value form."
            items.append((key, coerce_spec_value(value.strip())))
    if len(items) > MAX_SPECS:
        return None, f"At most {MAX_SPECS} specifications are allowed."
    specs = {}
    for key, value in items:
        key = str(key).strip().lower().replace(" ", "_")
        if not SPEC_KEY_RE.match(key):
            return None, f"Specification name '{key[:40]}' may only use letters, digits and underscores."
        simple = isinstance(value, bool) or (isinstance(value, (int, float)) and math.isfinite(value))
        if not simple and not (isinstance(value, str) and len(value) <= 200):
            return None, f"Specification '{key}' must be text (up to 200 characters), a number or yes/no."
        specs[key] = value
    return specs, None


def format_specifications(specs: dict) -> str:
    """The import format: key=value pairs, or JSON when a key or value contains ';' or '='."""
    def text(value):
        return ("yes" if value else "no") if isinstance(value, bool) else str(value)

    if any(";" in f"{k}{text(v)}" or "=" in f"{k}{text(v)}" for k, v in specs.items()):
        return json.dumps(specs, ensure_ascii=False)
    return ";".join(f"{k}={text(v)}" for k, v in specs.items())


def _valid_image_url(value: str) -> bool:
    parsed = urlparse(value)
    return len(value) <= 500 and parsed.scheme in ("http", "https") and bool(parsed.netloc) and " " not in value


@dataclass
class PlannedRow:
    out: ImportRowOut
    values: dict = field(default_factory=dict)
    product: Product | None = None


def _validate(values: dict, categories: dict[str, Category]) -> tuple[dict, list[str]]:
    errors: list[str] = []
    clean: dict = {}

    sku = values.get("sku", "").upper()
    if not sku:
        errors.append("SKU is required.")
    elif not SKU_RE.match(sku):
        errors.append("SKU must be 2-20 characters: letters, digits or hyphens.")
    clean["sku"] = sku

    for key, label, limit in (("name", "Product name", 160), ("brand", "Brand", 80)):
        value = values.get(key, "")
        if not value:
            errors.append(f"{label} is required.")
        elif len(value) > limit:
            errors.append(f"{label} must be at most {limit} characters.")
        clean[key] = value

    category_text = values.get("category", "")
    clean["category"] = categories.get(category_text.lower())
    if not category_text:
        errors.append("Category is required.")
    elif clean["category"] is None:
        errors.append(f"Unknown category '{category_text[:60]}'. Use an existing category name or slug.")

    price_text = values.get("price", "").replace(",", "").replace("₹", "").strip()
    if not price_text:
        errors.append("Price is required.")
    elif not PRICE_RE.match(price_text) or Decimal(price_text) <= 0:
        errors.append(f"Invalid price '{values.get('price', '')[:20]}': use a number greater than 0 with up to 2 decimals.")
    else:
        clean["price"] = Decimal(price_text)

    clean["description"] = values.get("description", "")
    if len(clean["description"]) > 2000:
        errors.append("Description must be at most 2000 characters.")

    clean["image_url"] = values.get("image_url", "")
    if clean["image_url"] and not _valid_image_url(clean["image_url"]):
        errors.append("Image URL must be an http(s) address of at most 500 characters.")

    raw_specs = values.get("specifications", "")
    specs, spec_error = parse_specifications(raw_specs)
    if spec_error:
        errors.append(spec_error)
    clean["specifications"] = specs or {}
    clean["has_specifications"] = bool(raw_specs.strip())
    return clean, errors


def _changes(product: Product, clean: dict) -> dict:
    """What an update would change. Blank optional cells keep the current value (e.g. an existing image)."""
    changes = {}
    pairs = [
        ("name", product.name, clean["name"]),
        ("brand", product.brand.name, clean["brand"]),
        ("category", product.category.name, clean["category"].name),
        ("price", float(product.price), float(clean["price"])),
    ]
    if clean["description"]:
        pairs.append(("description", product.description, clean["description"]))
    if clean["image_url"]:
        pairs.append(("imageUrl", product.image_url, clean["image_url"]))
    if clean["has_specifications"]:
        pairs.append(("specifications", product.specifications, clean["specifications"]))
    for name, current, new in pairs:
        same = current.lower() == new.lower() if name == "brand" else current == new
        if not same:
            changes[name] = [current, new]
    return changes


def analyze(db: Session, text: str, *, update_existing: bool) -> list[PlannedRow]:
    _, rows = parse_csv(text, required=REQUIRED, optional=OPTIONAL, aliases=ALIASES)
    categories: dict[str, Category] = {}
    for category in db.scalars(select(Category)):
        categories[category.slug.lower()] = category
        categories[category.name.lower()] = category
    brand_names = {name.lower() for name in db.scalars(select(Brand.name))}
    skus = {r.values.get("sku", "").upper() for r in rows if not r.error}
    existing = {
        p.sku: p
        for p in db.scalars(
            select(Product).options(joinedload(Product.brand), joinedload(Product.category)).where(Product.sku.in_(skus))
        )
    }

    seen: dict[str, int] = {}
    planned: list[PlannedRow] = []
    for r in rows:
        if r.error:
            planned.append(PlannedRow(ImportRowOut(row=r.number, sku=None, action="reject", errors=[r.error])))
            continue
        clean, errors = _validate(r.values, categories)
        sku = clean["sku"]
        if sku and sku in seen:
            errors.append(f"Duplicate SKU in this file (first seen on row {seen[sku]}).")
        elif sku:
            seen[sku] = r.number

        product, notes, changes = existing.get(sku), [], None
        if errors:
            action = "reject"
        elif product is None:
            action = "insert"
            if clean["brand"].lower() not in brand_names:
                notes.append(f"New brand '{clean['brand']}' will be created.")
            notes.append("No stock is created; add stock per store separately.")
        elif not update_existing:
            action = "skip"
            notes.append("A product with this SKU already exists. Turn on 'Update existing products' to change it.")
        else:
            changes = _changes(product, clean)
            action = "update" if changes else "skip"
            if not changes:
                notes.append("Already up to date.")
        planned.append(
            PlannedRow(
                ImportRowOut(row=r.number, sku=sku or None, name=clean["name"] or None, action=action, errors=errors,
                             notes=notes, changes=changes),
                clean,
                product,
            )
        )
    return planned


def report(filename: str, planned: list[PlannedRow], *, applied: bool, update_existing: bool) -> ImportReport:
    count = lambda action: sum(1 for p in planned if p.out.action == action)  # noqa: E731
    return ImportReport(
        kind="products", filename=filename, applied=applied, update_existing=update_existing, total_rows=len(planned),
        inserted=count("insert"), updated=count("update"), skipped=count("skip"), rejected=count("reject"),
        rows=[p.out for p in planned],
    )


def apply(db: Session, user: User, filename: str, text: str, *, update_existing: bool, request_id: str | None) -> ImportReport:
    planned = analyze(db, text, update_existing=update_existing)  # never trust an earlier preview
    brands = {b.name.lower(): b for b in db.scalars(select(Brand))}

    def brand_for(name: str) -> Brand:
        if name.lower() not in brands:
            brands[name.lower()] = Brand(name=name)
            db.add(brands[name.lower()])
        return brands[name.lower()]

    try:
        for item in planned:
            c = item.values
            if item.out.action == "insert":
                db.add(Product(
                    sku=c["sku"], name=c["name"], description=c["description"], category_id=c["category"].id,
                    brand=brand_for(c["brand"]), price=c["price"], specifications=c["specifications"],
                    image_url=c["image_url"] or None,
                ))
            elif item.out.action == "update":
                product = item.product
                product.name, product.price, product.category_id = c["name"], c["price"], c["category"].id
                product.brand = brand_for(c["brand"])
                if c["description"]:
                    product.description = c["description"]
                if c["image_url"]:  # a blank cell never removes an existing image
                    product.image_url = c["image_url"]
                if c["has_specifications"]:
                    product.specifications = c["specifications"]
        db.commit()
    except SQLAlchemyError as exc:
        db.rollback()
        audit.record(action="catalog.import", outcome=AuditOutcome.FAILED, actor=user, entity_type="catalog",
                     entity_id=filename[:64], request_id=request_id,
                     details={"filename": filename, "error": exc.__class__.__name__})
        raise AppError(409, "IMPORT_FAILED", "The import could not be saved, so nothing was changed. "
                       "Another change may have conflicted; preview the file again and retry.")

    result = report(filename, planned, applied=True, update_existing=update_existing)
    audit.record(
        action="catalog.import", outcome=AuditOutcome.SUCCESS, actor=user, entity_type="catalog", entity_id=filename[:64],
        request_id=request_id,
        details={
            "filename": filename, "updateExisting": update_existing, "inserted": result.inserted,
            "updated": result.updated, "skipped": result.skipped, "rejected": result.rejected,
            "insertedSkus": [p.out.sku for p in planned if p.out.action == "insert"][:100],
            "updatedSkus": [p.out.sku for p in planned if p.out.action == "update"][:100],
            "rejectedRows": [{"row": p.out.row, "sku": p.out.sku, "errors": p.out.errors}
                             for p in planned if p.out.action == "reject"][:50],
        },
    )
    return result
