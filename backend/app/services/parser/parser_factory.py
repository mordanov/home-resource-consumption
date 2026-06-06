from app.domain.enums import ResourceType
from app.services.parser.base_parser import BaseParser
from app.services.parser.llm_parser import LLMParserService


class ParserFactory:
    def get(self, resource_type: ResourceType) -> BaseParser:
        return LLMParserService()
