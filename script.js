const fx = { USD_TWD: 32.5 };
const uid = () => `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
const now = () => new Date().toLocaleString('zh-TW');

const state = {
  positions: [
    { id: uid(), market: 'US', symbol: 'AAPL', name: 'Apple', shares: 10, cost: 170, price: 198, ccy: 'USD', buyDate: '2025-01-10' },
    { id: uid(), market: 'US', symbol: 'AAPL', name: 'Apple', shares: 10, cost: 180, price: 198, ccy: 'USD', buyDate: '2025-03-15' },
    { id: uid(), market: 'US', symbol: 'VOO', name: 'Vanguard S&P500 ETF', shares: 12, cost: 430, price: 480, ccy: 'USD', buyDate: '2025-02-11' },
    { id: uid(), market: 'TW', symbol: '2330', name: '台積電', shares: 30, cost: 760, price: 880, ccy: 'TWD', buyDate: '2025-04-20' },
  ],
  liabilities: [
    { id: uid(), type: '房貸', balance: 2800000, rate: 2.1, monthlyPayment: 28000, startDate: '2025-01-01', termMonths: 360, fees: 15000 },
    { id: uid(), type: '信用貸款', balance: 320000, rate: 4.5, monthlyPayment: 9500, startDate: '2025-06-01', termMonths: 60, fees: 3000 },
  ],
  positionHistory: [], liabilityHistory: [], valueHistory: [], benchmark: 'both', trendRange: 'ALL', customRange: { start: '', end: '' },
};
const benchmarkSeries = { labels: ['1月', '2月', '3月', '4月', '5月', '6月'], portfolio: [100, 103, 101, 108, 112, 115], sp500: [100, 102, 104, 106, 107, 110], twii: [100, 99, 102, 105, 103, 109] };
let assetBarChart; let benchmarkChart; let balanceTrendChart;
const toTwd = (amount, ccy) => (ccy === 'USD' ? amount * fx.USD_TWD : amount);
const format = n => n.toLocaleString('zh-TW', { maximumFractionDigits: 0 });
const percent = n => `${(n * 100).toFixed(2)}%`;
const setStatus = (text, isError = false) => { const el = document.getElementById('statusText'); el.textContent = text; el.className = isError ? 'form-status negative' : 'form-status positive'; };
async function fetchQuote(symbol, market) { const res = await fetch(`/api/quote?symbol=${encodeURIComponent(symbol)}&market=${encodeURIComponent(market)}`); if (!res.ok) throw new Error(await res.text()); return res.json(); }
async function fetchSuggestions(q) { const res = await fetch(`/api/suggest?q=${encodeURIComponent(q)}`); if (!res.ok) return []; const data = await res.json(); return data.items || []; }
const localSuggestionFallback = query => {
  const base = [
    { symbol: 'AAPL', name: 'Apple' }, { symbol: 'MSFT', name: 'Microsoft' }, { symbol: 'NVDA', name: 'NVIDIA' },
    { symbol: 'TSLA', name: 'Tesla' }, { symbol: 'VOO', name: 'Vanguard S&P 500 ETF' }, { symbol: 'QQQ', name: 'Invesco QQQ' },
    { symbol: '2330.TW', name: '台積電' }, { symbol: '0050.TW', name: '元大台灣50' }, { symbol: '2317.TW', name: '鴻海' }, { symbol: '2454.TW', name: '聯發科' },
  ];
  const q = String(query || '').trim().toUpperCase();
  if (!q) return [];
  return base.filter(i => i.symbol.includes(q) || String(i.name || '').toUpperCase().includes(q)).slice(0, 10);
};
async function fetchSuggestionsSafe(q) {
  try {
    const items = await fetchSuggestions(q);
    if (Array.isArray(items) && items.length) return items;
    return localSuggestionFallback(q);
  } catch {
    return localSuggestionFallback(q);
  }
}

function normalizeSymbolForMarket(symbol, market) {
  const upper = String(symbol || '').trim().toUpperCase();
  if (market === 'TW' && /^\d+$/.test(upper) && !upper.endsWith('.TW')) return `${upper}.TW`;
  return upper;
}
function inferMarketAndSymbol(inputSymbol) {
  const raw = String(inputSymbol || '').trim().toUpperCase();
  if (!raw) return { market: 'US', symbol: '' };
  if (raw.endsWith('.TW')) return { market: 'TW', symbol: raw };
  if (/^\d+$/.test(raw)) return { market: 'TW', symbol: `${raw}.TW` };
  return { market: 'US', symbol: raw };
}

function calcMonthlyPayment(balance, annualRate, termMonths) {
  const n = Number(termMonths);
  const principal = Number(balance);
  const r = Number(annualRate) / 100 / 12;
  if (!n || !principal) return 0;
  if (r === 0) return principal / n;
  return principal * r / (1 - Math.pow(1 + r, -n));
}


function calc() {
  const latestPriceBySymbol = {};
  for (const pos of state.positions) latestPriceBySymbol[`${pos.symbol}`] = pos.price;

  const enriched = state.positions.map(p => {
    const unifiedPrice = latestPriceBySymbol[`${p.symbol}`] ?? p.price;
    const costTwd = toTwd(p.cost * p.shares, p.ccy), valueTwd = toTwd(unifiedPrice * p.shares, p.ccy), pnl = valueTwd - costTwd;
    return { ...p, price: unifiedPrice, costTwd, valueTwd, pnl, roi: costTwd ? pnl / costTwd : 0 };
  });
  const assets = enriched.reduce((s, p) => s + p.valueTwd, 0), cost = enriched.reduce((s, p) => s + p.costTwd, 0), pnl = assets - cost;
  const liabilitiesTotal = state.liabilities.reduce((s, l) => s + l.balance, 0), netWorth = assets - liabilitiesTotal;

  const grouped = Object.values(enriched.reduce((acc, p) => {
    const key = `${p.symbol}`;
    if (!acc[key]) acc[key] = { key, market: p.market, symbol: p.symbol, note: p.name, rows: [], shares: 0, costTwd: 0, valueTwd: 0, pnl: 0 };
    acc[key].rows.push(p); acc[key].shares += p.shares; acc[key].costTwd += p.costTwd; acc[key].valueTwd += p.valueTwd; acc[key].pnl += p.pnl;
    return acc;
  }, {})).map(g => ({ ...g, roi: g.costTwd ? g.pnl / g.costTwd : 0 }));

  return { enriched, grouped, assets, cost, pnl, liabilitiesTotal, netWorth };
}
function seedHistory(base) { const points=[]; const today=new Date(); for(let i=365*5;i>=0;i-=7){const d=new Date(today); d.setDate(today.getDate()-i); const drift=1+(Math.sin(i/35)*0.07+(365*5-i)*0.0002); const assets=Math.round(base.assets*drift); const liabilities=Math.round(base.liabilitiesTotal*(1-(365*5-i)*0.00008)); points.push({date:d.toISOString().slice(0,10),assets,liabilities,netWorth:assets-liabilities});} return points; }
function filteredHistory(){const list=state.valueHistory;if(!list.length)return[];const end=new Date(list[list.length-1].date);let start=new Date(list[0].date);const m=state.trendRange;if(m==='1D')start=new Date(end-86400000);if(m==='1W')start=new Date(end-7*86400000);if(m==='1Y')start=new Date(end-365*86400000);if(m==='5Y')start=new Date(end-365*5*86400000);if(m==='YTD')start=new Date(end.getFullYear(),0,1);if(m==='CUSTOM'&&state.customRange.start&&state.customRange.end){const s=new Date(state.customRange.start),e=new Date(state.customRange.end);return list.filter(v=>{const d=new Date(v.date);return d>=s&&d<=e;});}if(m==='ALL')return list;return list.filter(v=>new Date(v.date)>=start&&new Date(v.date)<=end);}
function renderSummary(result){const debtRatio=result.assets?result.liabilitiesTotal/result.assets:0;const cards=[['總資產',`NT$ ${format(result.assets)}`],['總負債',`NT$ ${format(result.liabilitiesTotal)}`],['淨資產',`NT$ ${format(result.netWorth)}`],['未實現損益',`NT$ ${format(result.pnl)}`,result.pnl>=0],['投組報酬率',percent(result.cost?result.pnl/result.cost:0),result.pnl>=0],['負債/資產比',percent(debtRatio),debtRatio<=0.5]];document.getElementById('summaryCards').innerHTML=cards.map(([n,v,p])=>`<article class="card"><div class="metric-name">${n}</div><div class="metric-value ${p===undefined?'':p?'positive':'negative'}">${v}</div></article>`).join('');}

function renderTables(result){
  const groupHtml = result.grouped.map(g => `
    <tr class="group-row"><td>${g.market}</td><td>${g.symbol}</td><td>${g.note||'-'}</td><td>${format(g.shares)}</td><td>${format(g.costTwd)}</td><td>${format(g.valueTwd)}</td><td class="${g.pnl>=0?'positive':'negative'}">${format(g.pnl)}</td><td class="${g.roi>=0?'positive':'negative'}">${percent(g.roi)}</td><td>-</td></tr>
    <tr><td colspan="9"><details><summary>查看此標的明細 (${g.rows.length} 筆)</summary>
      <table class="subtable"><thead><tr><th>買入日</th><th>股數</th><th>成本(TWD)</th><th>現值(TWD)</th><th>損益</th><th>操作</th></tr></thead><tbody>
      ${g.rows.map(r=>`<tr><td>${r.buyDate||'-'}</td><td>${format(r.shares)}</td><td>${format(r.costTwd)}</td><td>${format(r.valueTwd)}</td><td class="${r.pnl>=0?'positive':'negative'}">${format(r.pnl)}</td><td><button data-del-position="${r.id}">刪除</button></td></tr>`).join('')}
      </tbody></table>
    </details></td></tr>`).join('');
  document.querySelector('#positionsTable tbody').innerHTML = groupHtml;

  document.querySelector('#liabilitiesTable tbody').innerHTML = state.liabilities.map(l => `<tr><td>${l.type}</td><td>${format(l.balance)}</td><td>${l.rate.toFixed(2)}%</td><td>${format(l.monthlyPayment)}</td><td>${l.startDate || '-'}</td><td>${format(l.termMonths || 0)}</td><td>${format(l.fees || 0)}</td><td><button data-del-liability="${l.id}">刪除</button></td></tr>`).join('');
  document.getElementById('positionHistory').innerHTML = state.positionHistory.length ? state.positionHistory.map(h => `<div class="history-item"><span>${h.at}</span><span>${h.action}</span><span>${h.symbol}</span><span>${h.market}</span><span>${h.note}</span></div>`).join('') : '<div class="history-empty">尚無持倉新增歷史</div>';
  document.getElementById('liabilityHistory').innerHTML = state.liabilityHistory.length ? state.liabilityHistory.map(h => `<div class="history-item"><span>${h.at}</span><span>${h.action}</span><span>${h.type}</span><span>${h.note}</span></div>`).join('') : '<div class="history-empty">尚無負債新增歷史</div>';
}
function renderCharts(result){if(assetBarChart)assetBarChart.destroy();if(benchmarkChart)benchmarkChart.destroy();if(balanceTrendChart)balanceTrendChart.destroy();const barLabels=[...result.grouped.map(p=>`${p.symbol} (${p.market})`),'負債'];const barValues=[...result.grouped.map(p=>p.valueTwd),result.liabilitiesTotal];const barColors=[...result.grouped.map(()=>'#4ba3ff'),'#ff7f7f'];assetBarChart=new Chart(document.getElementById('assetBar'),{type:'bar',data:{labels:barLabels,datasets:[{data:barValues,backgroundColor:barColors}]},options:{maintainAspectRatio:false,plugins:{legend:{display:false}}}});const datasets=[{label:'我的投組',data:benchmarkSeries.portfolio,borderColor:'#67b3ff'}];if(state.benchmark!=='twii')datasets.push({label:'S&P 500',data:benchmarkSeries.sp500,borderColor:'#39d98a'});if(state.benchmark!=='sp500')datasets.push({label:'TAIEX',data:benchmarkSeries.twii,borderColor:'#ffcb6b'});benchmarkChart=new Chart(document.getElementById('benchmarkLine'),{type:'line',data:{labels:benchmarkSeries.labels,datasets},options:{responsive:true,interaction:{mode:'index',intersect:false}}});const trend=filteredHistory();const debtPart=trend.map(v=>{const denom=v.assets+v.liabilities;const debtRatio=denom>0?(v.liabilities/denom):0;return v.assets*debtRatio;});const realAssetPart=trend.map((v,i)=>Math.max(0,v.assets-debtPart[i]));balanceTrendChart=new Chart(document.getElementById('balanceTrend'),{type:'bar',data:{labels:trend.map(v=>v.date),datasets:[{label:'負債占比',data:debtPart,backgroundColor:'#ff7f7f',stack:'totalAsset'},{label:'實際資產占比',data:realAssetPart,backgroundColor:'#4ba3ff',stack:'totalAsset'}]},options:{responsive:true,interaction:{mode:'index',intersect:false},plugins:{legend:{display:true}},scales:{x:{stacked:true},y:{stacked:true,title:{display:true,text:'總資產長度（TWD）'}}}}});const totalAsset=result.assets||1;const debtRatio=result.liabilitiesTotal/totalAsset;document.getElementById('allocationList').innerHTML=result.grouped.map(p=>`<div class="allocation-item"><span>${p.symbol} (${p.market})</span><span>${((p.valueTwd/totalAsset)*100).toFixed(1)}% / NT$ ${format(p.valueTwd)}</span></div>`).join('')+`<div class="allocation-item debt"><span>負債</span><span>${(debtRatio*100).toFixed(1)}% / NT$ ${format(result.liabilitiesTotal)}</span></div>`;}
function syncLatestHistory(result){if(!state.valueHistory.length)return;const latest={date:new Date().toISOString().slice(0,10),assets:result.assets,liabilities:result.liabilitiesTotal,netWorth:result.netWorth};state.valueHistory[state.valueHistory.length-1]=latest;}
function rerender(){const result=calc();syncLatestHistory(result);renderSummary(result);renderTables(result);renderCharts(result);}
function bindEvents(){const result=calc();if(!state.valueHistory.length)state.valueHistory=seedHistory(result);syncLatestHistory(result);const body=document.body,themeToggle=document.getElementById('themeToggle'),savedTheme=localStorage.getItem('theme')||'dark';if(savedTheme==='light'){body.classList.add('light');themeToggle.textContent='切換背景：淺色';}themeToggle.addEventListener('click',()=>{body.classList.toggle('light');const isLight=body.classList.contains('light');localStorage.setItem('theme',isLight?'light':'dark');themeToggle.textContent=`切換背景：${isLight?'淺色':'深色'}`;});
  document.getElementById('rangeControls').addEventListener('click',e=>{const btn=e.target.closest('button[data-range]');if(!btn)return;state.trendRange=btn.dataset.range;document.querySelectorAll('#rangeControls button').forEach(b=>b.classList.toggle('active',b===btn));rerender();});
  document.getElementById('customRangeForm').addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(e.target);state.customRange.start=String(fd.get('start'));state.customRange.end=String(fd.get('end'));state.trendRange='CUSTOM';document.querySelectorAll('#rangeControls button').forEach(b=>b.classList.remove('active'));rerender();});
  const positionForm=document.getElementById('positionForm'),symbolInput=positionForm.elements.symbol;const suggestionList=document.getElementById('symbolAutocompleteList');const clearQuoteCache=()=>{delete positionForm.dataset.quoteName;delete positionForm.dataset.quoteSymbol;};
  let suggestionItems=[]; let activeSuggestionIndex=-1; let suppressBlur=false;
  const hideSuggestions=()=>{suggestionList.hidden=true; suggestionList.innerHTML=''; activeSuggestionIndex=-1;};
  const showSuggestions=()=>{suggestionList.hidden=false;};
  const renderSuggestionState=(type)=>{showSuggestions();if(type==='loading'){suggestionList.innerHTML='<div class="symbol-autocomplete-loading">載入中...</div>';return;}if(type==='empty'){suggestionList.innerHTML='<div class="symbol-autocomplete-empty">查無建議代碼</div>';return;}suggestionList.innerHTML=suggestionItems.map((i,idx)=>`<div class="symbol-autocomplete-item ${idx===activeSuggestionIndex?'active':''}" data-idx="${idx}"><strong>${i.symbol}</strong><span class="symbol-autocomplete-name">${i.name||''}</span></div>`).join('');};
  const applySuggestion=async item=>{if(!item)return;symbolInput.value=item.symbol||'';positionForm.dataset.quoteName=item.name||item.symbol||'';positionForm.dataset.quoteSymbol=item.symbol||'';hideSuggestions();await autoFillPrice();};
  const setActiveSuggestion=idx=>{if(!suggestionItems.length)return;activeSuggestionIndex=((idx%suggestionItems.length)+suggestionItems.length)%suggestionItems.length;renderSuggestionState('items');};
  async function autoFillPrice(){const inferred=inferMarketAndSymbol(symbolInput.value);clearQuoteCache();if(!inferred.symbol)return;setStatus('正在查詢 Yahoo Finance...');try{const quote=await fetchQuote(inferred.symbol,inferred.market);if(!quote.exists||quote.price==null)return setStatus(`查無標的或無報價：${inferred.symbol}`,true);positionForm.elements.price.value=Number(quote.price);positionForm.dataset.quoteName=quote.name||inferred.symbol.toUpperCase();positionForm.dataset.quoteSymbol=quote.symbol||inferred.symbol.toUpperCase();setStatus(`已帶入 ${quote.symbol} 現價 ${quote.price}`);}catch{setStatus('現價取得失敗，請稍後再試或手動輸入',true);}}
  symbolInput.addEventListener('blur',async ()=>{if(suppressBlur)return;hideSuggestions();await autoFillPrice();});
  symbolInput.addEventListener('focus',()=>{if(suggestionItems.length)renderSuggestionState('items');});
  symbolInput.addEventListener('input',async ()=>{clearQuoteCache(); const q=String(symbolInput.value||'').trim(); if(q.length<1){suggestionItems=[]; hideSuggestions(); return;} renderSuggestionState('loading'); const items=await fetchSuggestionsSafe(q); suggestionItems=items; activeSuggestionIndex=-1; if(!items.length){renderSuggestionState('empty'); return;} renderSuggestionState('items');});
  symbolInput.addEventListener('keydown',async e=>{if(suggestionList.hidden&&['ArrowDown','ArrowUp'].includes(e.key)&&suggestionItems.length){renderSuggestionState('items');} if(e.key==='ArrowDown'){e.preventDefault();setActiveSuggestion(activeSuggestionIndex+1);}else if(e.key==='ArrowUp'){e.preventDefault();setActiveSuggestion(activeSuggestionIndex-1);}else if(e.key==='Enter'){if(!suggestionList.hidden&&activeSuggestionIndex>=0){e.preventDefault();await applySuggestion(suggestionItems[activeSuggestionIndex]);}}else if(e.key==='Escape'){hideSuggestions();}});
  suggestionList.addEventListener('mousedown',()=>{suppressBlur=true;});
  suggestionList.addEventListener('click',async e=>{const item=e.target.closest('.symbol-autocomplete-item');if(!item)return;const idx=Number(item.dataset.idx);await applySuggestion(suggestionItems[idx]);suppressBlur=false;});
  suggestionList.addEventListener('mouseup',()=>{setTimeout(()=>{suppressBlur=false;},0);});
  document.addEventListener('click',e=>{if(!e.target.closest('.symbol-autocomplete'))hideSuggestions();});
  document.getElementById('fetchQuoteBtn').addEventListener('click',autoFillPrice);
  positionForm.addEventListener('submit',e=>{e.preventDefault();const data=new FormData(e.target);const inferred=inferMarketAndSymbol(data.get('symbol'));const normalizedSymbol=positionForm.dataset.quoteSymbol||inferred.symbol;const row={id:uid(),market:inferred.market,symbol:normalizedSymbol,name:positionForm.dataset.quoteName||normalizedSymbol,shares:Number(data.get('shares')),cost:Number(data.get('cost')),price:Number(data.get('price')),ccy:inferred.market==='US'?'USD':'TWD',buyDate:String(data.get('buyDate'))};state.positions.push(row);state.positionHistory.unshift({at:now(),action:'新增',symbol:row.symbol,market:row.market,note:`買入日 ${row.buyDate}`});e.target.reset();clearQuoteCache();rerender();});
  document.getElementById('liabilityForm').addEventListener('submit',e=>{e.preventDefault();const data=new FormData(e.target);const balance = Number(data.get('balance')); const rate = Number(data.get('rate')); const termMonths = Number(data.get('termMonths')); const monthlyPayment = calcMonthlyPayment(balance, rate, termMonths); const row={id:uid(),type:String(data.get('type')),balance,rate,monthlyPayment,startDate:String(data.get('startDate')),termMonths,fees:Number(data.get('fees')||0)};state.liabilities.push(row);state.liabilityHistory.unshift({at:now(),action:'新增',type:row.type,note:`餘額 ${format(row.balance)}`});e.target.reset();rerender();});
  document.getElementById('benchmarkSelect').addEventListener('change',e=>{state.benchmark=e.target.value;rerender();});
  document.addEventListener('click',e=>{const pId=e.target.getAttribute('data-del-position');if(pId){const idx=state.positions.findIndex(x=>x.id===pId);if(idx>=0){state.positions.splice(idx,1);rerender();}}const lId=e.target.getAttribute('data-del-liability');if(lId){const idx=state.liabilities.findIndex(x=>x.id===lId);if(idx>=0){state.liabilities.splice(idx,1);rerender();}}});}
bindEvents();rerender();
