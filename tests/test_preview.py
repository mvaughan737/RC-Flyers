import importlib.util
import io
import json
from pathlib import Path
import threading
import unittest
from unittest.mock import patch
from urllib.error import HTTPError, URLError
from urllib.request import urlopen


spec = importlib.util.spec_from_file_location(
    "preview", Path(__file__).resolve().parent.parent / "scripts" / "preview.py"
)
preview = importlib.util.module_from_spec(spec)
spec.loader.exec_module(preview)


class PreviewTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = preview.ThreadingHTTPServer(("127.0.0.1", 0), preview.PreviewHandler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = f"http://127.0.0.1:{cls.server.server_port}"

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join()

    def test_weather_returns_json_and_never_forwards_client_credentials(self):
        reports = [{"icaoId": "KOKK", "visib": "10+"}]
        with patch.object(preview, "urlopen", return_value=io.BytesIO(json.dumps(reports).encode())) as upstream:
            with urlopen(self.base + preview.WEATHER_PATH + "?cache=123") as response:
                self.assertEqual(response.headers.get_content_type(), "application/json")
                self.assertEqual(json.load(response), reports)
            request = upstream.call_args.args[0]
            self.assertEqual(request.full_url, preview.WEATHER_URL)
            self.assertIsNone(request.get_header("Authorization"))

    def test_outage_returns_json_error_instead_of_html(self):
        with patch.object(preview, "urlopen", side_effect=URLError("upstream offline")):
            with self.assertRaises(HTTPError) as result:
                urlopen(self.base + preview.WEATHER_PATH)
            self.assertEqual(result.exception.code, 502)
            self.assertEqual(result.exception.headers.get_content_type(), "application/json")
            self.assertIn("temporarily unavailable", json.load(result.exception)["error"])

    def test_membership_still_served_from_project_root(self):
        with urlopen(self.base + "/membership.html") as response:
            self.assertEqual(response.read(), (preview.ROOT / "membership.html").read_bytes())


if __name__ == "__main__":
    unittest.main()
