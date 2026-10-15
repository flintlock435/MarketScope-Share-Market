
"use strict";

/* =========================================
   MarketScope - Share Market Forecasting
   Backend: Render + FastAPI + yfinance
   ========================================= */

const API_BASE = "https://marketscope-api-6svt.onrender.com";

const PERIODS = {
  "1mo": "1 Month",
  "3mo": "3 Months",
  "6mo": "6 Months",
  "1y": "1 Year",
  "2y": "2 Years",
  "5y": "5 Years",
  "10y": "10 Years",
  "15y": "15 Years"
};

const DEFAULT_SYMBOL = "RELIANCE.NS";

let stockData = [];
let currentSymbol = DEFAULT_SYMBOL;
let currentPeriod = "1y";
let priceChart = null;

/* ---------- DOM helpers ---------- */

function findElement(...selectors) {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) return element;
  }
  return null;
}

function setText(element, value) {
  if (element) element.textContent = value;
}

function formatNumber(value, decimals = 2) {
  const number = Number(value);

  if (!Number.isFinite(number)) return "—";

  return number.toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

function formatPrice(value) {
  if (!Number.isFinite(Number(value))) return "—";

  return "₹" + Number(value).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatDate(value) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

/* ---------- UI element lookup ---------- */

/*
  These selectors support several common HTML naming conventions.
  If your HTML uses different IDs, update the selectors below.
*/

function getSearchInput() {
  return findElement(
    "#symbol",
    "#stockSymbol",
    "#stockInput",
    "#searchInput",
    "#stockSearch",
    'input[name="symbol"]',
    'input[name="stock"]'
  );
}

function getPeriodInput() {
  return findElement(
    "#period",
    "#timePeriod",
    "#periodSelect",
    "#range",
    'select[name="period"]'
  );
}

function getSearchButton() {
  return findElement(
    "#searchBtn",
    "#searchButton",
    "#analyzeBtn",
    "#analyzeButton",
    "#loadStock",
    "#fetchData"
  );
}

function getChartCanvas() {
  return findElement(
    "#priceChart",
    "#stockChart",
    "#chart",
    "#stockPriceChart",
    "canvas"
  );
}

function getStatusElement() {
  return findElement("#status", "#errorMessage", "#message", "#loadingMessage");
}

/* ---------- Status messages ---------- */

function showStatus(message, type = "info") {
  let element = getStatusElement();

  if (!element) {
    element = document.createElement("div");
    element.id = "marketscope-status";
    element.setAttribute("role", "status");

    const main = findElement("main", ".container", "#app") || document.body;
    main.prepend(element);
  }

  element.textContent = message;
  element.dataset.type = type;

  element.style.padding = "10px 12px";
  element.style.margin = "12px 0";
  element.style.borderRadius = "8px";
  element.style.fontSize = "14px";
  element.style.display = message ? "block" : "none";

  if (type === "error") {
    element.style.color = "#b91c1c";
    element.style.background = "#fee2e2";
  } else if (type === "success") {
    element.style.color = "#166534";
    element.style.background = "#dcfce7";
  } else {
    element.style.color = "inherit";
    element.style.background = "rgba(128,128,128,0.12)";
  }
}

function setLoading(loading) {
  const button = getSearchButton();

  if (button) {
    if (!button.dataset.originalText) {
      button.dataset.originalText = button.textContent.trim() || "Analyze";
    }

    button.disabled = loading;
    button.textContent = loading
      ? "Loading..."
      : button.dataset.originalText;
  }

  const input = getSearchInput();

  if (input) input.disabled = loading;
}

/* ---------- API requests ---------- */

async function fetchData(symbol, period = currentPeriod) {
  const cleanSymbol = String(symbol || "").trim().toUpperCase();

  if (!cleanSymbol) {
    throw new Error("Enter a stock symbol first.");
  }

  if (!Object.prototype.hasOwnProperty.call(PERIODS, period)) {
    throw new Error("Please select a valid historical period.");
  }

  const url = new URL(`${API_BASE}/api/history`);
  url.searchParams.set("symbol", cleanSymbol);
  url.searchParams.set("period", period);

  let response;

  try {
    response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json"
      },
      cache: "no-store"
    });
  } catch (error) {
    throw new Error(
      "Could not connect to the stock server. Check your internet connection and try again."
    );
  }

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error("The stock server returned an invalid response.");
  }

  if (!response.ok) {
    const detail = typeof result.detail === "string"
      ? result.detail
      : `HTTP ${response.status}`;

    throw new Error(detail);
  }

  if (!result || !Array.isArray(result.data)) {
    throw new Error("The server response did not contain stock history.");
  }

  const rows = result.data
    .map((item) => ({
      date: new Date(item.date),
      open: Number(item.open),
      high: Number(item.high),
      low: Number(item.low),
      close: Number(item.close),
      volume: Number(item.volume ?? 0)
    }))
    .filter((item) =>
      !Number.isNaN(item.date.getTime()) &&
      Number.isFinite(item.close)
    )
    .sort((a, b) => a.date - b.date);

  if (rows.length === 0) {
    throw new Error(
      `No historical prices were returned for ${cleanSymbol}. Check the symbol and try again.`
    );
  }

  return rows;
}

