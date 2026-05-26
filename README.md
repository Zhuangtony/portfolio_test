# portfolio_test

個人資產 Portfolio 網站 Demo（美股/台股/負債/Benchmark）。

## 目前功能
- 顯示總資產、總負債、淨資產、未實現損益、投組報酬率。
- 持倉明細（美股與台股）與損益計算。
- 同代號持倉會自動合併顯示，並可展開查看每筆交易細節。
- 新增持倉支援輸入購買日期。
- 負債明細與每月應付。
- 資產總覽柱狀圖（以顏色區分資產與負債）。
- 投組 vs Benchmark 折線圖，支援切換顯示 S&P500 / TAIEX / 兩者。
- 資產/負債隨時間變化圖採柱狀堆疊：總資產為柱長，顏色比例區分負債與實際資產。
- 總資產統計支援一天 / 一周 / YTD / 一年 / 五年 / 自訂區間篩選。
- 支援新增持倉與新增負債（前端 Demo 狀態）。
- 借貸可設定開始時間、期數與相關費用，月付款會依利率與期數自動換算。
- 支援背景主題切換（深色/淺色），並記住使用者偏好。
- 串接 Yahoo Finance API：使用者輸入股票代碼後可自動驗證並帶入現價；失敗時提供簡單提示。

## 如何啟動
請用 Python server 啟動（含 `/api/quote`）：

```bash
python3 server.py
```

然後開啟 `http://localhost:8000`。

## Yahoo 查價 API
- Endpoint: `GET /api/quote?symbol=AAPL&market=US`
- 台股可用：`GET /api/quote?symbol=2330&market=TW`（會自動轉為 `2330.TW`）
