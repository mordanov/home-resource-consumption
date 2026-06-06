from abc import ABC, abstractmethod

from app.domain.schemas import BillPreview


class BaseParser(ABC):
    @abstractmethod
    async def parse(self, text: str) -> BillPreview:
        """Parse extracted bill text and return structured BillPreview."""
