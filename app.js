
"use strict";

/* ============================================
   MarketScope — Complete frontend application
   Backend: Render FastAPI
   ============================================ */

const API_BASE = "https://marketscope-api-6svt.onrender.com";

const STOCKS = [
  { name: "Reliance Industries", symbol: "RELIANCE.NS" },
  { name: "Tata Consultancy Services", symbol: "TCS.NS" },
  { name: "HDFC Bank", symbol: "HDFCBANK.NS" },
  { name: "ICICI Bank", symbol: "ICICIBANK.NS" },
  { name: "Infosys", symbol: "INFY.NS" },
  { name: "ITC", symbol: "ITC.NS" },
  { name: "State Bank of India", symbol: "SBIN.NS" },
  { name: "Tata Motors", symbol: "TATAMOTORS.NS" },
  { name: "Bharti Airtel", symbol: "BHARTIARTL.NS" },
  { name: "Larsen & Toubro", symbol: "LT.NS" },
  { name: "Wipro", symbol: "WIPRO.NS" },
  { name: "Axis Bank", symbol: "AXISBANK.NS" },
  { name: "Kotak Mahindra Bank", symbol: "KOTAKBANK.NS" },
  { name: "Hindustan Unilever", symbol: "HINDUNILVR.NS" },
  { name: "Maruti Suzuki", symbol: "MARUTI.NS" },
  { name: "Adani Ports", symbol: "ADANIPORTS.NS" },
  { name: "Tata Steel", symbol: "TATASTEEL.NS" },
  { name: "Asian Paints", symbol: "ASIANPAINT.NS" },
  { name: "Sun Pharmaceutical", symbol: "SUNPHARMA.NS" },
  { name: "Nifty 50", symbol: "^NSEI" },
  { name: "BSE Sensex", symbol: "^BSESN" }
];

const $ = (selector) => document.querySelector(selector);

const state = {
  symbol: "RELIANCE.NS",
  company: "Reliance Industries",
  period: "1y",
  chartType: "candlestick",
  rows: [],
  requestId: 0,
  searchIndex: -1
};

const money = (value) => {
  const n = Number(value);
  return Number.isFinite(n)
    ? "₹" + n.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })
    : "—";
};

const number = (value, digits = 2) => {
  const n = Number(value);
  return Number.isFinite(n)
    ? n.toLocaleString("en-IN", {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
      })
    : "—";
};

const dateLabel = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      });
};

function safeText(selector, value) {
  const element = $(selector);
  if (element) element.textContent = value;
}

function setNotice(message, type = "info") {
  const area = $("#notice-area");
  if (!area) return;

  area.replaceChildren();

  if (!message) return;

  const notice = document.createElement("div");
  notice.textContent = message;
  notice.setAttribute("role", type === "error" ? "alert" : "status");
  notice.style.padding = "12px 14px";
  notice.style.margin = "12px 0";
  notice.style.borderRadius = "8px";
  notice.style.fontSize = "14px";

  if (type === "error") {
    notice.style.background = "#fee2e2";
    notice.style.color = "#991b1b";
  } else if (type === "success") {
    notice.style.background = "#dcfce7";
    notice.style.color = "#166534";
  } else {
    notice.style.background = "#e0f2fe";
    notice.style.color = "#075985";
  }

  area.appendChild(notice);
}

function setLoading(loading) {
  const analyze = $("#analyze-button");
  const refresh = $("#refresh-button");

  if (analyze) {
    analyze.disabled = loading;
    analyze.textContent = loading ? "Loading…" : "Analyze →";
  }

  if (refresh) {
    refresh.disabled = loading;
    refresh.textContent = loading ? "↻ Loading…" : "↻ Refresh data";
  }

  if (loading) {
    safeText("#connection-copy", "Fetching historical market data…");
  }
}

function setConnection(message, error = false) {
  safeText("#connection-copy", message);

  const dot = $(".side-card i");
  if (dot) {
    dot.style.background = error ? "#dc2626" : "#16a34a";
  }
}

