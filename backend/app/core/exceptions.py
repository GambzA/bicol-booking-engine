from fastapi import Request
from fastapi.responses import JSONResponse


class AppError(Exception):
    status_code: int = 500
    code: str = "INTERNAL_ERROR"
    message: str = "An unexpected error occurred."

    def __init__(self, message: str | None = None):
        self.message = message or self.__class__.message


class NotFoundError(AppError):
    status_code = 404
    code = "NOT_FOUND"
    message = "Resource not found."


class ForbiddenError(AppError):
    status_code = 403
    code = "FORBIDDEN"
    message = "Access denied."


class UnauthorizedError(AppError):
    status_code = 401
    code = "UNAUTHORIZED"
    message = "Authentication required."


class ConflictError(AppError):
    status_code = 409
    code = "CONFLICT"
    message = "Resource already exists."


class ValidationError(AppError):
    status_code = 422
    code = "VALIDATION_ERROR"
    message = "Validation failed."


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.code, "message": exc.message, "details": None}},
    )
