import math

import pandas as pd

from app.domain.models import Bill


def build_features(bills: list[Bill]) -> pd.DataFrame:
    rows = []
    for b in bills:
        rows.append(
            {
                "bill_date": pd.Timestamp(b.bill_date),
                "amount_consumed": float(b.amount_consumed),
                "amount_paid": float(b.amount_paid),
                "period_days": (b.period_end - b.period_start).days,
            }
        )
    df = pd.DataFrame(rows).sort_values("bill_date").reset_index(drop=True)
    df["month"] = df["bill_date"].dt.month
    df["sin_month"] = df["month"].apply(lambda m: math.sin(2 * math.pi * m / 12))
    df["cos_month"] = df["month"].apply(lambda m: math.cos(2 * math.pi * m / 12))
    df["price_per_unit"] = df.apply(
        lambda r: r["amount_paid"] / r["amount_consumed"] if r["amount_consumed"] > 0 else 0,
        axis=1,
    )
    for lag in [1, 2]:
        df[f"lag_{lag}"] = df["amount_consumed"].shift(lag)
    df = df.dropna().reset_index(drop=True)
    return df