function showMessage(selector, message) {
  const element = $(selector);
  if (!element) return;

  element.replaceChildren();

  const text = document.createElement("div");
  text.textContent = message;
  text.style.padding = "24px";
  text.style.textAlign = "center";

  element.appendChild(text);
}

function findStock(symbol) {
  return STOCKS.find(
    (stock) => stock.symbol.toUpperCase() === symbol.toUpperCase()
  );
}

function getCompanyName(symbol) {
  return findStock(symbol)?.name || symbol;
}

/* ============================================
   COMPANY SELECTION
   ============================================ */

function updateSelectedCompany(symbol) {
  state.symbol = symbol;
  state.company = getCompanyName(symbol);

  safeText("#selected-company-name", state.company);
  safeText(
    "#selected-company-ticker",
    `${symbol} · ${symbol.startsWith("^") ? "INDEX" : "NSE"}`
  );

  safeText(
    "#company-monogram",
    state.company
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase()
  );

  // Update the selected company card if the HTML has it.
  const selected = $(".selected");
  if (selected) {
    selected.style.cursor = "pointer";
  }
}

/* ============================================
   SEARCH DROPDOWN
   ============================================ */

function renderSearchResults(query) {
  const results = $("#search-results");
  if (!results) return;

  results.replaceChildren();
  state.searchIndex = -1;

  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    results.classList.add("hidden");
    return;
  }

  const matches = STOCKS.filter((stock) =>
    stock.name.toLowerCase().includes(normalized) ||
    stock.symbol.toLowerCase().includes(normalized)
  ).slice(0, 8);

  if (!matches.length) {
    const empty = document.createElement("div");
    empty.className = "result-item";
    empty.textContent = "No matching companies found";
    results.appendChild(empty);
    results.classList.remove("hidden");
    return;
  }

  matches.forEach((stock) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "result-item";
    item.setAttribute("role", "option");

    const name = document.createElement("span");
    name.textContent = stock.name;

    const ticker = document.createElement("small");
    ticker.textContent = stock.symbol;

    item.append(name, ticker);

    // Use mousedown so the selection is handled before the input
    // loses focus. This prevents the dropdown from disappearing
    // before the click can be processed.
    item.addEventListener("mousedown", (event) => {
      event.preventDefault();
      selectStock(stock);
    });

    // Also support touch and keyboard-generated clicks.
    item.addEventListener("click", () => {
      selectStock(stock);
    });

    results.appendChild(item);
  });

  results.classList.remove("hidden");
  results.style.display = "block";
}

function selectStock(stock) {
  const input = $("#stock-search");
  const results = $("#search-results");

  if (input) input.value = stock.name;

  if (results) {
    results.classList.add("hidden");
    results.style.display = "none";
  }

  updateSelectedCompany(stock.symbol);
  loadStock(stock.symbol);
}

function resolveSearchValue(value) {
  const query = value.trim();
  if (!query) return null;

  const exactSymbol = findStock(query.toUpperCase());
  if (exactSymbol) return exactSymbol.symbol;

  const exactName = STOCKS.find(
    (stock) => stock.name.toLowerCase() === query.toLowerCase()
  );
  if (exactName) return exactName.symbol;

  const normalized = query.replace(/\s+/g, "").toUpperCase();

  // Permit custom symbols such as AAPL, INFY.NS and ^NSEI.
  if (/^[A-Z0-9.^=_-]{1,30}$/.test(normalized)) {
    return normalized;
  }

  const partial = STOCKS.find(
    (stock) =>
      stock.name.toLowerCase().includes(query.toLowerCase()) ||
      stock.symbol.toLowerCase().includes(query.toLowerCase())
  );

  return partial ? partial.symbol : null;
}

/* ============================================
   NAVIGATION
   ============================================ */

