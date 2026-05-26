const fx = { USD_TWD: 32.5 };
const uid = () => `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const now = () => new Date().toLocaleString('zh-TW');

const state = {
  positions: [
    { id: uid(), market: 'US', symbol: 'AAPL', name: 'Apple', shares: 20, cost: 175, price: 198, ccy: 'USD' },
    { id: uid(), market: 'US', symbol: 'VOO', name: 'Vanguard S&P500 ETF', shares: 12, cost: 430, price: 480, ccy: 'USD' },
    { id: uid(), market: 'TW', symbol: '2330', name: '台積電', shares: 30, cost: 760, price: 880, ccy: 'TWD' },
  ],
  liabilities: [
    { id: uid(), type: '房貸', balance: 2800000, rate: 2.1, monthlyPayment: 28000 },
    { id: uid(), type: '信用貸款', balance: 320000, rate: 4.5, monthlyPayment: 9500 },
  ],
  positionHistory: [],
  liabilityHistory: [],
  valueHistory: [],
  benchmark: 'both',
};

const benchmarkSeries = { labels: ['1月', '2月', '3月', '4月', '5月', '6月'], portfolio: [100, 103, 101, 108, 112, 115], sp500: [100, 102, 104, 106, 107, 110], twii: [100, 99, 102, 105, 103, 109] };
let pieChart; let benchmarkChart; let balanceTrendChart;
const toTwd = (amount, ccy) => (ccy === 'USD' ? amount * fx.USD_TWD : amount);
const format = n => n.toLocaleString('zh-TW', { maximumFractionDigits: 0 });
const percent = n => `${(n * 100).toFixed(2)}%`;
const setStatus = (text, isError = false) => { const el = document.getElementById('statusText'); el.textContent = text; el.className = isError ? 'negative' : 'positive'; };

async function fetchQuote(symbol, market) {
  const res = await fetch(`/api/quote?symbol=${encodeURIComponent(symbol)}&market=${encodeURIComponent(market)}`);
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`quote api failed: ${res.status} ${detail}`);
  }
  return res.json();
}

function calc() {
  const enriched = state.positions.map(p => {
    const costTwd = toTwd(p.cost * p.shares, p.ccy), valueTwd = toTwd(p.price * p.shares, p.ccy), pnl = valueTwd - costTwd;
    return { ...p, costTwd, valueTwd, pnl, roi: costTwd ? pnl / costTwd : 0 };
  });
  const assets = enriched.reduce((s, p) => s + p.valueTwd, 0), cost = enriched.reduce((s, p) => s + p.costTwd, 0), pnl = assets - cost;
  const liabilitiesTotal = state.liabilities.reduce((s, l) => s + l.balance, 0), netWorth = assets - liabilitiesTotal;
  return { enriched, assets, cost, pnl, liabilitiesTotal, netWorth };
}

function pushValueHistory(result) {
  const stamp = new Date().toLocaleTimeString('zh-TW', { hour12: false });
  const prev = state.valueHistory[state.valueHistory.length - 1];
  if (prev && prev.assets === result.assets && prev.liabilities === result.liabilitiesTotal) return;
  state.valueHistory.push({ t: stamp, assets: result.assets, liabilities: result.liabilitiesTotal, netWorth: result.netWorth });
  if (state.valueHistory.length > 20) state.valueHistory.shift();
}

function renderSummary(result) {
  const debtRatio = result.assets ? result.liabilitiesTotal / result.assets : 0;
  const cards = [['總資產', `NT$ ${format(result.assets)}`], ['總負債', `NT$ ${format(result.liabilitiesTotal)}`], ['淨資產', `NT$ ${format(result.netWorth)}`], ['未實現損益', `NT$ ${format(result.pnl)}`, result.pnl >= 0], ['投組報酬率', percent(result.cost ? result.pnl / result.cost : 0), result.pnl >= 0], ['負債/資產比', percent(debtRatio), debtRatio <= 0.5]];
  document.getElementById('summaryCards').innerHTML = cards.map(([name, value, positive]) => `<article class="card"><div class="metric-name">${name}</div><div class="metric-value ${positive === undefined ? '' : positive ? 'positive' : 'negative'}">${value}</div></article>`).join('');
}

function renderTables(result) {
  document.querySelector('#positionsTable tbody').innerHTML = result.enriched.map(p => `<tr><td>${p.market}</td><td>${p.symbol}</td><td>${p.name}</td><td>${format(p.shares)}</td><td>${format(p.costTwd)}</td><td>${format(p.valueTwd)}</td><td class="${p.pnl >= 0 ? 'positive' : 'negative'}">${format(p.pnl)}</td><td class="${p.roi >= 0 ? 'positive' : 'negative'}">${percent(p.roi)}</td><td><button data-del-position="${p.id}">刪除</button></td></tr>`).join('');
  document.querySelector('#liabilitiesTable tbody').innerHTML = state.liabilities.map(l => `<tr><td>${l.type}</td><td>${format(l.balance)}</td><td>${l.rate.toFixed(2)}%</td><td>${format(l.monthlyPayment)}</td><td><button data-del-liability="${l.id}">刪除</button></td></tr>`).join('');

  document.getElementById('positionHistory').innerHTML = state.positionHistory.length ? state.positionHistory.map(h => `<div class="history-item"><span>${h.at}</span><span>${h.action}</span><span>${h.symbol}</span><span>${h.market}</span><span>${h.note}</span></div>`).join('') : '<div class="history-empty">尚無持倉新增歷史</div>';
  document.getElementById('liabilityHistory').innerHTML = state.liabilityHistory.length ? state.liabilityHistory.map(h => `<div class="history-item"><span>${h.at}</span><span>${h.action}</span><span>${h.type}</span><span>${h.note}</span></div>`).join('') : '<div class="history-empty">尚無負債新增歷史</div>';
}

function renderCharts(result) {
  if (pieChart) pieChart.destroy(); if (benchmarkChart) benchmarkChart.destroy(); if (balanceTrendChart) balanceTrendChart.destroy();
  const pieLabels = result.enriched.map(p => `${p.symbol} (${p.market})`).concat('負債');
  const pieValues = result.enriched.map(p => p.valueTwd).concat(result.liabilitiesTotal);
  pieChart = new Chart(document.getElementById('assetPie'), { type: 'pie', data: { labels: pieLabels, datasets: [{ data: pieValues }] }, options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } } });

  const datasets = [{ label: '我的投組', data: benchmarkSeries.portfolio, borderColor: '#67b3ff' }]; if (state.benchmark !== 'twii') datasets.push({ label: 'S&P 500', data: benchmarkSeries.sp500, borderColor: '#39d98a' }); if (state.benchmark !== 'sp500') datasets.push({ label: 'TAIEX', data: benchmarkSeries.twii, borderColor: '#ffcb6b' });
  benchmarkChart = new Chart(document.getElementById('benchmarkLine'), { type: 'line', data: { labels: benchmarkSeries.labels, datasets }, options: { responsive: true, interaction: { mode: 'index', intersect: false } } });

  balanceTrendChart = new Chart(document.getElementById('balanceTrend'), {
    type: 'line',
    data: {
      labels: state.valueHistory.map(v => v.t),
      datasets: [
        { label: '真實資產', data: state.valueHistory.map(v => v.assets), borderColor: '#4ba3ff', backgroundColor: 'rgba(75,163,255,0.15)', fill: true },
        { label: '負債', data: state.valueHistory.map(v => v.liabilities), borderColor: '#ff7f7f', backgroundColor: 'rgba(255,127,127,0.15)', fill: true },
        { label: '淨資產', data: state.valueHistory.map(v => v.netWorth), borderColor: '#39d98a', fill: false },
      ],
    },
    options: { responsive: true, interaction: { mode: 'index', intersect: false } },
  });

  const totalAsset = result.assets || 1;
  const debtRatio = result.liabilitiesTotal / totalAsset;
  document.getElementById('allocationList').innerHTML = result.enriched.map(p => `<div class="allocation-item"><span>${p.symbol} (${p.market})</span><span>${((p.valueTwd / totalAsset) * 100).toFixed(1)}% / NT$ ${format(p.valueTwd)}</span></div>`).join('') + `<div class="allocation-item debt"><span>負債</span><span>${(debtRatio * 100).toFixed(1)}% / NT$ ${format(result.liabilitiesTotal)}</span></div>`;
}

function rerender() { const result = calc(); pushValueHistory(result); renderSummary(result); renderTables(result); renderCharts(result); }

function bindEvents() {
  const body = document.body; const themeToggle = document.getElementById('themeToggle'); const savedTheme = localStorage.getItem('theme') || 'dark';
  if (savedTheme === 'light') { body.classList.add('light'); themeToggle.textContent = '切換背景：淺色'; }
  themeToggle.addEventListener('click', () => { body.classList.toggle('light'); const isLight = body.classList.contains('light'); localStorage.setItem('theme', isLight ? 'light' : 'dark'); themeToggle.textContent = `切換背景：${isLight ? '淺色' : '深色'}`; });

  const positionForm = document.getElementById('positionForm');
  const symbolInput = positionForm.elements.symbol;
  const marketInput = positionForm.elements.market;

  function clearQuoteCache() {
    delete positionForm.dataset.quoteName;
    delete positionForm.dataset.quoteSymbol;
  }

  async function autoFillPrice() {
    const symbol = String(symbolInput.value || '').trim();
    const market = String(marketInput.value || 'US');
    clearQuoteCache();
    if (!symbol) return;
    setStatus('正在查詢 Yahoo Finance...');
    try {
      const quote = await fetchQuote(symbol, market);
      if (!quote.exists || quote.price === null || quote.price === undefined) return setStatus(`查無標的或無報價：${symbol}`, true);
      positionForm.elements.price.value = Number(quote.price);
      positionForm.dataset.quoteName = quote.name || symbol.toUpperCase();
      positionForm.dataset.quoteSymbol = quote.symbol || symbol.toUpperCase();
      setStatus(`已帶入 ${quote.symbol} 現價 ${quote.price} ${quote.currency || ''}`);
    } catch (err) {
      setStatus(`現價代入失敗：${err.message}`, true);
    }
  }

  symbolInput.addEventListener('blur', autoFillPrice);
  symbolInput.addEventListener('input', clearQuoteCache);
  marketInput.addEventListener('change', autoFillPrice);
  document.getElementById('fetchQuoteBtn').addEventListener('click', autoFillPrice);

  positionForm.addEventListener('submit', e => {
    e.preventDefault(); const data = new FormData(e.target); const market = String(data.get('market'));
    const rawSymbol = String(data.get('symbol')).toUpperCase();
    const row = { id: uid(), market, symbol: positionForm.dataset.quoteSymbol || rawSymbol, name: positionForm.dataset.quoteName || rawSymbol, shares: Number(data.get('shares')), cost: Number(data.get('cost')), price: Number(data.get('price')), ccy: market === 'US' ? 'USD' : 'TWD' };
    state.positions.push(row); state.positionHistory.unshift({ at: now(), action: '新增', symbol: row.symbol, market: row.market, note: `股數 ${row.shares}` });
    e.target.reset(); clearQuoteCache(); rerender();
  });

  document.getElementById('liabilityForm').addEventListener('submit', e => {
    e.preventDefault(); const data = new FormData(e.target);
    const row = { id: uid(), type: String(data.get('type')), balance: Number(data.get('balance')), rate: Number(data.get('rate')), monthlyPayment: Number(data.get('monthlyPayment')) };
    state.liabilities.push(row); state.liabilityHistory.unshift({ at: now(), action: '新增', type: row.type, note: `餘額 ${format(row.balance)}` });
    e.target.reset(); rerender();
  });

  document.getElementById('benchmarkSelect').addEventListener('change', e => { state.benchmark = e.target.value; rerender(); });

  document.addEventListener('click', e => {
    const pId = e.target.getAttribute('data-del-position');
    if (pId) {
      const idx = state.positions.findIndex(x => x.id === pId); if (idx >= 0) { state.positions.splice(idx, 1); rerender(); }
    }
    const lId = e.target.getAttribute('data-del-liability');
    if (lId) {
      const idx = state.liabilities.findIndex(x => x.id === lId); if (idx >= 0) { state.liabilities.splice(idx, 1); rerender(); }
    }
  });
}

bindEvents(); rerender();
