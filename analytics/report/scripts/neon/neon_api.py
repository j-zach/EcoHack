"""Minimal NEON Data API helpers (stdlib only).

The API token is read from ~/.neon_token (or NEON_TOKEN) and is only ever
sent to data.neonscience.org, as the X-API-Token header. It is never printed.
Never commit the token.

Run from this folder:
    python3 list_its_files.py its_files.json
    python3 its_prevalence.py its_files.json <cache_dir> <out_dir> 2023 2024
"""
import json
import os
import pathlib
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request

API = "https://data.neonscience.org/api/v0"
# python.org builds on macOS ship without CA certificates; use the system bundle if present.
_CAFILE = "/etc/ssl/cert.pem"
CTX = ssl.create_default_context(cafile=_CAFILE) if os.path.exists(_CAFILE) else ssl.create_default_context()
UA = "ecohack-prevalence-check"


def _token():
    tok = os.environ.get("NEON_TOKEN")
    if not tok:
        p = pathlib.Path.home() / ".neon_token"
        tok = p.read_text().strip() if p.exists() else ""
    if not tok:
        raise SystemExit("No NEON token: set NEON_TOKEN or save it to ~/.neon_token")
    return tok


_TOKEN = None


def fetch(url, tries=5):
    """GET a URL; adds the token only for data.neonscience.org."""
    global _TOKEN
    headers = {"User-Agent": UA}
    if urllib.parse.urlparse(url).hostname == "data.neonscience.org":
        if _TOKEN is None:
            _TOKEN = _token()
        headers["X-API-Token"] = _TOKEN
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=120, context=CTX) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504) and i < tries - 1:
                time.sleep(2 ** i)
                continue
            raise
        except urllib.error.URLError:
            if i < tries - 1:
                time.sleep(2 ** i)
                continue
            raise


def get_json(path):
    return json.loads(fetch(f"{API}/{path}"))["data"]
