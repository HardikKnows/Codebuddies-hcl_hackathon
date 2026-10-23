from typing import Any


class AppError(Exception):
    """An expected failure that maps to an HTTP status and the shared error envelope."""

    def __init__(self, status_code: int, code: str, message: str, details: dict[str, Any] | None = None):
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details or {}


def bad_request(code: str, message: str, **details: Any) -> AppError:
    return AppError(400, code, message, details)


def unauthorized(message: str = "Please sign in to continue.") -> AppError:
    return AppError(401, "UNAUTHORIZED", message)


def forbidden(message: str = "You do not have permission to perform this action.", **details: Any) -> AppError:
    return AppError(403, "FORBIDDEN", message, details)


def not_found(message: str, **details: Any) -> AppError:
    return AppError(404, "NOT_FOUND", message, details)


def conflict(code: str, message: str, **details: Any) -> AppError:
    return AppError(409, code, message, details)
