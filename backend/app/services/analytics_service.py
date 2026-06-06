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
    YearOverYearPoint,
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

        monthly_consumption = await self._monthly_consumption(params, rt_clause)
        monthly_cost = await self._monthly_cost(params, rt_clause)
        price_per_unit = await self._price_per_unit(params, rt_clause)
        year_over_year = await self._year_over_year(params, rt_clause)
        cumulative = await self._cumulative_cost_ytd(params, rt_clause)
        return AnalyticsSummary(
            monthly_consumption=monthly_consumption,
            monthly_cost=monthly_cost,
            price_per_unit=price_per_unit,
            year_over_year=year_over_year,
            cumulative_cost_ytd=cumulative,
        )

    async def _monthly_consumption(
        self, params: dict[str, object], rt_clause: str
    ) -> list[MonthlyDataPoint]:
        sql = text(
            "SELECT to_char(date_trunc('month', bill_date), 'YYYY-MM') AS month,"
            " resource_type,"
            " SUM(amount_consumed) AS value"
            " FROM bills"
            " WHERE user_id = :user_id"
            " AND deleted_at IS NULL"
            " AND bill_date BETWEEN :date_from AND :date_to"
            " " + rt_clause +
            " GROUP BY 1, 2"
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
            " " + rt_clause +
            " GROUP BY 1, 2"
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
            " " + rt_clause +
            " GROUP BY 1, 2"
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
            " " + rt_clause +
            " GROUP BY resource_type, yr"
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
            " " + rt_clause +
            " GROUP BY date_trunc('month', bill_date), resource_type"
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