/* ---------- Stock calculations ---------- */

function calculateStatistics(data) {
  if (!data.length) return null;

  const latest = data[data.length - 1];
  const first = data[0];

  const previous = data.length > 1
    ? data[data.length - 2]
    : latest;

  const change = latest.close - previous.close;

  const changePercent = previous.close !== 0
    ? (change / previous.close) * 100
    : 0;

  const periodChange = latest.close - first.close;

  const periodChangePercent = first.close !== 0
    ? (periodChange / first.close) * 100
    : 0;

  const highest = data.reduce(
    (best, item) => item.high > best.high ? item : best,
    data[0]
  );

  const lowest = data.reduce(
    (best, item) => item.low < best.low ? item : best,
    data[0]
  );

  const averageClose =
    data.reduce((sum, item) => sum + item.close, 0) / data.length;

  return {
    latest,
    previous,
    change,
    changePercent,
    periodChange,
    periodChangePercent,
    highest,
    lowest,
    averageClose
  };
}

/* ---------- Summary cards ---------- */

function updateSummary(data) {
  const stats = calculateStatistics(data);
  if (!stats) return;

  const changeClass = stats.change >= 0 ? "positive" : "negative";

  const values = {
    price: formatPrice(stats.latest.close),
    currentPrice: formatPrice(stats.latest.close),
    close: formatPrice(stats.latest.close),
    change: `${stats.change >= 0 ? "+" : ""}${formatPrice(stats.change)}`,
    changePercent: `${stats.changePercent >= 0 ? "+" : ""}${formatNumber(stats.changePercent)}%`,
    periodChange: `${stats.periodChange >= 0 ? "+" : ""}${formatPrice(stats.periodChange)}`,
    periodChangePercent: `${stats.periodChangePercent >= 0 ? "+" : ""}${formatNumber(stats.periodChangePercent)}%`,
    high: formatPrice(stats.highest.high),
    low: formatPrice(stats.lowest.low),
    average: formatPrice(stats.averageClose),
    volume: formatNumber(stats.latest.volume, 0),
    date: formatDate(stats.latest.date)
  };

  const selectors = {
    price: ["#currentPrice", "#stockPrice", "#latestPrice", "[data-stat='price']"],
    currentPrice: ["#current-price"],
    close: ["#closePrice"],
    change: ["#priceChange", "#change", "[data-stat='change']"],
    changePercent: ["#changePercent", "#change-percentage", "[data-stat='change-percent']"],
    periodChange: ["#periodChange"],
    periodChangePercent: ["#periodChangePercent"],
    high: ["#dayHigh", "#highPrice", "#highestPrice", "[data-stat='high']"],
    low: ["#dayLow", "#lowPrice", "#lowestPrice", "[data-stat='low']"],
    average: ["#averagePrice", "#avgPrice", "[data-stat='average']"],
    volume: ["#volume", "#tradingVolume", "[data-stat='volume']"],
    date: ["#lastUpdated", "#latestDate", "[data-stat='date']"]
  };

  for (const [key, selectorList] of Object.entries(selectors)) {
    const element = findElement(...selectorList);
    if (element) {
      setText(element, values[key]);
    }
  }

  const changeElement = findElement(
    "#priceChange",
    "#change",
    "[data-stat='change']"
  );

  if (changeElement) {
    changeElement.classList.remove("positive", "negative");
    changeElement.classList.add(changeClass);
    changeElement.style.color = stats.change >= 0 ? "#16a34a" : "#dc2626";
  }

  const percentageElement = findElement(
    "#changePercent",
    "#change-percentage",
    "[data-stat='change-percent']"
  );

  if (percentageElement) {
    percentageElement.style.color =
      stats.changePercent >= 0 ? "#16a34a" : "#dc2626";
  }

  updateStockHeading(currentSymbol);
  updateHistoryTable(data);
}

