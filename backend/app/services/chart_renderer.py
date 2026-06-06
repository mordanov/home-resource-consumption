import io

import matplotlib
import matplotlib.pyplot as plt
from matplotlib.figure import Figure

matplotlib.use("Agg")

from app.domain.schemas import MonthlyDataPoint


class ChartRenderer:
    def render_consumption_trend(self, data: list[MonthlyDataPoint]) -> str:
        fig, ax = plt.subplots(figsize=(8, 4))
        by_type: dict[str, list[tuple[str, float]]] = {}
        for point in data:
            by_type.setdefault(point.resource_type.value, []).append(
                (point.month, float(point.value))
            )
        for rt, points in by_type.items():
            months = [p[0] for p in points]
            values = [p[1] for p in points]
            ax.plot(months, values, marker="o", label=rt)
        ax.set_title("Monthly Consumption Trend")
        ax.set_xlabel("Month")
        ax.set_ylabel("Consumption")
        ax.legend()
        plt.xticks(rotation=45)
        plt.tight_layout()
        return self._to_svg(fig)

    def render_monthly_cost(self, data: list[MonthlyDataPoint]) -> str:
        fig, ax = plt.subplots(figsize=(8, 4))
        months_set: list[str] = sorted({p.month for p in data})
        by_type: dict[str, dict[str, float]] = {}
        for point in data:
            by_type.setdefault(point.resource_type.value, {})[point.month] = float(point.value)
        bottom = [0.0] * len(months_set)
        for rt, month_map in by_type.items():
            values = [month_map.get(m, 0.0) for m in months_set]
            ax.bar(months_set, values, bottom=bottom, label=rt)
            bottom = [b + v for b, v in zip(bottom, values, strict=True)]
        ax.set_title("Monthly Cost")
        ax.set_xlabel("Month")
        ax.set_ylabel("Cost")
        ax.legend()
        plt.xticks(rotation=45)
        plt.tight_layout()
        return self._to_svg(fig)

    def _to_svg(self, fig: Figure) -> str:
        buf = io.StringIO()
        fig.savefig(buf, format="svg")
        plt.close(fig)
        return buf.getvalue()
