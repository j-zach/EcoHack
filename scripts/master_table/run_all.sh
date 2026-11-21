#!/usr/bin/env bash
# End-to-end: coordinate report -> master table -> Tessera 2023 features -> models.
# Usage: PY=/path/to/python ./run_all.sh   (defaults to python3 on PATH)
# Inputs are expected under ~/ecohack/data/raw (see README.md); outputs go to ./out.
set -euo pipefail
cd "$(dirname "$0")"
PY="${PY:-python3}"
# python.org macOS builds ship without CA certs; use certifi's bundle (verification stays on).
export SSL_CERT_FILE="${SSL_CERT_FILE:-$("$PY" -c 'import certifi; print(certifi.where())')}"
"$PY" coords_report.py
"$PY" build_master.py
"$PY" tessera_features.py
"$PY" run_models.py
