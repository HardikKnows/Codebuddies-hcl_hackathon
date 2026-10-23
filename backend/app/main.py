import logging
import uuid

from fastapi import APIRouter, FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic.alias_generators import to_camel
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.routes import assistant, auth, catalog, data, health, ops, orders, tickets
from app.core.config import get_settings
from app.core.errors import AppError

logger = logging.getLogger("retailpulse")
settings = get_settings()
if not settings.jwt_secret:
    raise RuntimeError("JWT_SECRET is not set. Copy backend/.env.example to backend/.env and set a long random value.")

app = FastAPI(title="RetailPulse AI API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "Content-Disposition"],
)


@app.middleware("http")
async def assign_request_id(request: Request, call_next):
    request.state.request_id = request.headers.get("X-Request-ID") or uuid.uuid4().hex[:16]
    response = await call_next(request)
    response.headers["X-Request-ID"] = request.state.request_id
    return response


def _error(request: Request, status: int, code: str, message: str, details: dict | None = None) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={
            "error": {
                "code": code,
                "message": message,
                "details": details or {},
                "requestId": getattr(request.state, "request_id", None),
            }
        },
    )


@app.exception_handler(AppError)
async def handle_app_error(request: Request, exc: AppError):
    details = {to_camel(key): value for key, value in exc.details.items()}
    return _error(request, exc.status_code, exc.code, exc.message, jsonable_encoder(details))


@app.exception_handler(RequestValidationError)
async def handle_validation_error(request: Request, exc: RequestValidationError):
    errors = jsonable_encoder(exc.errors(), exclude={"ctx", "url", "input"})
    first = errors[0] if errors else {}
    field = ".".join(str(part) for part in first.get("loc", []) if part not in ("body", "query", "path"))
    message = f"{field}: {first.get('msg')}" if field else first.get("msg", "Invalid request.")
    return _error(request, 422, "VALIDATION_ERROR", message, {"errors": errors})


@app.exception_handler(StarletteHTTPException)
async def handle_http_error(request: Request, exc: StarletteHTTPException):
    code = "NOT_FOUND" if exc.status_code == 404 else "HTTP_ERROR"
    return _error(request, exc.status_code, code, str(exc.detail))


@app.exception_handler(Exception)
async def handle_unexpected_error(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return _error(request, 500, "INTERNAL_ERROR", "Something went wrong. Please try again.")


api = APIRouter(prefix="/api")
for module in (health, auth, catalog, orders, tickets, ops, data, assistant):
    api.include_router(module.router)
app.include_router(api)