/* ---------- Stock heading ---------- */

function updateStockHeading(symbol) {
  const heading = findElement(
    "#stockName",
    "#stockTitle",
    "#selectedStock",
    "#companyName"
  );

  if (heading) setText(heading, symbol);

  const subtitle = findElement("#stockSubtitle", "#stockSymbolLabel");

  if (subtitle) {
    setText(subtitle, `${symbol} · ${PERIODS[currentPeriod] || currentPeriod}`);
  }
}

/* ---------- History table ---------- */

function updateHistoryTable(data) {
  const tbody = findElement(
    "#historyTable tbody",
    "#stockTable tbody",
    "#historicalData tbody",
    "#historyBody"
  );

  if (!tbody) return;

  const rows = [...data].reverse();

  tbody.innerHTML = rows.map((item) => `
    <tr>
      <td>${escapeHTML(formatDate(item.date))}</td>
      <td>${escapeHTML(formatPrice(item.open))}</td>
      <td>${escapeHTML(formatPrice(item.high))}</td>
      <td>${escapeHTML(formatPrice(item.low))}</td>
      <td>${escapeHTML(formatPrice(item.close))}</td>
      <td>${escapeHTML(formatNumber(item.volume, 0))}</td>
    </tr>
  `).join("");
}

/* ---------- Price chart ---------- */

/*
  Uses Chart.js if it is already loaded by your HTML.
  Otherwise, draws a simple price line directly on the canvas.
*/

function drawFallbackChart(canvas, data) {
  const context = canvas.getContext("2d");
  if (!context) return;

  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(canvas.clientWidth || 600, 300);
  const height = Math.max(canvas.clientHeight || 320, 220);

  canvas.width = width * ratio;
  canvas.height = height * ratio;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);

  context.clearRect(0, 0, width, height);

  const padding = { top: 20, right: 20, bottom: 35, left: 65 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const prices = data.map((item) => item.close);
  let min = Math.min(...prices);
  let max = Math.max(...prices);

  if (min === max) {
    min -= 1;
    max += 1;
  }

  const extra = (max - min) * 0.08;
  min -= extra;
  max += extra;

  const x = (index) =>
    padding.left + (index / Math.max(data.length - 1, 1)) * chartWidth;

  const y = (price) =>
    padding.top + ((max - price) / (max - min)) * chartHeight;

  context.font = "12px sans-serif";
  context.lineWidth = 1;
  context.strokeStyle = "rgba(128,128,128,0.2)";
  context.fillStyle = "rgba(128,128,128,0.9)";

  for (let i = 0; i <= 4; i++) {
    const price = max - ((max - min) * i) / 4;
    const lineY = y(price);

    context.beginPath();
    context.moveTo(padding.left, lineY);
    context.lineTo(width - padding.right, lineY);
    context.stroke();

    context.textAlign = "right";
    context.fillText(formatNumber(price), padding.left - 8, lineY + 4);
  }

  context.beginPath();

  prices.forEach((price, index) => {
    if (index === 0) {
      context.moveTo(x(index), y(price));
    } else {
      context.lineTo(x(index), y(price));
    }
  });

  context.strokeStyle =
    prices[prices.length - 1] >= prices[0] ? "#16a34a" : "#dc2626";

  context.lineWidth = 2;
  context.stroke();

  const lastIndex = prices.length - 1;

  context.beginPath();
  context.arc(x(lastIndex), y(prices[lastIndex]), 4, 0, Math.PI * 2);
  context.fillStyle =
    prices[lastIndex] >= prices[0] ? "#16a34a" : "#dc2626";
  context.fill();

  context.textAlign = "left";
  context.fillStyle = "rgba(128,128,128,0.9)";
  context.fillText(formatDate(data[0].date), padding.left, height - 10);

  context.textAlign = "right";
  context.fillText(
    formatDate(data[lastIndex].date),
    width - padding.right,
    height - 10
  );
}

