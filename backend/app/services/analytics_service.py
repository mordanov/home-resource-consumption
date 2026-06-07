from datetime import date
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import TextClause, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.enums import ResourceType
from app.domain.schemas import (
    AnalyticsSummary,
    CumulativeCostPoint,
    MonthlyDataPoint,
    MonthlyYoYPoint,
    YearOverYearPoint,
)

# Days in the calendar month the bill_date falls in.
_MONTH_DAYS = (
    "DATE_PART('day',"
    " DATE_TRUNC('month', bill_date) + INTERVAL '1 month'"
    " - DATE_TRUNC('month', bill_date))"
)

_RT_FILTER = "AND resource_type = :resource_type"


class AnalyticsService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_summary(
        self,
        user_id: UUID,
        date_from: date,
        date_to: date,
        resource_type: ResourceType | None = None,
    ) -> AnalyticsSummary:
        params: dict[str, object] = {
            "user_id": str(user_id),
            "date_from": date_from,
            "date_to": date_to,
        }
        rt_clause = _RT_FILTER if resource_type else ""
        if resource_type:
            params["resource_type"] = resource_type.value

        daily_consumption = await self._daily_consumption(params, rt_clause)
        monthly_cost = await self._monthly_cost(params, rt_clause)
        price_per_unit = await self._price_per_unit(params, rt_clause)
        year_over_year = await self._year_over_year(params, rt_clause)
        cumulative = await self._cumulative_cost_ytd(params, rt_clause)
        monthly_yoy = await self._monthly_yoy(params, rt_clause)
        return AnalyticsSummary(
            daily_consumption=daily_consumption,
            monthly_cost=monthly_cost,
            price_per_unit=price_per_unit,
            year_over_year=year_over_year,
            cumulative_cost_ytd=cumulative,
            monthly_yoy=monthly_yoy,
        )

    async def _daily_consumption(
        self, params: dict[str, object], rt_clause: str
    ) -> list[MonthlyDataPoint]:
        """Average consumption per calendar day within each month."""
        sql = text(
            "SELECT to_char(date_trunc('month', bill_date), 'YYYY-MM') AS month,"
            " resource_type,"
            " SUM(amount_consumed) / " + _MONTH_DAYS + " AS value"
            " FROM bills"
            " WHERE user_id = :user_id"
            " AND deleted_at IS NULL"
            " AND bill_date BETWEEN :date_from AND :date_to"
            " " + rt_clause + " GROUP BY 1, 2, date_trunc('month', bill_date)"
            " ORDER BY 1, 2"
        )
        rows = (await self.db.execute(sql, params)).fetchall()
        return [
            MonthlyDataPoint(
                month=r.month,
                resource_type=ResourceType(r.resource_type),
                value=Decimal(str(round(float(r.value), 4))),
            )
            for r in rows
        ]

    async def _monthly_cost(
        self, params: dict[str, object], rt_clause: str
    ) -> list[MonthlyDataPoint]:
        sql = text(
            "SELECT to_char(date_trunc('month', bill_date), 'YYYY-MM') AS month,"
            " resource_type,"
            " SUM(amount_paid) AS value"
            " FROM bills"
            " WHERE user_id = :user_id"
            " AND deleted_at IS NULL"
            " AND bill_date BETWEEN :date_from AND :date_to"
            " " + rt_clause + " GROUP BY 1, 2"
            " ORDER BY 1, 2"
        )
        rows = (await self.db.execute(sql, params)).fetchall()
        return [
            MonthlyDataPoint(
                month=r.month,
                resource_type=ResourceType(r.resource_type),
                value=Decimal(str(r.value)),
            )
            for r in rows
        ]

    async def _price_per_unit(
        self, params: dict[str, object], rt_clause: str
    ) -> list[MonthlyDataPoint]:
        sql = text(
            "SELECT to_char(date_trunc('month', bill_date), 'YYYY-MM') AS month,"
            " resource_type,"
            " CASE WHEN SUM(amount_consumed) > 0"
            " THEN SUM(amount_paid) / SUM(amount_consumed)"
            " ELSE 0 END AS value"
            " FROM bills"
            " WHERE user_id = :user_id"
            " AND deleted_at IS NULL"
            " AND bill_date BETWEEN :date_from AND :date_to"
            " " + rt_clause + " GROUP BY 1, 2"
            " ORDER BY 1, 2"
        )
        rows = (await self.db.execute(sql, params)).fetchall()
        return [
            MonthlyDataPoint(
                month=r.month,
                resource_type=ResourceType(r.resource_type),
                value=Decimal(str(round(float(r.value), 4))),
            )
            for r in rows
        ]

    def _build_yoy_sql(self, rt_clause: str) -> TextClause:
        return text(
            "WITH yearly AS ("
            " SELECT resource_type,"
            " EXTRACT(YEAR FROM bill_date) AS yr,"
            " SUM(amount_consumed) AS total"
            " FROM bills"
            " WHERE user_id = :user_id"
            " AND deleted_at IS NULL"
            " AND bill_date BETWEEN :date_from AND :date_to"
            " " + rt_clause + " GROUP BY resource_type, yr"
            "),"
            " max_year AS (SELECT MAX(yr) AS max_yr FROM yearly),"
            " current_y AS (SELECT resource_type, total FROM yearly, max_year WHERE yr = max_yr),"
            " prev_y AS (SELECT resource_type, total FROM yearly, max_year WHERE yr = max_yr - 1)"
            " SELECT c.resource_type, c.total AS current_year,"
            " COALESCE(p.total, 0) AS previous_year"
            " FROM current_y c LEFT JOIN prev_y p USING (resource_type)"
        )

    @staticmethod
    def _compute_yoy_point(r: Any) -> YearOverYearPoint:
        curr = Decimal(str(r.current_year))
        prev = Decimal(str(r.previous_year))
        chg = None
        if prev and prev != 0:
            chg = ((curr - prev) / prev * 100).quantize(Decimal("0.01"))
        return YearOverYearPoint(
            resource_type=ResourceType(r.resource_type),
            current_year=curr,
            previous_year=prev,
            change_pct=chg,
        )

    async def _year_over_year(
        self, params: dict[str, object], rt_clause: str
    ) -> list[YearOverYearPoint]:
        sql = self._build_yoy_sql(rt_clause)
        rows = (await self.db.execute(sql, params)).fetchall()
        return [self._compute_yoy_point(r) for r in rows]

    async def _cumulative_cost_ytd(
        self, params: dict[str, object], rt_clause: str
    ) -> list[CumulativeCostPoint]:
        sql = text(
            "SELECT to_char(date_trunc('month', bill_date), 'YYYY-MM') AS month,"
            " resource_type,"
            " SUM(SUM(amount_paid)) OVER ("
            " PARTITION BY resource_type"
            " ORDER BY date_trunc('month', bill_date)"
            " ) AS cumulative_cost"
            " FROM bills"
            " WHERE user_id = :user_id"
            " AND deleted_at IS NULL"
            " AND bill_date BETWEEN :date_from AND :date_to"
            " " + rt_clause + " GROUP BY date_trunc('month', bill_date), resource_type"
            " ORDER BY 1, 2"
        )
        rows = (await self.db.execute(sql, params)).fetchall()
        return [
            CumulativeCostPoint(
                month=r.month,
                resource_type=ResourceType(r.resource_type),
                cumulative_cost=Decimal(str(r.cumulative_cost)),
            )
            for r in rows
        ]

    @staticmethod
    def _yoy_period_cte(
        name: str, date_from_param: str, date_to_param: str, rt_clause: str, shift_year: bool
    ) -> str:
        month_col = (
            " to_char(date_trunc('month', bill_date) + INTERVAL '1 year', 'YYYY-MM') AS month,"
            if shift_year
            else " to_char(date_trunc('month', bill_date), 'YYYY-MM') AS month,"
        )
        return (
            f"{name} AS ("
            f"{month_col}"
            f" resource_type,"
            f" SUM(amount_consumed) / {_MONTH_DAYS} AS consumption,"
            f" SUM(amount_paid) AS cost"
            f" FROM bills WHERE user_id = :user_id AND deleted_at IS NULL"
            f" AND bill_date BETWEEN :{date_from_param} AND :{date_to_param}"
            f" {rt_clause} GROUP BY 1, 2, date_trunc('month', bill_date))"
        )

    def _monthly_yoy_sql(self, rt_clause: str) -> TextClause:
        curr = self._yoy_period_cte("current_period", "date_from", "date_to", rt_clause, False)
        prev = self._yoy_period_cte(
            "prev_period", "prev_date_from", "prev_date_to", rt_clause, True
        )
        return text(
            f"WITH {curr}, {prev}"
            " SELECT c.month, c.resource_type,"
            " c.consumption AS current_consumption,"
            " p.consumption AS prev_year_consumption,"
            " c.cost AS current_cost, p.cost AS prev_year_cost"
            " FROM current_period c"
            " LEFT JOIN prev_period p USING (month, resource_type)"
            " ORDER BY c.month, c.resource_type"
        )

    @staticmethod
    def _make_yoy_point(r: Any) -> MonthlyYoYPoint:
        curr_c = Decimal(str(round(float(r.current_consumption), 4)))
        prev_c = (
            Decimal(str(round(float(r.prev_year_consumption), 4)))
            if r.prev_year_consumption
            else None
        )
        curr_cost = Decimal(str(r.current_cost))
        prev_cost = Decimal(str(r.prev_year_cost)) if r.prev_year_cost else None
        c_pct = ((curr_c - prev_c) / prev_c * 100).quantize(Decimal("0.01")) if prev_c else None
        cost_pct = (
            ((curr_cost - prev_cost) / prev_cost * 100).quantize(Decimal("0.01"))
            if prev_cost
            else None
        )
        return MonthlyYoYPoint(
            month=r.month,
            resource_type=ResourceType(r.resource_type),
            current_consumption=curr_c,
            prev_year_consumption=prev_c,
            consumption_change_pct=c_pct,
            current_cost=curr_cost,
            prev_year_cost=prev_cost,
            cost_change_pct=cost_pct,
        )

    async def _monthly_yoy(
        self, params: dict[str, object], rt_clause: str
    ) -> list[MonthlyYoYPoint]:
        from datetime import timedelta

        date_from = params["date_from"]
        date_to = params["date_to"]
        assert isinstance(date_from, date)
        assert isinstance(date_to, date)
        yoy_params = {
            **params,
            "prev_date_from": date_from - timedelta(days=365),
            "prev_date_to": date_to - timedelta(days=365),
        }
        rows = (await self.db.execute(self._monthly_yoy_sql(rt_clause), yoy_params)).fetchall()
        return [self._make_yoy_point(r) for r in rows]
