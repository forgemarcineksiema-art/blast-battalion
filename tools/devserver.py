"""Tiny static dev server with caching disabled (so edits show up on reload).

POST /__shot?name=foo  with a PNG data-URL body saves <tempdir>/blast_shots/foo.png
(used for automated visual checks of the canvas during development).
POST /__shot?name=foo&ext=mp4  saves any base64 data-URL body as foo.mp4 (preview videos).
"""
import base64
import argparse
from functools import partial
import http.server
import io
import os
import tempfile
import urllib.parse
import zipfile

SHOT_DIR = os.path.join(tempfile.gettempdir(), "blast_shots")


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

    def do_GET(self):
        url = urllib.parse.urlparse(self.path)
        if url.path != "/__shots.zip":
            return super().do_GET()
        prefix = urllib.parse.parse_qs(url.query).get("prefix", [""])[0]
        prefix = "".join(ch for ch in prefix if ch.isalnum() or ch in "-_")
        names = sorted(name for name in os.listdir(SHOT_DIR) if name.startswith(prefix + "_") and name.endswith(".png")) if prefix and os.path.isdir(SHOT_DIR) else []
        if not names:
            self.send_error(404, "No captured frames for this prefix")
            return
        output = io.BytesIO()
        with zipfile.ZipFile(output, "w", zipfile.ZIP_STORED) as archive:
            for name in names:
                archive.write(os.path.join(SHOT_DIR, name), name)
        data = output.getvalue()
        self.send_response(200)
        self.send_header("Content-Type", "application/zip")
        self.send_header("Content-Disposition", 'attachment; filename="' + prefix + '-frames.zip"')
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

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
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("legacy_port", nargs="?", type=int, help="port (default: 8321)")
    parser.add_argument("--port", type=int)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--directory", default=".")
    # Binding already fails rather than silently choosing another port.
    parser.add_argument("--strictPort", action="store_true")
    args = parser.parse_args()
    port = args.port if args.port is not None else args.legacy_port or 8321
    handler = partial(NoCacheHandler, directory=args.directory)
    http.server.ThreadingHTTPServer((args.host, port), handler).serve_forever()