function setupNavigation() {
  const links = [
    ...document.querySelectorAll(".sidebar .nav")
  ];

  function activate(link, scroll = true) {
    links.forEach((item) => {
      const active = item === link;
      item.classList.toggle("active", active);

      if (active) {
        item.setAttribute("aria-current", "location");
      } else {
        item.removeAttribute("aria-current");
      }
    });

    const target = link
      ? $(link.getAttribute("href"))
      : null;

    const title = link
      ? link.textContent.replace(/\s+/g, " ").trim()
      : "Market overview";

    const breadcrumb = $(".topbar > span:first-child");

    if (breadcrumb) {
      breadcrumb.replaceChildren();

      const workspace = document.createElement("span");
      workspace.textContent = "Workspace ";

      const separator = document.createElement("em");
      separator.textContent = "/";

      const current = document.createElement("b");
      current.textContent = title;

      breadcrumb.append(workspace, separator, current);
    }

    if (scroll && target) {
      target.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }
  }

  links.forEach((link) => {
    link.addEventListener("click", (event) => {
      const target = $(link.getAttribute("href"));
      if (!target) return;

      event.preventDefault();

      history.replaceState(
        null,
        "",
        link.getAttribute("href")
      );

      activate(link);
    });
  });

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort(
          (a, b) => b.intersectionRatio - a.intersectionRatio
        )[0];

      if (!visible) return;

      const link = links.find(
        (item) =>
          item.getAttribute("href") === `#${visible.target.id}`
      );

      if (link) activate(link, false);
    }, {
      rootMargin: "-15% 0px -65% 0px",
      threshold: [0, 0.15, 0.4]
    });

    ["overview", "price-chart", "indicators"].forEach((id) => {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    });
  }

  const initial = links.find(
    (link) => link.getAttribute("href") === window.location.hash
  );

  activate(initial || links[0], false);
}

/* ============================================
   API REQUEST
   ============================================ */

async function fetchHistory(symbol, period, signal) {
  const url = new URL(`${API_BASE}/api/history`);

  url.searchParams.set("symbol", symbol);
  url.searchParams.set("period", period);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json"
    },
    cache: "no-store",
    signal
  });

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error("The API returned an unreadable response.");
  }

  if (!response.ok) {
    throw new Error(
      typeof result.detail === "string"
        ? result.detail
        : `API request failed: HTTP ${response.status}`
    );
  }

  if (!Array.isArray(result.data)) {
    throw new Error("The API response has no historical data array.");
  }

  const rows = result.data.map((item) => ({
    date: new Date(item.date),
    open: Number(item.open),
    high: Number(item.high),
    low: Number(item.low),
    close: Number(item.close),
    volume: Number(item.volume ?? 0)
  })).filter((row) =>
    !Number.isNaN(row.date.getTime()) &&
    Number.isFinite(row.close)
  ).sort((a, b) => a.date - b.date);

  if (!rows.length) {
    throw new Error(`No historical prices were returned for ${symbol}.`);
  }

  return rows;
}

/* ============================================
   TECHNICAL INDICATORS
   ============================================ */

function movingAverage(values, period) {
  return values.map((_, index) => {
    if (index < period - 1) return null;

    const slice = values.slice(index - period + 1, index + 1);

    return slice.reduce((sum, value) => sum + value, 0) / period;
  });
}

function calculateEMA(values, period) {
  const output = Array(values.length).fill(null);

  if (values.length < period) return output;

  const multiplier = 2 / (period + 1);

  let ema = values
    .slice(0, period)
    .reduce((sum, value) => sum + value, 0) / period;

  output[period - 1] = ema;

  for (let i = period; i < values.length; i++) {
    ema = (values[i] - ema) * multiplier + ema;
    output[i] = ema;
  }

  return output;
}

function calculateRSI(values, period = 14) {
  const output = Array(values.length).fill(null);

  if (values.length <= period) return output;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const difference = values[i] - values[i - 1];
    gains += Math.max(difference, 0);
    losses += Math.max(-difference, 0);
  }

  let averageGain = gains / period;
  let averageLoss = losses / period;

  output[period] = averageLoss === 0
    ? 100
    : 100 - 100 / (1 + averageGain / averageLoss);

  for (let i = period + 1; i < values.length; i++) {
    const difference = values[i] - values[i - 1];

    averageGain =
      (averageGain * (period - 1) + Math.max(difference, 0)) / period;

    averageLoss =
      (averageLoss * (period - 1) + Math.max(-difference, 0)) / period;

    output[i] = averageLoss === 0
      ? 100
      : 100 - 100 / (1 + averageGain / averageLoss);
  }

  return output;
}

