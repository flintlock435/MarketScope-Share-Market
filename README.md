# MarketScope — GitHub Pages static website

A responsive HTML/CSS/JavaScript stock dashboard with searchable starter tickers, history periods through 15 years, candlestick/line charts, session and period highs/lows, SMA 20/50, RSI, MACD, recent data table, and CSV export.

## Publish

1. Put `index.html`, `styles.css`, `app.js`, and `README.md` in the root of your GitHub repository.
2. Commit and push to your default branch.
3. In GitHub, open **Settings → Pages**.
4. Choose **Deploy from a branch**, select your default branch and `/(root)`, then Save.
5. Wait for the published URL to appear on the Pages settings screen.

## Local preview

Run `python -m http.server 8000` in this folder, then open `http://localhost:8000`.

## Data limitations

This frontend fetches daily prices from Yahoo Finance's public chart endpoint. It is not an official API contract and may change, rate-limit requests, or block browser cross-origin requests. If it fails with a network/CORS error, connect a market-data API that explicitly supports browser CORS or use a backend proxy. Do not place private API keys in a public GitHub repository.

The 15-year option requests maximum available history and trims it to 15 years. Newly listed companies may have shorter histories, and the UI warns about that. Ticker availability can change.

## Python forecasting model

A GitHub Pages static site cannot execute your existing Python/scikit-learn model. To keep that model, deploy it as a separate Python API (for example FastAPI on a Python host) and call it from the frontend. This static package does not pretend to run that Python model.

Educational use only; market data can be delayed or incomplete. Not investment advice.

## Step 3 and Step 4 additions

- **Compare stocks:** enter NSE symbols without `.NS` (for example `RELIANCE, TCS, INFY`) or use full Yahoo Finance tickers. The frontend normalizes bare symbols to `.NS`.
- **Stock screener:** filters the included major NSE-stock universe by lookback return and whether the latest close is above/below its 20-day simple moving average. It also reports 14-day RSI.
- **Backend:** `/api/history` now tries the supplied ticker first and, for bare symbols without an exchange suffix, retries as an NSE ticker with `.NS`.

The screener requests history for each stock when run, so it can take time or be affected by Yahoo Finance rate limits. Results are for educational research only, not investment advice.

## Step 5: Forecast and backtest

- **Forecast & backtest:** the dashboard calls `/api/forecast` on the FastAPI backend.
- **Baseline models:** 5-day moving average and last-close naïve forecast.
- **Evaluation:** chronological holdout one-step backtest with MAE, RMSE, and MAPE; the final segment is held out from each prediction's input history.
- **Forward estimate:** selectable 5, 10, 20, or 30 weekday estimates.
- **Deployment:** redeploy `app.py` on the existing Render backend as well as publishing the updated static frontend on GitHub Pages.
- **Limitations:** these are deliberately simple statistical baselines, not a trained predictive AI model. Weekday forecast dates do not account for NSE holidays, backtest scores do not promise future accuracy, and the feature is not financial advice.

## Step 6 — Portfolio tracker

The Portfolio Tracker adds a transaction ledger stored in this browser's `localStorage` (key: `marketscope.portfolio.transactions.v1`). Record buys and sells using ticker symbols with or without `.NS`, quantity, price per share, and transaction date. The app calculates remaining shares, weighted-average cost, realized profit/loss on sales, estimated market value, and unrealized profit/loss. Use **Refresh prices** to fetch the latest available daily closes from the existing `/api/history` endpoint. The allocation chart shows current holdings by estimated market value. Export the ledger as CSV for backup; transactions are device/browser-specific and are not synced to another device.

Accounting notes: the tracker uses weighted-average cost for realized and unrealized P/L. It does not include brokerage, taxes, dividends, corporate actions, or tax-lot accounting. Market values are estimates based on the latest available close, not executable live quotes. The portfolio section requires no new backend endpoint; the existing Render API and GitHub Pages setup are retained.
