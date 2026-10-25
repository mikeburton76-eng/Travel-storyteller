#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
python3 -c 'import sys; assert sys.version_info >= (3,12), "Python 3.12 or newer is required for this pinned voice runtime"'
python3 -m venv .piper-python
.piper-python/bin/python -m pip install --disable-pip-version-check -r requirements-voice.txt