function calculateMACD(values) {
  const fast = calculateEMA(values, 12);
  const slow = calculateEMA(values, 26);

  const macd = values.map((_, index) =>
    fast[index] === null || slow[index] === null
      ? null
      : fast[index] - slow[index]
  );

  const firstValid = macd.findIndex((value) => value !== null);
  const signal = Array(values.length).fill(null);

  if (firstValid === -1) {
    return {
      macd,
      signal,
      histogram: signal.slice()
    };
  }

  const validMACD = macd.slice(firstValid);
  const validSignal = calculateEMA(validMACD, 9);

  validSignal.forEach((value, index) => {
    signal[firstValid + index] = value;
  });

  const histogram = macd.map((value, index) =>
    value === null || signal[index] === null
      ? null
      : value - signal[index]
  );

  return { macd, signal, histogram };
}

/* ============================================
   SUMMARY METRICS
   ============================================ */

function updateMetrics(rows) {
  const last = rows[rows.length - 1];
  const previous = rows.length > 1
    ? rows[rows.length - 2]
    : last;

  const periodHigh = Math.max(...rows.map((row) => row.high));
  const periodLow = Math.min(...rows.map((row) => row.low));

  const change = last.close - previous.close;
  const changePercent = previous.close
    ? change / previous.close * 100
    : 0;

  safeText("#latest-close", money(last.close));
  safeText("#session-high", money(last.high));
  safeText("#session-low", money(last.low));
  safeText("#period-range", `${money(periodHigh)} / ${money(periodLow)}`);
  safeText("#latest-date", dateLabel(last.date));

  const changeElement = $("#daily-change");

  if (changeElement) {
    changeElement.textContent =
      `${change >= 0 ? "+" : ""}${money(change)} ` +
      `(${changePercent >= 0 ? "+" : ""}${number(changePercent)}%)`;

    changeElement.style.color =
      change >= 0 ? "#16a34a" : "#dc2626";
  }

  safeText(
    "#records-label",
    `${rows.length.toLocaleString("en-IN")} daily records`
  );

  safeText(
    "#chart-subtitle",
    `${state.company} · ${state.symbol} · ${state.period}`
  );
}

/* ============================================
   CHART LAYOUT
   ============================================ */

function plotLayout(extra = {}) {
  return {
    autosize: true,
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: {
      family: "DM Sans, sans-serif",
      color: "#64748b",
      size: 12
    },
    margin: { l: 55, r: 20, t: 15, b: 40 },
    showlegend: true,
    legend: {
      orientation: "h",
      y: 1.12,
      x: 0
    },
    hovermode: "x unified",
    xaxis: {
      type: "date",
      gridcolor: "rgba(128,128,128,0.15)",
      rangeslider: { visible: false }
    },
    yaxis: {
      gridcolor: "rgba(128,128,128,0.15)",
      tickprefix: "₹",
      tickformat: ",.2f"
    },
    ...extra
  };
}

/* ============================================
   PRICE CHART
   ============================================ */

