
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

function normalizeTicker(value) {
  const symbol = String(value || "").trim().replace(/\s+/g, "").toUpperCase();
  if (!symbol || symbol.startsWith("^") || symbol.includes(".")) return symbol;
  // MarketScope is focused on NSE equities; users can type RELIANCE instead of RELIANCE.NS.
  return /^[A-Z0-9_-]{1,25}$/.test(symbol) ? `${symbol}.NS` : symbol;
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
    return normalizeTicker(normalized);
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

  // Keep the active item synchronized with every navigation target.
  // A scroll-position based spy avoids IntersectionObserver ratio flicker
  // when tall sections or smooth scrolling cause several sections to overlap.
  const sections = links
    .map((link) => {
      const target = document.querySelector(link.getAttribute("href"));
      return target ? { link, target } : null;
    })
    .filter(Boolean);

  let scrollSpyQueued = false;
  function updateActiveFromScroll() {
    scrollSpyQueued = false;
    if (!sections.length) return;

    // At the very bottom, keep the last section active even if it is short.
    const atBottom = window.innerHeight + window.scrollY >=
      document.documentElement.scrollHeight - 4;
    let current = sections[0];

    if (atBottom) {
      current = sections[sections.length - 1];
    } else {
      const activationLine = 150;
      for (const section of sections) {
        if (section.target.getBoundingClientRect().top <= activationLine) {
          current = section;
        } else {
          break;
        }
      }
    }

    if (current) activate(current.link, false);
  }

  window.addEventListener("scroll", () => {
    if (scrollSpyQueued) return;
    scrollSpyQueued = true;
    window.requestAnimationFrame(updateActiveFromScroll);
  }, { passive: true });

  window.addEventListener("resize", updateActiveFromScroll, { passive: true });

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

function calculateBollingerBands(values, period = 20, deviations = 2) {
  const middle = movingAverage(values, period);
  const upper = Array(values.length).fill(null);
  const lower = Array(values.length).fill(null);

  for (let i = period - 1; i < values.length; i++) {
    const slice = values.slice(i - period + 1, i + 1);
    const mean = middle[i];
    const variance = slice.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / period;
    const standardDeviation = Math.sqrt(variance);
    upper[i] = mean + deviations * standardDeviation;
    lower[i] = mean - deviations * standardDeviation;
  }

  return { middle, upper, lower };
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

  const ema20 = calculateEMA(closes, 20);
  const bands = calculateBollingerBands(closes, 20, 2);
  traces.push({
    type: "scatter", mode: "lines", name: "EMA 20", x: dates, y: ema20,
    connectgaps: false, line: { color: "#0f9d8a", width: 1.5 }
  });
  traces.push({
    type: "scatter", mode: "lines", name: "Bollinger upper", x: dates, y: bands.upper,
    connectgaps: false, line: { color: "rgba(100,116,139,0.75)", width: 1, dash: "dot" }
  });
  traces.push({
    type: "scatter", mode: "lines", name: "Bollinger lower", x: dates, y: bands.lower,
    connectgaps: false, line: { color: "rgba(100,116,139,0.75)", width: 1, dash: "dot", fill: "tonexty", fillcolor: "rgba(148,163,184,0.08)" }
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

function renderVolume(rows) {
  const element = $("#volume-chart");
  if (!element || typeof Plotly === "undefined") return;
  const dates = rows.map((row) => row.date);
  const volumes = rows.map((row) => Number.isFinite(row.volume) ? row.volume : 0);
  const latest = volumes.length ? volumes[volumes.length - 1] : 0;
  safeText("#volume-value", `Volume ${latest.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`);
  element.replaceChildren();
  Plotly.newPlot(element, [{
    type: "bar", name: "Volume", x: dates, y: volumes,
    marker: { color: rows.map((row) => row.close >= row.open ? "#16a34a" : "#dc2626") },
    hovertemplate: "%{x|%d %b %Y}<br>Volume: %{y:,}<extra></extra>"
  }], {
    ...plotLayout(),
    yaxis: { gridcolor: "rgba(128,128,128,0.15)", tickformat: ",.0f", title: "Shares" },
    margin: { l: 55, r: 18, t: 12, b: 40 }
  }, { responsive: true, displaylogo: false });
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
    renderVolume(rows);
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
    showMessage("#volume-chart", "No volume data available.");
    safeText("#volume-value", "Volume —");

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
   PERSONAL WATCHLIST (browser localStorage)
   ============================================ */
const WATCHLIST_KEY = "marketscope.watchlist.v1";

function getWatchlist() {
  try {
    const value = JSON.parse(localStorage.getItem(WATCHLIST_KEY) || "[]");
    return Array.isArray(value) ? [...new Set(value.filter((s) => typeof s === "string" && /^[A-Z0-9.^=_-]{1,30}$/.test(s)))] : [];
  } catch (error) {
    return [];
  }
}

function saveWatchlist(symbols) {
  try {
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify([...new Set(symbols)]));
    return true;
  } catch (error) {
    safeText("#watchlist-message", "Could not save in this browser. Check storage settings.");
    return false;
  }
}

function watchlistCompany(symbol) {
  return getCompanyName(symbol);
}

function renderWatchlist() {
  const container = $("#watchlist-items");
  if (!container) return;
  const symbols = getWatchlist();
  container.replaceChildren();
  if (!symbols.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "Your watchlist is empty. Analyze a stock, then choose “Add current stock”.";
    container.appendChild(empty);
    return;
  }
  symbols.forEach((symbol) => {
    const card = document.createElement("article");
    card.className = "watchlist-item";
    card.dataset.symbol = symbol;
    const head = document.createElement("div"); head.className = "watchlist-item-head";
    const names = document.createElement("div");
    const title = document.createElement("h3"); title.textContent = watchlistCompany(symbol);
    const ticker = document.createElement("div"); ticker.className = "ticker"; ticker.textContent = symbol;
    names.append(title, ticker);
    const remove = document.createElement("button"); remove.type = "button"; remove.className = "watchlist-remove"; remove.textContent = "Remove"; remove.setAttribute("aria-label", `Remove ${symbol} from watchlist`);
    remove.addEventListener("click", () => {
      saveWatchlist(getWatchlist().filter((item) => item !== symbol));
      safeText("#watchlist-message", `${symbol} removed from your watchlist.`);
      renderWatchlist();
    });
    head.append(names, remove);
    const price = document.createElement("div"); price.className = "watchlist-price"; price.textContent = "Loading price…";
    const change = document.createElement("div"); change.className = "watchlist-change"; change.textContent = "Fetching latest available data";
    const actions = document.createElement("div"); actions.className = "watchlist-item-actions";
    const view = document.createElement("button"); view.type = "button"; view.textContent = "Open analysis";
    view.addEventListener("click", () => { loadStock(symbol); window.location.hash = "price-chart"; $("#price-chart")?.scrollIntoView({behavior:"smooth", block:"start"}); });
    actions.appendChild(view);
    card.append(head, price, change, actions);
    container.appendChild(card);
  });
  refreshWatchlistPrices();
}

async function refreshWatchlistPrices() {
  const cards = [...document.querySelectorAll(".watchlist-item")];
  if (!cards.length) return;
  safeText("#watchlist-message", "Refreshing latest available daily prices…");
  await Promise.all(cards.map(async (card) => {
    const symbol = card.dataset.symbol;
    const price = card.querySelector(".watchlist-price");
    const change = card.querySelector(".watchlist-change");
    try {
      const rows = await fetchHistory(symbol, "1mo");
      if (!card.isConnected) return;
      const latest = rows[rows.length - 1];
      const previous = rows.length > 1 ? rows[rows.length - 2] : latest;
      const delta = latest.close - previous.close;
      const pct = previous.close ? delta / previous.close * 100 : 0;
      price.textContent = money(latest.close);
      change.textContent = `${delta >= 0 ? "+" : ""}${money(delta)} (${pct >= 0 ? "+" : ""}${number(pct)}%) · ${dateLabel(latest.date)}`;
      change.style.color = delta >= 0 ? "#159b68" : "#dc4545";
    } catch (error) {
      if (!card.isConnected) return;
      price.textContent = "Price unavailable";
      change.textContent = "Check ticker or retry later";
      change.style.color = "var(--muted)";
    }
  }));
  safeText("#watchlist-message", "Prices show the latest available daily close; they may not be real-time.");
}

function addCurrentStockToWatchlist() {
  const symbols = getWatchlist();
  if (symbols.includes(state.symbol)) {
    safeText("#watchlist-message", `${state.symbol} is already in your watchlist.`);
    return;
  }
  if (symbols.length >= 30) {
    safeText("#watchlist-message", "Your watchlist is limited to 30 stocks to keep refreshes manageable.");
    return;
  }
  if (saveWatchlist([...symbols, state.symbol])) {
    safeText("#watchlist-message", `${state.symbol} added to your watchlist.`);
    renderWatchlist();
  }
}

/* ============================================
   EVENT HANDLERS
   ============================================ */

async function runStockComparison() {
  const input = $("#comparison-symbols");
  const button = $("#compare-button");
  const message = $("#comparison-message");
  const table = $("#comparison-table");
  const chart = $("#comparison-chart");
  if (!input || !button || !message || !table || !chart) return;

  const symbols = [...new Set(input.value.split(",").map((s) => normalizeTicker(s)).filter(Boolean))];
  if (!symbols.length) {
    message.textContent = "Enter at least one stock ticker.";
    return;
  }
  if (symbols.length > 5) {
    message.textContent = "Please compare no more than five stocks at a time.";
    return;
  }
  if (symbols.some((s) => !/^[A-Z0-9.^=_-]{1,30}$/.test(s))) {
    message.textContent = "One or more tickers contain unsupported characters.";
    return;
  }

  button.disabled = true;
  button.textContent = "Loading…";
  message.textContent = "Fetching historical prices for each ticker…";
  table.replaceChildren();
  chart.innerHTML = '<div class="loading">Loading comparison data…</div>';
  const period = $("#period-select")?.value || "1y";
  const outcomes = await Promise.all(symbols.map(async (symbol) => {
    try {
      const rows = await fetchHistory(symbol, period);
      return { symbol, rows };
    } catch (error) {
      return { symbol, error: error.message || "Data unavailable" };
    }
  }));
  const valid = outcomes.filter((item) => item.rows?.length);
  const failed = outcomes.filter((item) => item.error);

  if (!valid.length) {
    message.textContent = `Could not load any requested stocks. ${failed.map((x) => `${x.symbol}: ${x.error}`).join("; ")}`;
    chart.innerHTML = '<div class="loading">No comparison data available.</div>';
    table.innerHTML = '<tr><td colspan="4">No valid stocks returned data.</td></tr>';
    button.disabled = false;
    button.textContent = "Compare →";
    return;
  }

  const traces = valid.map(({ symbol, rows }) => {
    const first = rows[0].close;
    return {
      x: rows.map((r) => r.date),
      y: rows.map((r) => ((r.close / first) - 1) * 100),
      type: "scatter", mode: "lines", name: symbol,
      hovertemplate: `${symbol}<br>%{x|%d %b %Y}<br>%{y:.2f}% return<extra></extra>`
    };
  });
  if (typeof Plotly !== "undefined") {
    Plotly.newPlot(chart, traces, {
      autosize: true, margin: { l: 52, r: 18, t: 20, b: 45 },
      paper_bgcolor: "transparent", plot_bgcolor: "transparent",
      font: { color: "#9aa8bd", family: "DM Sans, sans-serif" },
      xaxis: { gridcolor: "rgba(148,163,184,.12)", zeroline: false },
      yaxis: { title: "Return (%)", ticksuffix: "%", gridcolor: "rgba(148,163,184,.12)", zeroline: true, zerolinecolor: "rgba(148,163,184,.35)" },
      legend: { orientation: "h", y: 1.12 },
      hovermode: "x unified"
    }, { responsive: true, displaylogo: false });
  } else {
    chart.innerHTML = '<div class="loading">Chart library unavailable. Reload and try again.</div>';
  }

  valid.forEach(({ symbol, rows }) => {
    const first = rows[0].close;
    const latest = rows[rows.length - 1].close;
    const change = ((latest / first) - 1) * 100;
    const tr = document.createElement("tr");
    [symbol, new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(first), new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(latest), `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`].forEach((value, i) => {
      const td = document.createElement("td");
      td.textContent = value;
      if (i === 3) td.className = change >= 0 ? "positive" : "negative";
      tr.appendChild(td);
    });
    table.appendChild(tr);
  });
  message.textContent = `${valid.length} of ${symbols.length} stocks loaded for ${period}. Returns are measured from each stock’s first available close in the selected period.${failed.length ? ` Unavailable: ${failed.map((x) => x.symbol).join(", ")}.` : ""}`;
  button.disabled = false;
  button.textContent = "Compare →";
}

const SCREENER_UNIVERSE = STOCKS.filter((stock) => !stock.symbol.startsWith("^") && stock.symbol.endsWith(".NS"));

function calculateRsi(closes, period = 14) {
  if (closes.length <= period) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const delta = closes[i] - closes[i - 1];
    if (delta > 0) gains += delta; else losses -= delta;
  }
  let avgGain = gains / period, avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const delta = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(delta, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-delta, 0)) / period;
  }
  if (avgLoss === 0) return 100;
  return 100 - (100 / (1 + avgGain / avgLoss));
}

async function runStockScreener() {
  const button = $("#screener-run"), message = $("#screener-message"), table = $("#screener-table");
  if (!button || !message || !table) return;
  button.disabled = true; button.textContent = "Screening…";
  message.textContent = `Fetching ${SCREENER_UNIVERSE.length} NSE stocks. This may take a little while…`;
  table.innerHTML = '<tr><td colspan="6">Loading historical data…</td></tr>';
  const period = $("#screener-period")?.value || "6mo";
  const minReturn = Number($("#screener-return")?.value ?? -100);
  const trendFilter = $("#screener-trend")?.value || "all";
  const results = await Promise.all(SCREENER_UNIVERSE.map(async (stock) => {
    try {
      const rows = await fetchHistory(stock.symbol, period);
      const closes = rows.map((row) => row.close).filter((v) => Number.isFinite(v));
      if (closes.length < 2) throw new Error("Insufficient history");
      const latest = closes[closes.length - 1], first = closes[0];
      const sma20 = closes.length >= 20 ? closes.slice(-20).reduce((a, b) => a + b, 0) / 20 : null;
      const rsi = calculateRsi(closes);
      const change = ((latest / first) - 1) * 100;
      const trend = sma20 == null ? "Insufficient data" : latest >= sma20 ? "Bullish" : "Bearish";
      return { ...stock, latest, change, rsi, sma20, trend };
    } catch (error) { return { ...stock, error: error.message || "Data unavailable" }; }
  }));
  const failed = results.filter((item) => item.error);
  const filtered = results.filter((item) => !item.error && item.change >= minReturn &&
    (trendFilter === "all" || (trendFilter === "bullish" && item.trend === "Bullish") || (trendFilter === "bearish" && item.trend === "Bearish")))
    .sort((a, b) => b.change - a.change);
  table.replaceChildren();
  if (!filtered.length) table.innerHTML = '<tr><td colspan="6">No stocks match these filters. Try broadening your criteria.</td></tr>';
  filtered.forEach((stock) => {
    const tr = document.createElement("tr");
    const cells = [stock.name, new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(stock.latest), `${stock.change >= 0 ? "+" : ""}${stock.change.toFixed(2)}%`, stock.rsi == null ? "—" : stock.rsi.toFixed(1), stock.sma20 == null ? "—" : `${stock.latest >= stock.sma20 ? "+" : "−"}${(Math.abs(stock.latest / stock.sma20 - 1) * 100).toFixed(2)}%`, stock.trend];
    cells.forEach((value, index) => { const td = document.createElement("td"); td.textContent = value; if (index === 2) td.className = stock.change >= 0 ? "positive" : "negative"; if (index === 5) td.className = stock.trend === "Bullish" ? "positive" : stock.trend === "Bearish" ? "negative" : ""; tr.appendChild(td); });
    const tickerCell = tr.firstElementChild; tickerCell.title = stock.symbol; tickerCell.textContent = `${stock.name} (${stock.symbol.replace(/\.NS$/, "")})`;
    table.appendChild(tr);
  });
  message.textContent = `${filtered.length} stock${filtered.length === 1 ? "" : "s"} match your filters from ${results.length - failed.length} stocks with data for ${period}.${failed.length ? ` ${failed.length} stocks were unavailable.` : ""}`;
  button.disabled = false; button.textContent = "Screen stocks →";
}

async function runForecast() {
  const button = $("#forecast-run"), message = $("#forecast-message"), chart = $("#forecast-chart"), table = $("#forecast-table");
  if (!button || !message || !chart || !table) return;
  const rawSymbol = ($("#forecast-symbol")?.value || state.symbol || "RELIANCE").trim().toUpperCase();
  const symbol = rawSymbol.replace(/\.NS$/, "");
  if (!/^[A-Z0-9.^=_-]{1,30}$/.test(symbol)) {
    message.textContent = "Enter a valid stock ticker.";
    return;
  }
  const period = $("#forecast-period")?.value || "2y";
  const horizon = $("#forecast-horizon")?.value || "10";
  const model = $("#forecast-model")?.value || "sma5";
  button.disabled = true; button.textContent = "Evaluating…";
  message.textContent = "Fetching historical data and evaluating the model on a chronological holdout set…";
  table.innerHTML = '<tr><td colspan="2">Calculating forecast…</td></tr>';
  try {
    const url = new URL(`${API_BASE}/api/forecast`);
    url.searchParams.set("symbol", symbol);
    url.searchParams.set("period", period);
    url.searchParams.set("horizon", horizon);
    url.searchParams.set("model", model);
    const response = await fetch(url.toString());
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.detail || "Forecast request failed.");
    const historyRows = payload.history || [], forecastRows = payload.forecast || [];
    if (!historyRows.length || !forecastRows.length) throw new Error("Not enough data to plot a forecast.");
    const fmt = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value);
    safeText("#forecast-mae", fmt(payload.evaluation.mae));
    safeText("#forecast-rmse", fmt(payload.evaluation.rmse));
    safeText("#forecast-mape", payload.evaluation.mape == null ? "—" : `${payload.evaluation.mape.toFixed(2)}%`);
    safeText("#forecast-tests", String(payload.evaluation.test_points));
    table.replaceChildren();
    forecastRows.forEach((item) => {
      const tr = document.createElement("tr");
      const dateCell = document.createElement("td"); dateCell.textContent = item.date;
      const priceCell = document.createElement("td"); priceCell.textContent = fmt(item.close);
      tr.append(dateCell, priceCell); table.appendChild(tr);
    });
    if (typeof Plotly === "undefined") throw new Error("Plotly did not load. Check your internet connection.");
    const lastHistory = historyRows[historyRows.length - 1];
    const forecastDates = [lastHistory.date, ...forecastRows.map((item) => item.date)];
    const forecastValues = [lastHistory.close, ...forecastRows.map((item) => item.close)];
    Plotly.newPlot(chart, [
      { x: historyRows.map((item) => item.date), y: historyRows.map((item) => item.close), type: "scatter", mode: "lines", name: "Historical close", line: { width: 2 } },
      { x: forecastDates, y: forecastValues, type: "scatter", mode: "lines+markers", name: "Baseline estimate", line: { dash: "dash", width: 2 }, marker: { size: 5 } }
    ], {
      paper_bgcolor: "rgba(0,0,0,0)", plot_bgcolor: "rgba(0,0,0,0)", font: { color: "#9aa8bd", family: "DM Sans, sans-serif" },
      margin: { l: 60, r: 20, t: 20, b: 50 }, xaxis: { gridcolor: "rgba(148,163,184,.12)", title: "Date" },
      yaxis: { gridcolor: "rgba(148,163,184,.12)", title: "Adjusted close (₹)" }, legend: { orientation: "h", y: 1.12 }, hovermode: "x unified"
    }, { responsive: true, displaylogo: false });
    message.textContent = `${payload.symbol} · ${model === "sma5" ? "5-day moving average" : "last-close naïve model"} · evaluated on ${payload.evaluation.test_points} later observations. ${payload.note}`;
  } catch (error) {
    message.textContent = error.message || "Could not generate forecast. Please try again.";
    chart.innerHTML = '<div class="loading">Forecast unavailable. Check the ticker or try a longer history.</div>';
    table.innerHTML = '<tr><td colspan="2">No forecast available.</td></tr>';
    ["#forecast-mae", "#forecast-rmse", "#forecast-mape", "#forecast-tests"].forEach((selector) => safeText(selector, "—"));
  } finally {
    button.disabled = false; button.textContent = "Run forecast →";
  }
}

