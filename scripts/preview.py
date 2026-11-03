"""Serve the site locally, with read-only access to the deployed weather endpoint."""

import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parent.parent
WEATHER_PATH = "/.netlify/functions/metar-live"
WEATHER_URL = "https://converse-flying-eagles.netlify.app" + WEATHER_PATH


class PreviewHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        if urlsplit(self.path).path != WEATHER_PATH:
            return super().do_GET()

        # Fixed public read endpoint only; never forward browser credentials or writes.
        try:
            request = Request(WEATHER_URL, headers={"Accept": "application/json"})
            with urlopen(request, timeout=15) as response:
                data = json.load(response)
            if not isinstance(data, list):
                raise ValueError("Unexpected weather response")
            status = 200
        except (HTTPError, URLError, TimeoutError, ValueError, OSError):
            status = 502
            data = {"error": "Weather data is temporarily unavailable. Please try again later."}

        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=4173)
    args = parser.parse_args()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), PreviewHandler)
    print(f"Serving {ROOT}\nPreview: http://127.0.0.1:{args.port}/", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