function renderPriceChart(rows) {
  const element = $("#price-chart-view");
  if (!element) return;

  if (typeof Plotly === "undefined") {
    showMessage(
      "#price-chart-view",
      "Plotly did not load. Check your internet connection."
    );
    return;
  }

  const dates = rows.map((row) => row.date);
  const closes = rows.map((row) => row.close);

  const sma20 = movingAverage(closes, 20);
  const sma50 = movingAverage(closes, 50);

  const traces = [];

  if (state.chartType === "candlestick") {
    traces.push({
      type: "candlestick",
      name: state.symbol,
      x: dates,
      open: rows.map((row) => row.open),
      high: rows.map((row) => row.high),
      low: rows.map((row) => row.low),
      close: closes,
      increasing: {
        line: { color: "#16a34a" }
      },
      decreasing: {
        line: { color: "#dc2626" }
      }
    });
  } else {
    traces.push({
      type: "scatter",
      mode: "lines",
      name: "Closing price",
      x: dates,
      y: closes,
      line: {
        color: "#2563eb",
        width: 2
      }
    });
  }

  traces.push({
    type: "scatter",
    mode: "lines",
    name: "SMA 20",
    x: dates,
    y: sma20,
    connectgaps: false,
    line: {
      color: "#f59e0b",
      width: 1.5
    }
  });

  traces.push({
    type: "scatter",
    mode: "lines",
    name: "SMA 50",
    x: dates,
    y: sma50,
    connectgaps: false,
    line: {
      color: "#8b5cf6",
      width: 1.5
    }
  });

  element.replaceChildren();

  Plotly.newPlot(
    element,
    traces,
    plotLayout(),
    {
      responsive: true,
      displaylogo: false
    }
  );
}

/* ============================================
   RSI CHART
   ============================================ */

function renderRSI(rows) {
  const values = calculateRSI(rows.map((row) => row.close));
  const valid = values.filter((value) => value !== null);
  const latest = valid.length ? valid[valid.length - 1] : null;

  safeText(
    "#rsi-value",
    latest === null ? "RSI —" : `RSI ${number(latest, 1)}`
  );

  if (latest === null) {
    safeText("#rsi-note", "More price history is needed to calculate RSI.");
    showMessage("#rsi-chart", "Insufficient data for RSI.");
    return;
  }

  safeText(
    "#rsi-note",
    latest >= 70
      ? "RSI is above 70, indicating strong recent momentum. This alone does not predict a reversal."
      : latest <= 30
        ? "RSI is below 30, indicating weak recent momentum. This alone does not predict a rebound."
        : "RSI is between 30 and 70, within the commonly used neutral range."
  );

  const dates = rows.map((row) => row.date);

  Plotly.newPlot(
    $("#rsi-chart"),
    [
      {
        type: "scatter",
        mode: "lines",
        name: "RSI 14",
        x: dates,
        y: values,
        connectgaps: false,
        line: { color: "#0ea5e9", width: 2 }
      },
      {
        type: "scatter",
        mode: "lines",
        name: "70",
        x: dates,
        y: dates.map(() => 70),
        line: { color: "#dc2626", dash: "dash", width: 1 }
      },
      {
        type: "scatter",
        mode: "lines",
        name: "30",
        x: dates,
        y: dates.map(() => 30),
        line: { color: "#16a34a", dash: "dash", width: 1 }
      }
    ],
    plotLayout({
      showlegend: false,
      margin: { l: 42, r: 12, t: 10, b: 30 },
      yaxis: {
        range: [0, 100],
        dtick: 20,
        gridcolor: "rgba(128,128,128,0.15)"
      }
    }),
    { responsive: true, displaylogo: false }
  );
}

/* ============================================
   MACD CHART
   ============================================ */

