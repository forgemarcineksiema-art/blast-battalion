"""Tiny static dev server with caching disabled (so edits show up on reload).

POST /__shot?name=foo  with a PNG data-URL body saves <tempdir>/blast_shots/foo.png
(used for automated visual checks of the canvas during development).
POST /__shot?name=foo&ext=mp4  saves any base64 data-URL body as foo.mp4 (preview videos).
"""
import base64
import http.server
import os
import sys
import tempfile
import urllib.parse

SHOT_DIR = os.path.join(tempfile.gettempdir(), "blast_shots")


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

    def do_POST(self):
        url = urllib.parse.urlparse(self.path)
        if url.path != "/__shot":
            self.send_error(404)
            return
        query = urllib.parse.parse_qs(url.query)
        name = query.get("name", ["shot"])[0]
        name = "".join(ch for ch in name if ch.isalnum() or ch in "-_") or "shot"
        ext = query.get("ext", ["png"])[0]
        if ext not in ("png", "mp4", "webm", "json"):
            ext = "png"
        body = self.rfile.read(int(self.headers.get("Content-Length", 0))).decode("ascii", "ignore")
        data = body.split(",", 1)[1] if "," in body else body
        os.makedirs(SHOT_DIR, exist_ok=True)
        path = os.path.join(SHOT_DIR, name + "." + ext)
        with open(path, "wb") as f:
            f.write(base64.b64decode(data))
        self.send_response(200)
        self.end_headers()
        self.wfile.write(path.encode())

    def log_message(self, fmt, *args):  # keep the console quiet
        pass


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8321
    http.server.ThreadingHTTPServer(("127.0.0.1", port), NoCacheHandler).serve_forever()