function portfolioEscape(value) { return String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch])); }

/* ============================================
   STEP 6: PORTFOLIO TRACKER (localStorage)
   ============================================ */
const PORTFOLIO_KEY = "marketscope.portfolio.transactions.v1";
let portfolioPrices = {};
let portfolioPriceLoad = false;
function readPortfolioTransactions() {
  try {
    const value = JSON.parse(localStorage.getItem(PORTFOLIO_KEY) || "[]");
    return Array.isArray(value) ? value.filter(t => t && t.id && t.symbol && ["BUY", "SELL"].includes(t.action)) : [];
  } catch { return []; }
}
function savePortfolioTransactions(items) {
  localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(items));
}
function portfolioModel(transactions) {
  const holdings = {};
  let realized = 0;
  const ordered = [...transactions].sort((a,b) => String(a.date).localeCompare(String(b.date)) || Number(a.createdAt || 0)-Number(b.createdAt || 0));
  for (const t of ordered) {
    const symbol = normalizeTicker(t.symbol);
    const qty = Number(t.quantity), price = Number(t.price);
    if (!symbol || !(qty > 0) || !(price > 0)) continue;
    const h = holdings[symbol] ||= {symbol, quantity:0, cost:0, realized:0};
    if (t.action === "BUY") { h.quantity += qty; h.cost += qty * price; }
    else {
      const sold = Math.min(qty, h.quantity);
      if (h.quantity > 0 && sold > 0) {
        const avg = h.cost / h.quantity;
        const pnl = (price - avg) * sold;
        h.realized += pnl; realized += pnl;
        h.cost -= avg * sold; h.quantity -= sold;
        if (h.quantity < 1e-8) { h.quantity = 0; h.cost = 0; }
      }
    }
  }
  return {holdings:Object.values(holdings).filter(h=>h.quantity>1e-8), realized};
}
function moneyINR(value) { return Number.isFinite(value) ? value.toLocaleString("en-IN", {style:"currency",currency:"INR",minimumFractionDigits:2,maximumFractionDigits:2}) : "—"; }
function pnlClass(value) { return value > 0 ? "positive" : value < 0 ? "negative" : ""; }
function renderPortfolio() {
  const txns = readPortfolioTransactions();
  const model = portfolioModel(txns);
  const tbody = $("#portfolio-ledger");
  if (tbody) tbody.innerHTML = txns.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date)) || Number(b.createdAt||0)-Number(a.createdAt||0)).map(t=>`<tr><td>${portfolioEscape(t.date)}</td><td>${portfolioEscape(t.symbol)}</td><td>${t.action === "BUY" ? "Buy" : "Sell"}</td><td>${Number(t.quantity).toLocaleString("en-IN")}</td><td>${moneyINR(Number(t.price))}</td><td>${moneyINR(Number(t.quantity)*Number(t.price))}</td><td><button class="btn quiet portfolio-delete" data-id="${portfolioEscape(t.id)}" type="button" aria-label="Delete transaction">Delete</button></td></tr>`).join("") || '<tr><td colspan="7">No transactions recorded.</td></tr>';
  const invested = model.holdings.reduce((sum,h)=>sum+h.cost,0);
  const marketValue = model.holdings.reduce((sum,h)=>sum+h.quantity*(portfolioPrices[h.symbol] ?? (h.cost/Math.max(h.quantity,1e-12))),0);
  const unrealized = model.holdings.reduce((sum,h)=>sum+h.quantity*(portfolioPrices[h.symbol] ?? (h.cost/Math.max(h.quantity,1e-12)))-h.cost,0);
  safeText("#portfolio-invested", moneyINR(invested)); safeText("#portfolio-value", moneyINR(marketValue));
  safeText("#portfolio-unrealized", moneyINR(unrealized)); safeText("#portfolio-realized", moneyINR(model.realized));
  const holdingsBody = $("#portfolio-holdings");
  if (holdingsBody) holdingsBody.innerHTML = model.holdings.map(h=>{const price=portfolioPrices[h.symbol]; const avg=h.cost/h.quantity; const mv=h.quantity*(price ?? avg); const pnl=mv-h.cost; return `<tr><td>${portfolioEscape(h.symbol.replace(/\.NS$/,""))}</td><td>${h.quantity.toLocaleString("en-IN",{maximumFractionDigits:6})}</td><td>${moneyINR(avg)}</td><td>${price == null ? "Not loaded" : moneyINR(price)}</td><td>${moneyINR(mv)}</td><td class="${pnlClass(pnl)}">${moneyINR(pnl)}</td></tr>`;}).join("") || '<tr><td colspan="6">No holdings yet. Add a buy transaction.</td></tr>';
  const alloc = $("#portfolio-allocation");
  if (alloc) {
    if (typeof Plotly !== "undefined" && model.holdings.length) {
      Plotly.react(alloc,[{type:"pie",labels:model.holdings.map(h=>h.symbol.replace(/\.NS$/,"")),values:model.holdings.map(h=>h.quantity*(portfolioPrices[h.symbol] ?? h.cost/h.quantity)),hole:.55,textinfo:"label+percent",hovertemplate:"%{label}<br>₹%{value:,.2f}<extra></extra>"}],{paper_bgcolor:"transparent",plot_bgcolor:"transparent",font:{color:"#dbe5f5"},margin:{t:10,r:10,b:10,l:10},showlegend:false},{responsive:true,displayModeBar:false});
    } else if (!model.holdings.length) alloc.innerHTML='<div class="loading">Add holdings to view allocation.</div>';
  }
  const msg = $("#portfolio-message");
  if (msg && !txns.length) msg.textContent="Add a buy transaction to get started. Portfolio data is saved only in this browser.";
  else if (msg && !portfolioPriceLoad) msg.textContent=`${model.holdings.length} active holding${model.holdings.length===1?"":"s"} · ${txns.length} transaction${txns.length===1?"":"s"}. Refresh prices for latest available closes.`;
}
async function refreshPortfolioPrices() {
  const {holdings} = portfolioModel(readPortfolioTransactions());
  if (!holdings.length) { renderPortfolio(); return; }
  portfolioPriceLoad = true;
  safeText("#portfolio-message", "Fetching latest available closing prices…");
  const results = await Promise.all(holdings.map(async h=>{
    try { const rows=await fetchHistory(h.symbol,"1mo"); return [h.symbol, rows[rows.length-1].close]; }
    catch (error) { console.warn("Portfolio price unavailable for",h.symbol,error); return [h.symbol,null]; }
  }));
  results.forEach(([symbol,price])=>{ if(price != null) portfolioPrices[symbol]=price; });
  portfolioPriceLoad = false;
  renderPortfolio();
  const unavailable=results.filter(([,price])=>price==null).map(([symbol])=>symbol.replace(/\.NS$/,""));
  safeText("#portfolio-message", unavailable.length ? `Prices refreshed where available. Could not fetch: ${unavailable.join(", ")}.` : `Prices updated for ${results.length} holding${results.length===1?"":"s"} using the latest available daily close.`);
}
function setupPortfolio() {
  const date = $("#portfolio-date"); if (date) date.value = new Date().toISOString().slice(0,10);
  $("#portfolio-form")?.addEventListener("submit", event=>{
    event.preventDefault();
    const rawSymbol=$("#portfolio-symbol")?.value || "";
    const symbol=normalizeTicker(rawSymbol);
    const action=$("#portfolio-action")?.value || "BUY";
    const quantity=Number($("#portfolio-quantity")?.value), price=Number($("#portfolio-price")?.value), dateValue=$("#portfolio-date")?.value;
    if (!symbol || !/^[A-Z0-9.^=_-]{1,35}$/.test(symbol) || !(quantity>0) || !(price>0) || !dateValue) { safeText("#portfolio-message","Enter a valid ticker, positive quantity and price, and transaction date."); return; }
    if (action === "SELL") {
      const h=portfolioModel(readPortfolioTransactions()).holdings.find(x=>x.symbol===symbol);
      if (!h || quantity > h.quantity + 1e-8) { safeText("#portfolio-message",`Cannot sell ${quantity}. Current tracked quantity for ${symbol.replace(/\.NS$/," ").trim()} is ${h ? h.quantity : 0}.`); return; }
    }
    const txns=readPortfolioTransactions();
    txns.push({id:`txn-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,symbol,action,quantity,price,date:dateValue,createdAt:Date.now()});
    try { savePortfolioTransactions(txns); } catch { safeText("#portfolio-message","Could not save to browser storage. Check browser storage settings or available space."); return; }
    event.target.reset(); if(date) date.value=new Date().toISOString().slice(0,10);
    renderPortfolio(); safeText("#portfolio-message",`${action === "BUY" ? "Purchase" : "Sale"} recorded for ${symbol.replace(/\.NS$/," ").trim()}.`);
  });
  $("#portfolio-ledger")?.addEventListener("click",event=>{
    const button=event.target.closest("button[data-id]"); if(!button)return;
    const txn=readPortfolioTransactions().find(t=>t.id===button.dataset.id);
    if(!txn || !confirm(`Delete this ${txn.action.toLowerCase()} transaction for ${txn.symbol}?`)) return;
    savePortfolioTransactions(readPortfolioTransactions().filter(t=>t.id!==button.dataset.id)); renderPortfolio(); safeText("#portfolio-message","Transaction deleted and portfolio recalculated.");
  });
  $("#portfolio-refresh")?.addEventListener("click",refreshPortfolioPrices);
  $("#portfolio-clear")?.addEventListener("click",()=>{ if(!readPortfolioTransactions().length)return; if(confirm("Clear all portfolio transactions from this browser? This cannot be undone unless you exported a backup.")){savePortfolioTransactions([]);portfolioPrices={};renderPortfolio();safeText("#portfolio-message","Portfolio cleared.");} });
  $("#portfolio-export")?.addEventListener("click",()=>{
    const txns=readPortfolioTransactions(); if(!txns.length){safeText("#portfolio-message","There are no transactions to export yet.");return;}
    const quote=v=>`"${String(v).replace(/"/g,'""')}"`;
    const csv=[["Date","Ticker","Action","Quantity","Price per share INR","Total INR"],...txns.map(t=>[t.date,t.symbol,t.action,t.quantity,t.price,(Number(t.quantity)*Number(t.price)).toFixed(2)])].map(row=>row.map(quote).join(",")).join("\r\n");
    const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"}), url=URL.createObjectURL(blob), a=document.createElement("a"); a.href=url; a.download="marketscope-portfolio-transactions.csv"; a.click(); URL.revokeObjectURL(url);
  });
  renderPortfolio();
}

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
  $("#watchlist-add")?.addEventListener("click", addCurrentStockToWatchlist);
  $("#watchlist-refresh")?.addEventListener("click", refreshWatchlistPrices);
  $("#compare-button")?.addEventListener("click", runStockComparison);
  $("#screener-run")?.addEventListener("click", runStockScreener);
  $("#forecast-run")?.addEventListener("click", runForecast);

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

    ["#price-chart-view", "#rsi-chart", "#macd-chart", "#comparison-chart", "#forecast-chart"].forEach((selector) => {
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
  renderWatchlist();
  setupPortfolio();

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