function renderMACD(rows) {
  const result = calculateMACD(rows.map((row) => row.close));

  const valid = result.macd
    .map((value, index) => ({ value, index }))
    .filter((item) => item.value !== null);

  const latestIndex = valid.length
    ? valid[valid.length - 1].index
    : -1;

  const latest = latestIndex >= 0
    ? result.macd[latestIndex]
    : null;

  const latestSignal = latestIndex >= 0
    ? result.signal[latestIndex]
    : null;

  safeText(
    "#macd-value",
    latest === null ? "MACD —" : `MACD ${number(latest)}`
  );

  if (latest === null || latestSignal === null) {
    safeText("#macd-note", "More historical prices are needed to calculate MACD.");
    showMessage("#macd-chart", "Insufficient data for MACD.");
    return;
  }

  safeText(
    "#macd-note",
    latest > latestSignal
      ? "MACD is above its signal line, suggesting positive recent momentum."
      : latest < latestSignal
        ? "MACD is below its signal line, suggesting negative recent momentum."
        : "MACD and its signal line are approximately equal."
  );

  const dates = rows.map((row) => row.date);

  Plotly.newPlot(
    $("#macd-chart"),
    [
      {
        type: "bar",
        name: "Histogram",
        x: dates,
        y: result.histogram,
        marker: {
          color: result.histogram.map((value) =>
            value === null
              ? "rgba(0,0,0,0)"
              : value >= 0
                ? "#16a34a"
                : "#dc2626"
          )
        }
      },
      {
        type: "scatter",
        mode: "lines",
        name: "MACD",
        x: dates,
        y: result.macd,
        connectgaps: false,
        line: { color: "#2563eb", width: 1.5 }
      },
      {
        type: "scatter",
        mode: "lines",
        name: "Signal",
        x: dates,
        y: result.signal,
        connectgaps: false,
        line: { color: "#f59e0b", width: 1.5 }
      }
    ],
    plotLayout({
      margin: { l: 50, r: 12, t: 10, b: 30 },
      yaxis: {
        gridcolor: "rgba(128,128,128,0.15)",
        tickformat: ".2f"
      }
    }),
    { responsive: true, displaylogo: false }
  );
}

/* ============================================
   HISTORY TABLE
   ============================================ */