function renderChart(data) {
  const canvas = getChartCanvas();
  if (!canvas || !data.length) return;

  const labels = data.map((item) =>
    item.date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "2-digit"
    })
  );

  const prices = data.map((item) => item.close);
  const rising = prices[prices.length - 1] >= prices[0];
  const lineColor = rising ? "#16a34a" : "#dc2626";

  if (typeof window.Chart === "function") {
    if (priceChart) {
      priceChart.destroy();
    }

    const context = canvas.getContext("2d");

    priceChart = new window.Chart(context, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: `${currentSymbol} closing price`,
          data: prices,
          borderColor: lineColor,
          backgroundColor: rising
            ? "rgba(22,163,74,0.12)"
            : "rgba(220,38,38,0.12)",
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          fill: true,
          tension: 0.15
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: "index"
        },
        plugins: {
          legend: {
            display: true
          },
          tooltip: {
            callbacks: {
              label: (item) => formatPrice(item.parsed.y)
            }
          }
        },
        scales: {
          x: {
            ticks: {
              maxTicksLimit: 8
            }
          },
          y: {
            ticks: {
              callback: (value) => "₹" + Number(value).toLocaleString("en-IN")
            }
          }
        }
      }
    });

    return;
  }

  drawFallbackChart(canvas, data);
}

/* ---------- Main stock loader ---------- */

async function loadStock(symbol, period) {
  const cleanSymbol = String(symbol || "").trim().toUpperCase();
  const selectedPeriod = period || currentPeriod;

  if (!cleanSymbol) {
    showStatus("Please enter a stock symbol.", "error");
    return;
  }

  setLoading(true);
  showStatus(`Loading ${cleanSymbol} historical prices...`, "info");

  try {
    const data = await fetchData(cleanSymbol, selectedPeriod);

    stockData = data;
    currentSymbol = cleanSymbol;
    currentPeriod = selectedPeriod;

    updateSummary(data);
    renderChart(data);

    showStatus(
      `Loaded ${data.length} historical records for ${cleanSymbol}.`,
      "success"
    );
  } catch (error) {
    console.error("MarketScope stock loading error:", error);

    showStatus(
      error.message || "Unable to load stock data. Please try again.",
      "error"
    );
  } finally {
    setLoading(false);
  }
}

/* ---------- Form and control events ---------- */

function handleSearch(event) {
  if (event) event.preventDefault();

  const input = getSearchInput();
  const periodInput = getPeriodInput();

  const symbol = input ? input.value : currentSymbol;
  const period = periodInput ? periodInput.value : currentPeriod;

  loadStock(symbol, period);
}

function setupPeriodOptions() {
  const select = getPeriodInput();
  if (!select) return;

  const supportedValues = new Set(
    Array.from(select.options).map((option) => option.value)
  );

  if (supportedValues.size === 0) {
    for (const [value, label] of Object.entries(PERIODS)) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      select.appendChild(option);
    }
  }

  if (select.value && PERIODS[select.value]) {
    currentPeriod = select.value;
  } else {
    currentPeriod = "1y";
    select.value = currentPeriod;
  }
}

function setupEvents() {
  const input = getSearchInput();
  const button = getSearchButton();
  const periodInput = getPeriodInput();

  if (input) {
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        handleSearch(event);
      }
    });
  }

  if (button) {
    button.addEventListener("click", handleSearch);
  }

  if (periodInput) {
    periodInput.addEventListener("change", () => {
      const symbol = input && input.value.trim()
        ? input.value
        : currentSymbol;

      loadStock(symbol, periodInput.value);
    });
  }

  const form = findElement("#stockForm", "#searchForm", "form");

  if (form) {
    form.addEventListener("submit", handleSearch);
  }
}

/* ---------- Initialization ---------- */

function initializeMarketScope() {
  setupPeriodOptions();
  setupEvents();

  const input = getSearchInput();
  if (input && !input.value.trim()) {
    input.value = DEFAULT_SYMBOL;
  }

  const periodInput = getPeriodInput();
  if (periodInput) {
    periodInput.value = currentPeriod;
  }

  loadStock(DEFAULT_SYMBOL, currentPeriod);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeMarketScope);
} else {
  initializeMarketScope();
}

/* ---------- Optional global helpers ---------- */

window.MarketScope = {
  fetchData,
  loadStock,
  calculateStatistics,
  getStockData: () => [...stockData],
  getCurrentSymbol: () => currentSymbol,
  getCurrentPeriod: () => currentPeriod
};
