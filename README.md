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