function renderTable(rows) {
  const tbody = $("#history-table");
  if (!tbody) return;

  tbody.replaceChildren();

  [...rows].reverse().slice(0, 100).forEach((row) => {
    const tr = document.createElement("tr");

    [
      dateLabel(row.date),
      money(row.open),
      money(row.high),
      money(row.low),
      money(row.close),
      number(row.volume, 0)
    ].forEach((value) => {
      const td = document.createElement("td");
      td.textContent = value;
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  const download = $("#download-button");
  if (download) download.disabled = rows.length === 0;
}

/* ============================================
   CSV EXPORT
   ============================================ */

function exportCSV() {
  if (!state.rows.length) {
    setNotice("Load historical data before exporting.", "error");
    return;
  }

  const lines = [
    ["Date", "Open", "High", "Low", "Close", "Volume"].join(","),
    ...state.rows.map((row) => [
      dateLabel(row.date),
      row.open,
      row.high,
      row.low,
      row.close,
      row.volume
    ].join(","))
  ];

  const blob = new Blob(
    ["\uFEFF" + lines.join("\r\n")],
    { type: "text/csv;charset=utf-8;" }
  );

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download =
    `${state.symbol.replace(/[^a-z0-9_-]/gi, "_")}_${state.period}.csv`;

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ============================================
   MAIN DATA LOADER
   ============================================ */

async function loadStock(symbol = state.symbol) {
  const requestId = ++state.requestId;

  state.period = $("#period-select")?.value || state.period;
  state.chartType = $("#chart-type")?.value || state.chartType;

  updateSelectedCompany(symbol);
  setLoading(true);
  setNotice(`Loading ${symbol} historical prices…`, "info");
  setConnection("Connecting to MarketScope API…");

  showMessage("#price-chart-view", "Loading market data…");

  try {
    const rows = await fetchHistory(symbol, state.period);

    // Ignore older responses if another request has started.
    if (requestId !== state.requestId) return;

    state.rows = rows;

    updateMetrics(rows);
    renderPriceChart(rows);
    renderRSI(rows);
    renderMACD(rows);
    renderTable(rows);

    setNotice(
      `Loaded ${rows.length.toLocaleString("en-IN")} records for ${symbol}.`,
      "success"
    );

    setConnection("Connected · Historical data loaded");
  } catch (error) {
    if (requestId !== state.requestId) return;

    console.error("MarketScope API error:", error);

    state.rows = [];

    safeText("#latest-close", "—");
    safeText("#session-high", "—");
    safeText("#session-low", "—");
    safeText("#period-range", "—");
    safeText("#latest-date", "");
    safeText("#daily-change", "Data unavailable");

    showMessage("#price-chart-view", "Unable to load market data. Please retry.");
    showMessage("#rsi-chart", "No indicator data available.");
    showMessage("#macd-chart", "No indicator data available.");

    safeText("#rsi-value", "RSI —");
    safeText("#macd-value", "MACD —");
    safeText("#rsi-note", "RSI will appear when market data loads.");
    safeText("#macd-note", "MACD will appear when market data loads.");
    safeText("#records-label", "No records loaded");

    const tbody = $("#history-table");
    if (tbody) {
      tbody.replaceChildren();
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 6;
      cell.textContent = "Unable to load historical records.";
      row.appendChild(cell);
      tbody.appendChild(row);
    }

    const download = $("#download-button");
    if (download) download.disabled = true;

    setNotice(
      `Could not load ${symbol}: ${error.message}`,
      "error"
    );

    setConnection("Unable to load data. Check the API and retry.", true);
  } finally {
    if (requestId === state.requestId) {
      setLoading(false);
    }
  }
}

/* ============================================
   EVENT HANDLERS
   ============================================ */

function setupEvents() {
  const search = $("#stock-search");
  const results = $("#search-results");

  if (search) {
    search.addEventListener("input", () => {
      renderSearchResults(search.value);
    });

    search.addEventListener("focus", () => {
      if (search.value.trim()) {
        renderSearchResults(search.value);
      }
    });

    search.addEventListener("keydown", (event) => {
      const items = results
        ? [...results.querySelectorAll("button.result-item")]
        : [];

      if (event.key === "Escape") {
        results?.classList.add("hidden");
        if (results) results.style.display = "none";
        return;
      }

      if (event.key === "ArrowDown" && items.length) {
        event.preventDefault();
        state.searchIndex = Math.min(
          state.searchIndex + 1,
          items.length - 1
        );
        items[state.searchIndex].focus();
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();

        const symbol = resolveSearchValue(search.value);

        if (!symbol) {
          setNotice("Enter a valid company name or ticker.", "error");
          return;
        }

        if (results) {
          results.classList.add("hidden");
          results.style.display = "none";
        }

        loadStock(symbol);
      }
    });
  }

  $("#analyze-button")?.addEventListener("click", () => {
    const value = search?.value.trim() || state.symbol;
    const symbol = resolveSearchValue(value);

    if (!symbol) {
      setNotice("Enter a valid company name or ticker.", "error");
      return;
    }

    if (results) {
      results.classList.add("hidden");
      results.style.display = "none";
    }

    loadStock(symbol);
  });

  $("#refresh-button")?.addEventListener("click", () => {
    loadStock(state.symbol);
  });

  $("#period-select")?.addEventListener("change", () => {
    loadStock(state.symbol);
  });

  $("#chart-type")?.addEventListener("change", () => {
    state.chartType = $("#chart-type").value;

    if (state.rows.length) {
      renderPriceChart(state.rows);
    }
  });

  $("#download-button")?.addEventListener("click", exportCSV);

  // Close dropdown only when the user clicks outside the search control.
  document.addEventListener("click", (event) => {
    if (
      !event.target.closest(".company-control") &&
      results
    ) {
      results.classList.add("hidden");
      results.style.display = "none";
    }
  });

  window.addEventListener("resize", () => {
    if (typeof Plotly === "undefined") return;

    ["#price-chart-view", "#rsi-chart", "#macd-chart"].forEach((selector) => {
      const element = $(selector);

      if (element && element.data) {
        try {
          Plotly.Plots.resize(element);
        } catch (error) {
          console.debug("Chart resize skipped:", error);
        }
      }
    });
  });
}

/* ============================================
   INITIALIZE
   ============================================ */

function initializeDashboard() {
  safeText(
    "#today-label",
    new Date().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    })
  );

  setupNavigation();
  setupEvents();

  if (typeof Plotly === "undefined") {
    setNotice(
      "Plotly could not load. Check your internet connection and reload.",
      "error"
    );
  }

  const search = $("#stock-search");
  if (search) search.value = "Reliance Industries";

  updateSelectedCompany(state.symbol);
  loadStock(state.symbol);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeDashboard);
} else {
  initializeDashboard();
}
