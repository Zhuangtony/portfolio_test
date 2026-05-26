#!/usr/bin/env python3
import json
import urllib.parse
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = 8000


def yahoo_quote(symbol: str):
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{urllib.parse.quote(symbol)}?interval=1d&range=1d"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=10) as r:
        data = json.loads(r.read().decode("utf-8"))
    chart = data.get("chart", {})
    result = chart.get("result")
    if not result:
        return {"exists": False, "symbol": symbol, "error": "Symbol not found"}
    meta = result[0].get("meta", {})
    return {
        "exists": True,
        "symbol": meta.get("symbol", symbol),
        "name": meta.get("longName") or meta.get("shortName") or meta.get("symbol", symbol),
        "currency": meta.get("currency"),
        "price": meta.get("regularMarketPrice"),
        "previousClose": meta.get("previousClose"),
        "exchangeName": meta.get("exchangeName"),
    }


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
            try:
                payload = yahoo_quote(final_symbol)
                self.send_json(payload, 200)
            except Exception as e:
                self.send_json({"exists": False, "symbol": final_symbol, "error": str(e)}, 502)
            return
        super().do_GET()

    def send_json(self, payload, code=200):
        raw = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"Serving at http://localhost:{PORT}")
    server.serve_forever()
