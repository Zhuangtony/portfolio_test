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
        "symbol": meta.get("symbol", symbol),
        "name": meta.get("longName") or meta.get("shortName") or meta.get("symbol", symbol),
        "currency": meta.get("currency"),
        "price": price,
        "previousClose": meta.get("previousClose"),
        "exchangeName": meta.get("exchangeName"),
        "source": "chart",
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
        "symbol": q.get("symbol", symbol),
        "name": q.get("longName") or q.get("shortName") or q.get("symbol", symbol),
        "currency": q.get("currency"),
        "price": price,
        "previousClose": q.get("regularMarketPreviousClose"),
        "exchangeName": q.get("fullExchangeName") or q.get("exchange"),
        "source": "quote",
    }


def yahoo_quote(symbol: str):
    errors = []
    for fn in (yahoo_quote_chart, yahoo_quote_v7):
        try:
            quote = fn(symbol)
            if quote:
                return quote
        except Exception as e:
            errors.append(f"{fn.__name__}: {e}")
    return {"exists": False, "symbol": symbol, "error": " | ".join(errors) or "Symbol not found"}


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
            payload = yahoo_quote(final_symbol)
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
