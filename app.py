
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

    # For bare symbols, try the supplied ticker first, then NSE (.NS).
    # Explicit exchange suffixes and indices are left unchanged.
    candidates = [symbol]
    if not symbol.startswith("^") and "." not in symbol:
        candidates.append(f"{symbol}.NS")

    prices = None
    last_error = None
    for candidate in candidates:
        try:
            candidate_prices = yf.download(
                candidate,
                period=PERIODS[period],
                interval="1d",
                auto_adjust=True,
                progress=False,
                threads=False,
                timeout=20,
            )
            if candidate_prices is not None and not candidate_prices.empty:
                prices = candidate_prices
                break
        except Exception as exc:
            last_error = exc

    if prices is None or prices.empty:
        if last_error and len(candidates) == 1:
            raise HTTPException(
                status_code=502,
                detail="Unable to retrieve market data. Please try again.",
            ) from last_error
        raise HTTPException(
            status_code=404,
            detail="No data found. Check the ticker; bare symbols are also tried as NSE stocks (.NS).",
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


@app.get("/api/forecast")
def forecast(
    symbol: str = Query(..., min_length=1, max_length=30),
    period: str = Query("2y"),
    horizon: int = Query(10, ge=5, le=30),
    model: str = Query("sma5"),
):
    """Baseline forecasting with chronological one-step backtesting.

    This is an educational statistical baseline, not investment advice.
    """
    symbol = symbol.strip().upper()
    if not re.fullmatch(r"[A-Z0-9.^=_-]{1,30}", symbol):
        raise HTTPException(status_code=400, detail="Invalid stock ticker.")
    if period not in {"1y", "2y", "5y", "10y"}:
        raise HTTPException(status_code=400, detail="Forecast period must be 1y, 2y, 5y, or 10y.")
    if model not in {"naive", "sma5"}:
        raise HTTPException(status_code=400, detail="Unsupported forecast model.")

    candidates = [symbol]
    if not symbol.startswith("^") and "." not in symbol:
        candidates.append(f"{symbol}.NS")
    prices = None
    for candidate in candidates:
        try:
            downloaded = yf.download(candidate, period=PERIODS[period], interval="1d", auto_adjust=True, progress=False, threads=False, timeout=20)
            if downloaded is not None and not downloaded.empty:
                prices = downloaded
                break
        except Exception:
            continue
    if prices is None or prices.empty:
        raise HTTPException(status_code=404, detail="No historical data found for this ticker.")
    if isinstance(prices.columns, pd.MultiIndex):
        prices.columns = prices.columns.get_level_values(0)
    if "Close" not in prices.columns:
        raise HTTPException(status_code=502, detail="Incomplete price data received.")
    closes = pd.to_numeric(prices["Close"], errors="coerce").dropna()
    if len(closes) < 80:
        raise HTTPException(status_code=422, detail="At least 80 daily closing prices are needed for forecasting and evaluation.")

    values = closes.to_numpy(dtype=float)
    # Reserve the final 20% (at least 20 observations) for out-of-sample one-step tests.
    test_size = max(20, int(len(values) * 0.2))
    split = len(values) - test_size
    actuals, predictions = [], []
    for i in range(split, len(values)):
        history_values = values[:i]
        prediction = history_values[-1] if model == "naive" else float(history_values[-min(5, len(history_values)):].mean())
        actuals.append(float(values[i]))
        predictions.append(float(prediction))
    errors = [p - a for p, a in zip(predictions, actuals)]
    mae = sum(abs(e) for e in errors) / len(errors)
    rmse = (sum(e * e for e in errors) / len(errors)) ** 0.5
    mape_values = [abs((p - a) / a) * 100 for p, a in zip(predictions, actuals) if a != 0]
    mape = sum(mape_values) / len(mape_values) if mape_values else None

    last_date = pd.Timestamp(closes.index[-1]).normalize()
    future_dates = pd.bdate_range(last_date + pd.Timedelta(days=1), periods=horizon)
    last_values = list(values)
    future = []
    for date in future_dates:
        predicted = last_values[-1] if model == "naive" else sum(last_values[-5:]) / min(5, len(last_values))
        future.append({"date": date.date().isoformat(), "close": round(float(predicted), 4)})
        last_values.append(float(predicted))

    return {
        "symbol": symbol, "period": period, "model": model, "horizon": horizon,
        "history": [{"date": pd.Timestamp(date).date().isoformat(), "close": round(float(value), 4)} for date, value in zip(closes.index[-90:], values[-90:])],
        "forecast": future,
        "evaluation": {"test_points": len(actuals), "mae": round(mae, 4), "rmse": round(rmse, 4), "mape": round(mape, 4) if mape is not None else None, "split_index": split},
        "note": "Baseline estimates only. Backtest metrics are historical and do not guarantee future accuracy. Future dates use weekdays and do not account for exchange holidays."
    }
