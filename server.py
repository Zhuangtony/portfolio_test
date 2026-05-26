#!/usr/bin/env python3
import json
import urllib.parse
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = 8000


def _fetch_json(url: str):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read().decode("utf-8"))


def yahoo_quote_chart(symbol: str):
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{urllib.parse.quote(symbol)}?interval=1d&range=1d"
    data = _fetch_json(url)
    result = (data.get("chart") or {}).get("result")
    if not result:
        return None
    meta = result[0].get("meta", {})
    price = meta.get("regularMarketPrice")
    if price is None:
        return None
    return {
        "exists": True,
        "provider": "yahoo_chart",
        "symbol": meta.get("symbol", symbol),
        "name": meta.get("longName") or meta.get("shortName") or meta.get("symbol", symbol),
        "currency": meta.get("currency"),
        "price": price,
        "exchangeName": meta.get("exchangeName"),
    }


def yahoo_quote_v7(symbol: str):
    url = f"https://query1.finance.yahoo.com/v7/finance/quote?symbols={urllib.parse.quote(symbol)}"
    data = _fetch_json(url)
    items = ((data.get("quoteResponse") or {}).get("result") or [])
    if not items:
        return None
    q = items[0]
    price = q.get("regularMarketPrice")
    if price is None:
        return None
    return {
        "exists": True,
        "provider": "yahoo_v7",
        "symbol": q.get("symbol", symbol),
        "name": q.get("longName") or q.get("shortName") or q.get("symbol", symbol),
        "currency": q.get("currency"),
        "price": price,
        "exchangeName": q.get("fullExchangeName") or q.get("exchange"),
    }


def stooq_quote(symbol: str):
    # stooq uses US as plain ticker; TW format often as 2330.tw
    stooq_symbol = symbol.lower()
    if symbol.endswith('.TW'):
        stooq_symbol = symbol.replace('.TW', '.tw').lower()
    url = f"https://stooq.com/q/l/?s={urllib.parse.quote(stooq_symbol)}&f=sd2t2ohlcvn&e=json"
    data = _fetch_json(url)
    rows = data.get("symbols") or []
    if not rows:
        return None
    row = rows[0]
    close = row.get("close")
    if close in (None, "N/D"):
        return None
    price = float(close)
    return {
        "exists": True,
        "provider": "stooq",
        "symbol": (row.get("symbol") or symbol).upper(),
        "name": row.get("name") or symbol,
        "currency": "USD" if ".TW" not in symbol else "TWD",
        "price": price,
        "exchangeName": "STOOQ",
    }


def twse_quote(symbol: str):
    # only for TW numeric tickers
    if not symbol.endswith('.TW'):
        return None
    code = symbol.split('.')[0]
    url = f"https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=tse_{code}.tw&json=1&delay=0"
    data = _fetch_json(url)
    msg_array = data.get("msgArray") or []
    if not msg_array:
        return None
    row = msg_array[0]
    price = row.get("z")
    if not price or price == '-':
        price = row.get("y")
    if not price or price == '-':
        return None
    return {
        "exists": True,
        "provider": "twse",
        "symbol": symbol,
        "name": row.get("n") or symbol,
        "currency": "TWD",
        "price": float(price),
        "exchangeName": "TWSE",
    }


def get_quote(symbol: str):
    errors = []
    sources = [yahoo_quote_chart, yahoo_quote_v7, stooq_quote, twse_quote]
    for fn in sources:
        try:
            quote = fn(symbol)
            if quote:
                return quote
        except Exception as e:
            errors.append(f"{fn.__name__}: {e}")
    return {"exists": False, "symbol": symbol, "error": " | ".join(errors) or "No quote from providers"}


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/quote":
            query = urllib.parse.parse_qs(parsed.query)
            symbol = (query.get("symbol") or [""])[0].strip()
            market = (query.get("market") or [""])[0].strip().upper()
            if not symbol:
                self.send_json({"exists": False, "error": "symbol is required"}, 400)
                return
            final_symbol = symbol.upper()
            if market == "TW" and final_symbol.isdigit() and ".TW" not in final_symbol:
                final_symbol = f"{final_symbol}.TW"
            payload = get_quote(final_symbol)
            code = 200 if payload.get("exists") else 502
            self.send_json(payload, code)
            return
        super().do_GET()

    def send_json(self, payload, code=200):
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"Serving at http://localhost:{PORT}")
    server.serve_forever()
