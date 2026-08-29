"""Import smoke test for the plate-pair h5ad utilities.

run_plate_pair_h5ad.py, rebuild_detectable_signature.py, and
diagnose_signature_variance.py are written to run as standalone scripts in the
DNAnexus terminal (see their module docstrings), not as importable package
members: rebuild_detectable_signature.py and diagnose_signature_variance.py
both do `from run_plate_pair_h5ad import ...` rather than a relative import.
This test exercises that exact invocation shape -- analysis/ on sys.path,
plain top-level imports -- so a stale or broken cross-import (like the
PATCHED-file import this PR fixed) fails a test instead of surfacing only
when someone runs the real DNAnexus commands.
"""
import subprocess
import sys
from pathlib import Path

ANALYSIS_DIR = Path(__file__).resolve().parent.parent


def test_utilities_import_cleanly():
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            "import run_plate_pair_h5ad, rebuild_detectable_signature, diagnose_signature_variance",
        ],
        cwd=ANALYSIS_DIR,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr
