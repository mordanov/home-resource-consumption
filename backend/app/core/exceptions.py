class ResourceNotFoundError(Exception):
    def __init__(self, resource: str = "Resource", resource_id: str = "") -> None:
        self.resource = resource
        self.resource_id = resource_id
        super().__init__(f"{resource} not found: {resource_id}")


class ConflictError(Exception):
    def __init__(self, detail: str = "Conflict") -> None:
        self.detail = detail
        super().__init__(detail)


class UnauthorizedError(Exception):
    def __init__(self, detail: str = "Unauthorized") -> None:
        self.detail = detail
        super().__init__(detail)


class ForbiddenError(Exception):
    def __init__(self, detail: str = "Forbidden") -> None:
        self.detail = detail
        super().__init__(detail)


class InsufficientDataError(Exception):
    def __init__(self, needed: int, have: int) -> None:
        self.needed = needed
        self.have = have
        self.bills_needed = needed - have
        super().__init__(f"Need {needed} bills, have {have}")


class FileTooLargeError(Exception):
    def __init__(self, max_mb: int) -> None:
        self.max_mb = max_mb
        super().__init__(f"File exceeds maximum size of {max_mb} MB")


class ParseError(Exception):
    def __init__(self, detail: str = "Failed to parse bill") -> None:
        self.detail = detail
        super().__init__(detail)


class DateRangeExceededError(Exception):
    def __init__(self, max_months: int = 24) -> None:
        self.max_months = max_months
        super().__init__(f"Date range exceeds {max_months} months maximum")
