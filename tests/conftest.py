"""Shared pytest fixtures. Tests run against the committed demo dataset, so
they never need the full download or network access.
"""
import os
import sys
from pathlib import Path

import pytest

# Ensure the repo root is importable and that we use the demo data, not any
# TAHOE_WEB_DATA_DIR that happens to be set in the environment.
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
os.environ.pop("TAHOE_WEB_DATA_DIR", None)

from app import data_loader as dl  # noqa: E402


@pytest.fixture(scope="session")
def conditions():
    return dl.load_condition_summary()


@pytest.fixture(scope="session")
def top_genes():
    return dl.load_top_de_genes()
