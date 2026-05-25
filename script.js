const fx = { USD_TWD: 32.5 };

const positions = [
  { market: 'US', symbol: 'AAPL', name: 'Apple', shares: 20, cost: 175, price: 198, ccy: 'USD' },
  { market: 'US', symbol: 'VOO', name: 'Vanguard S&P500 ETF', shares: 12, cost: 430, price: 480, ccy: 'USD' },
  { market: 'TW', symbol: '2330', name: '台積電', shares: 30, cost: 760, price: 880, ccy: 'TWD' },
  { market: 'TW', symbol: '0050', name: '元大台灣50', shares: 40, cost: 150, price: 184, ccy: 'TWD' },
];

const liabilities = [
  { type: '房貸', balance: 2800000, rate: 2.1, monthlyPayment: 28000 },
  { type: '信用貸款', balance: 320000, rate: 4.5, monthlyPayment: 9500 },
  { type: '信用卡', balance: 28000, rate: 12.0, monthlyPayment: 6000 },
];

const benchmarkSeries = {
  labels: ['1月', '2月', '3月', '4月', '5月', '6月'],
  portfolio: [100, 103, 101, 108, 112, 115],
  sp500: [100, 102, 104, 106, 107, 110],
  twii: [100, 99, 102, 105, 103, 109],
};

const toTwd = (amount, ccy) => (ccy === 'USD' ? amount * fx.USD_TWD : amount);
const format = n => n.toLocaleString('zh-TW', { maximumFractionDigits: 0 });
const percent = n => `${(n * 100).toFixed(2)}%`;

function calc() {
  const enriched = positions.map(p => {
    const costTwd = toTwd(p.cost * p.shares, p.ccy);
    const valueTwd = toTwd(p.price * p.shares, p.ccy);
    const pnl = valueTwd - costTwd;
    return { ...p, costTwd, valueTwd, pnl, roi: pnl / costTwd };
  });

  const assets = enriched.reduce((s, p) => s + p.valueTwd, 0);
  const cost = enriched.reduce((s, p) => s + p.costTwd, 0);
  const pnl = assets - cost;
  const liabilitiesTotal = liabilities.reduce((s, l) => s + l.balance, 0);
  const netWorth = assets - liabilitiesTotal;

  return { enriched, assets, cost, pnl, liabilitiesTotal, netWorth };
}

function renderSummary(result) {
  const cards = [
    ['總資產', `NT$ ${format(result.assets)}`],
    ['總負債', `NT$ ${format(result.liabilitiesTotal)}`],
    ['淨資產', `NT$ ${format(result.netWorth)}`],
    ['未實現損益', `NT$ ${format(result.pnl)}`, result.pnl >= 0],
    ['投組報酬率', percent(result.pnl / result.cost), result.pnl >= 0],
  ];

  document.getElementById('summaryCards').innerHTML = cards
    .map(([name, value, positive]) => `
      <article class="card">
        <div class="metric-name">${name}</div>
        <div class="metric-value ${positive === undefined ? '' : positive ? 'positive' : 'negative'}">${value}</div>
      </article>
    `)
    .join('');
}

function renderTables(result) {
  document.querySelector('#positionsTable tbody').innerHTML = result.enriched.map(p => `
    <tr>
      <td>${p.market}</td><td>${p.symbol}</td><td>${p.name}</td><td>${format(p.shares)}</td>
      <td>${format(p.costTwd)}</td><td>${format(p.valueTwd)}</td>
      <td class="${p.pnl >= 0 ? 'positive' : 'negative'}">${format(p.pnl)}</td>
      <td class="${p.roi >= 0 ? 'positive' : 'negative'}">${percent(p.roi)}</td>
    </tr>
  `).join('');

  document.querySelector('#liabilitiesTable tbody').innerHTML = liabilities.map(l => `
    <tr><td>${l.type}</td><td>${format(l.balance)}</td><td>${l.rate.toFixed(2)}%</td><td>${format(l.monthlyPayment)}</td></tr>
  `).join('');
}

function renderCharts(result) {
  new Chart(document.getElementById('assetPie'), {
    type: 'pie',
    data: {
      labels: result.enriched.map(p => `${p.symbol} (${p.market})`),
      datasets: [{ data: result.enriched.map(p => p.valueTwd) }],
    },
  });

  new Chart(document.getElementById('benchmarkLine'), {
    type: 'line',
    data: {
      labels: benchmarkSeries.labels,
      datasets: [
        { label: '我的投組', data: benchmarkSeries.portfolio, borderColor: '#67b3ff' },
        { label: 'S&P 500', data: benchmarkSeries.sp500, borderColor: '#39d98a' },
        { label: 'TAIEX', data: benchmarkSeries.twii, borderColor: '#ffcb6b' },
      ],
    },
    options: { responsive: true, interaction: { mode: 'index', intersect: false } },
  });
}

const result = calc();
renderSummary(result);
renderTables(result);
renderCharts(result);
