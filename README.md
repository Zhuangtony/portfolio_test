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

## 如何啟動
直接用瀏覽器開啟 `index.html` 即可，或使用簡易靜態伺服器：

```bash
python3 -m http.server 8000
```

然後開啟 `http://localhost:8000`。
