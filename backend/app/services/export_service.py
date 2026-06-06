from dataclasses import dataclass
from datetime import date
from uuid import UUID

from jinja2 import Environment, PackageLoader, select_autoescape

from app.core.exceptions import DateRangeExceededError
from app.domain.enums import ResourceType
from app.services.analytics_service import AnalyticsService
from app.services.chart_renderer import ChartRenderer

MAX_MONTHS = 24


@dataclass
class ReportSpec:
    user_id: UUID
    date_from: date
    date_to: date
    resource_types: list[ResourceType]


class ExportService:
    def __init__(self, analytics: AnalyticsService, chart_renderer: ChartRenderer) -> None:
        self.analytics = analytics
        self.chart_renderer = chart_renderer

    async def generate(self, spec: ReportSpec) -> bytes:
        self._validate_date_range(spec.date_from, spec.date_to)
        resource_type = spec.resource_types[0] if len(spec.resource_types) == 1 else None
        summary = await self.analytics.get_summary(
            spec.user_id, spec.date_from, spec.date_to, resource_type
        )
        consumption_svg = self.chart_renderer.render_consumption_trend(summary.monthly_consumption)
        cost_svg = self.chart_renderer.render_monthly_cost(summary.monthly_cost)
        html_content = self._render_template(spec, summary, consumption_svg, cost_svg)
        from weasyprint import HTML  # lazy import — libgobject only available in Docker

        result: bytes = HTML(string=html_content).write_pdf()
        return result

    def _validate_date_range(self, date_from: date, date_to: date) -> None:
        months = (date_to.year - date_from.year) * 12 + (date_to.month - date_from.month)
        if months > MAX_MONTHS:
            raise DateRangeExceededError(MAX_MONTHS)

    def _render_template(
        self, spec: ReportSpec, summary: object, consumption_svg: str, cost_svg: str
    ) -> str:
        env = Environment(
            loader=PackageLoader("app", "templates"),
            autoescape=select_autoescape(["html"]),
        )
        template = env.get_template("report.html")
        return template.render(
            spec=spec,
            summary=summary,
            consumption_svg=consumption_svg,
            cost_svg=cost_svg,
        )
