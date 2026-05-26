# portfolio_test

個人資產 Portfolio 網站 Demo（美股/台股/負債/Benchmark）。

## 目前功能
- 顯示總資產、總負債、淨資產、未實現損益、投組報酬率。
- 持倉明細（美股與台股）與損益計算。
- 負債明細與每月應付。
- 資產配置圓餅圖。
- 投組 vs Benchmark 折線圖，支援切換顯示 S&P500 / TAIEX / 兩者。
- 支援新增持倉與新增負債（前端 Demo 狀態）。
- 支援背景主題切換（深色/淺色），並記住使用者偏好。
- 串接 Yahoo Finance API：可查詢代號是否存在，並取得真實市場報價。

## 如何啟動
請用 Python server 啟動（含 `/api/quote`）：

```bash
python3 server.py
```

然後開啟 `http://localhost:8000`。

## Yahoo 查價 API
- Endpoint: `GET /api/quote?symbol=AAPL&market=US`
- 台股可用：`GET /api/quote?symbol=2330&market=TW`（會自動轉為 `2330.TW`）
