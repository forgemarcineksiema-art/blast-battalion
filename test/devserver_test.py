"""Exercise the capture endpoint through a real local HTTP server."""
import base64
from functools import partial
import http.client
import http.server
import importlib.util
import io
from pathlib import Path
import tempfile
import threading
import unittest
import zipfile


spec = importlib.util.spec_from_file_location(
    "devserver", Path(__file__).resolve().parents[1] / "tools" / "devserver.py"
)
devserver = importlib.util.module_from_spec(spec)
spec.loader.exec_module(devserver)


class CaptureExportTest(unittest.TestCase):
    def test_export_contains_only_requested_png_frames(self):
        with tempfile.TemporaryDirectory() as root:
            previous = devserver.SHOT_DIR
            devserver.SHOT_DIR = str(Path(root) / "shots")
            server = http.server.ThreadingHTTPServer(
                ("127.0.0.1", 0), partial(devserver.NoCacheHandler, directory=root)
            )
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            connection = http.client.HTTPConnection(*server.server_address, timeout=5)
            try:
                payload = b"actual-capture-bytes"
                for name, extension in (("demo_0000", "png"), ("demo_0001", "png"), ("other_0000", "png"), ("demo_ignored", "mp4")):
                    body = "data:application/octet-stream;base64," + base64.b64encode(payload).decode()
                    connection.request("POST", f"/__shot?name={name}&ext={extension}", body)
                    response = connection.getresponse()
                    self.assertEqual(response.status, 200)
                    response.read()
                connection.request("GET", "/__shots.zip?prefix=demo")
                response = connection.getresponse()
                self.assertEqual(response.status, 200)
                self.assertEqual(response.getheader("Content-Type"), "application/zip")
                self.assertIn("no-store", response.getheader("Cache-Control"))
                with zipfile.ZipFile(io.BytesIO(response.read())) as archive:
                    self.assertEqual(archive.namelist(), ["demo_0000.png", "demo_0001.png"])
                    self.assertEqual(archive.read("demo_0000.png"), payload)
                connection.request("GET", "/__shots.zip?prefix=missing")
                response = connection.getresponse()
                self.assertEqual(response.status, 404)
                response.read()
            finally:
                connection.close()
                server.shutdown()
                server.server_close()
                thread.join(timeout=5)
                devserver.SHOT_DIR = previous


if __name__ == "__main__":
    unittest.main()
