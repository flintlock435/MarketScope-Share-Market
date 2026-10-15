
import re

import pandas as pd
import yfinance as yf
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="MarketScope API", version="1.0.0")

# Allows the GitHub Pages frontend to request data.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)

PERIODS = {
    "1mo": "1mo",
    "3mo": "3mo",
    "6mo": "6mo",
    "1y": "1y",
    "2y": "2y",
    "5y": "5y",
    "10y": "10y",
    "15y": "max",
}


@app.get("/")
def home():
    return {
        "name": "MarketScope API",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/history")
def history(
    symbol: str = Query(..., min_length=1, max_length=30),
    period: str = Query("1y"),
):
    symbol = symbol.strip().upper()

    if not re.fullmatch(r"[A-Z0-9.^=_-]{1,30}", symbol):
        raise HTTPException(
            status_code=400,
            detail="Invalid stock ticker.",
        )

    if period not in PERIODS:
        raise HTTPException(
            status_code=400,
            detail="Unsupported historical period.",
        )

    try:
        prices = yf.download(
            symbol,
            period=PERIODS[period],
            interval="1d",
            auto_adjust=True,
            progress=False,
            threads=False,
            timeout=20,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="Unable to retrieve market data. Please try again.",
        ) from exc

    if prices is None or prices.empty:
        raise HTTPException(
            status_code=404,
            detail="No data found. Check the stock ticker.",
        )

    # Handle different yfinance column formats.
    if isinstance(prices.columns, pd.MultiIndex):
        prices.columns = prices.columns.get_level_values(0)

    required = ["Open", "High", "Low", "Close"]

    if any(column not in prices.columns for column in required):
        raise HTTPException(
            status_code=502,
            detail="Incomplete price data received.",
        )

    prices = prices.dropna(subset=["High", "Low", "Close"])
    records = []

    for date, row in prices.iterrows():
        def safe_number(value):
            try:
                value = float(value)
                return value if pd.notna(value) else None
            except (TypeError, ValueError):
                return None

        volume = row.get("Volume", 0)

        records.append({
            "date": pd.Timestamp(date).date().isoformat(),
            "open": safe_number(row.get("Open")),
            "high": safe_number(row.get("High")),
            "low": safe_number(row.get("Low")),
            "close": safe_number(row.get("Close")),
            "volume": int(volume) if pd.notna(volume) else 0,
        })

    records = [
        item for item in records
        if item["close"] is not None
        and item["high"] is not None
        and item["low"] is not None
    ]

    if not records:
        raise HTTPException(
            status_code=404,
            detail="No usable price records found.",
        )

    return {
        "symbol": symbol,
        "period": period,
        "count": len(records),
        "data": records,
    }
