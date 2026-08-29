"""Import smoke tests — modules and the Streamlit entrypoint must import
without side effects (the UI body is guarded by ``if __name__ == '__main__'``)."""
import importlib


def test_app_modules_import():
    for m in ("app", "app.data_loader", "app.plots", "app.statistics"):
        assert importlib.import_module(m) is not None


def test_streamlit_app_imports():
    mod = importlib.import_module("streamlit_app")
    assert hasattr(mod, "main")


def test_build_pipeline_imports():
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "pipeline"))
    mod = importlib.import_module("build_web_tables")
    # argparse wiring is valid
    args = mod.parse_args(["--source", "/x", "--out", "/y", "--plates", "6,14"])
    assert args.plates == "6,14" and args.top_n == 25
