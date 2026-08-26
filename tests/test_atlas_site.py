import gzip
import hashlib
import json
import unittest
from html.parser import HTMLParser
from pathlib import Path


REPO = Path(__file__).resolve().parents[1]
ATLAS = REPO / "docs" / "atlas"
DATA = ATLAS / "data"
QUERY_DATA = REPO / "docs" / "data"
QUERY_PAGES = ("explore.html", "compare.html", "signature.html", "coverage.html", "methods.html")


def read_json(path: Path):
    opener = gzip.open if path.suffix == ".gz" else open
    with opener(path, "rt", encoding="utf-8") as handle:
        return json.load(handle)


class LinkParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []

    def handle_starttag(self, _tag, attrs):
        values = dict(attrs)
        self.links.extend(values[key] for key in ("href", "src") if key in values)


class AtlasSiteTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.conditions = read_json(DATA / "search" / "conditions.json.gz")["conditions"]

    def test_all_json_assets_parse(self):
        paths = list(DATA.rglob("*.json")) + list(DATA.rglob("*.json.gz"))
        self.assertGreater(len(paths), 180)
        for path in paths:
            with self.subTest(path=path):
                read_json(path)

    def test_condition_and_shard_contracts(self):
        self.assertEqual(len(self.conditions), 65_218)
        self.assertTrue(all(row["i"] == index for index, row in enumerate(self.conditions)))
        shards = sorted((DATA / "compare").glob("*.json.gz"))
        self.assertEqual(len(shards), 50)
        for path in shards:
            payload = read_json(path)
            self.assertIs(payload["is_demo"], False)
            keys = [
                (row["drug"], round(row["conc"], 6), str(row["plate"]))
                for row in payload["conditions"]
            ]
            self.assertEqual(len(keys), len(set(keys)), f"ambiguous condition in {path.name}")

    def test_search_index_and_smoke_query(self):
        buckets = sorted((DATA / "search" / "buckets").glob("b*.json.gz"))
        self.assertEqual(len(buckets), 128)
        genes = set(read_json(DATA / "gene_list.json")["genes"])
        query = [gene for gene in ("MKI67", "TOP2A", "CCNB1", "BIRC5", "CENPF") if gene in genes]
        self.assertEqual(len(query), 5)

        def bucket_of(gene):
            return sum(map(ord, gene)) % 128

        postings = {}
        for bucket in {bucket_of(gene) for gene in query}:
            postings.update(read_json(DATA / "search" / "buckets" / f"b{bucket}.json.gz"))
        scores, hits = {}, {}
        for gene in query:
            for condition_id, log2fc in postings[gene]:
                scores[condition_id] = scores.get(condition_id, 0.0) + log2fc
                hits[condition_id] = hits.get(condition_id, 0) + 1
        retained = [scores[key] / len(query) for key in scores if hits[key] >= 3]
        self.assertTrue(any(score > 0 for score in retained))
        self.assertTrue(any(score < 0 for score in retained))

    def test_download_manifest_checksums(self):
        manifest = read_json(DATA / "downloads_manifest.json")
        self.assertIs(manifest["is_demo"], False)
        self.assertEqual(len(manifest["files"]), 9)
        for record in manifest["files"]:
            path = DATA / "downloads" / record["file"]
            content = path.read_bytes()
            self.assertEqual(len(content), record["bytes"])
            self.assertEqual(hashlib.sha256(content).hexdigest(), record["sha256"])

        extension = read_json(DATA / "extensions" / "release_manifest.json")
        self.assertIs(extension["is_demo"], False)
        self.assertTrue(extension["no_raw_single_cell_in_package"])
        self.assertEqual(len(extension["downloads"]), 11)
        for record in extension["downloads"]:
            relative = Path(record["file"]).relative_to("data")
            path = DATA / "extensions" / relative
            content = path.read_bytes()
            self.assertEqual(len(content), record["bytes"])
            self.assertEqual(hashlib.sha256(content).hexdigest(), record["sha256"])

    def test_extension_scientific_contracts(self):
        mutation = read_json(DATA / "extensions" / "mutation_context.json")
        cells = read_json(DATA / "extensions" / "cell_level.json")
        dose = read_json(DATA / "extensions" / "dose_response.json")
        self.assertIs(mutation["is_demo"], False)
        self.assertIs(cells["is_demo"], False)
        self.assertIs(dose["is_demo"], False)
        self.assertEqual(len(mutation["drivers"]), 33)
        self.assertEqual(mutation["n_response_tests"], 35_092)
        self.assertEqual(mutation["n_response_sig"], 653)
        self.assertEqual(mutation["n_pathway_sig"], 4)
        self.assertIn("HC3", mutation["method"])
        self.assertTrue(all("hc3_p" in row for row in mutation["top_response_associations"]))

        self.assertEqual(cells["n_real"], 96)
        keys = [(row["cell_line"], row["drug"], row["concentration"]) for row in cells["conditions"]]
        self.assertEqual(len(keys), len(set(keys)))
        for row in cells["conditions"]:
            for key in ("control_like_frac_p90", "control_like_frac_p95", "control_like_frac_p99"):
                self.assertGreaterEqual(row[key], 0)
                self.assertLessEqual(row[key], 1)

        self.assertEqual(dose["n_full_3dose_pseudobulk"], 18_927)
        self.assertEqual(len(dose["pilot_dose_curves"]), 96)
        self.assertEqual(len(dose["cell_level_pilot"]), 96)
        for curve in dose["pilot_dose_curves"]:
            self.assertEqual(len(curve["doses_uM"]), 3)
            for observed, expected in zip(sorted(curve["doses_uM"]), (0.05, 0.5, 5.0)):
                self.assertAlmostEqual(observed, expected, places=6)
        self.assertTrue(dose["ec50"].lower().startswith("not"))

    def test_pages_resolve_local_assets_and_show_provenance(self):
        pages = sorted(ATLAS.glob("*.html"))
        self.assertEqual(len(pages), 9)
        for page in pages:
            text = page.read_text(encoding="utf-8")
            self.assertIn("static.cloudflareinsights.com/beacon.min.js", text)
            self.assertIn("data-release", text)
            parser = LinkParser()
            parser.feed(text)
            for link in parser.links:
                if not link or link.startswith(("#", "http:", "https:", "mailto:", "data:")):
                    continue
                target = (page.parent / link.split("?", 1)[0].split("#", 1)[0]).resolve()
                self.assertTrue(target.exists(), f"{page.name}: missing {link}")

    def test_release_and_github_size_guard(self):
        release = read_json(DATA / "release.json")
        self.assertIs(release["is_demo"], False)
        self.assertEqual(release["release"], "v0.2.0")
        self.assertEqual(
            release["base_site_archive_sha256"],
            "f709360677d8ffaf1ea88dff347c115a573b17f255aef6edd6b27e5b7f55f264",
        )
        self.assertEqual(
            release["extension_source_archive_sha256"],
            "2b60e9d618161fabf84b302a6a7553bdcb0abddac84718231b1fcbd4ff40e207",
        )
        oversized = [path for path in ATLAS.rglob("*") if path.is_file() and path.stat().st_size >= 100_000_000]
        self.assertEqual(oversized, [])


class RealQueryToolTests(unittest.TestCase):
    def test_compressed_query_data_contract(self):
        meta = read_json(QUERY_DATA / "meta.json")
        conditions = read_json(QUERY_DATA / "conditions.json.gz")
        genes = read_json(QUERY_DATA / "sig" / "genes.json.gz")

        self.assertIs(meta["is_demo"], False)
        self.assertEqual(meta["n_conditions"], 65_218)
        self.assertEqual(meta["n_cell_lines"], 50)
        self.assertEqual(meta["n_drugs"], 379)
        self.assertEqual(len(conditions["rows"]), meta["n_conditions"])
        self.assertEqual(genes["n_conditions"], meta["n_conditions"])
        self.assertEqual(genes["n_genes"], 39_654)
        self.assertEqual(len(genes["genes"]), genes["n_genes"])
        self.assertEqual(len(genes["ensembl"]), genes["n_genes"])
        self.assertEqual((QUERY_DATA / "sig" / "post_cond.bin").stat().st_size, genes["n_postings"] * 2)
        self.assertEqual((QUERY_DATA / "sig" / "post_w.bin").stat().st_size, genes["n_postings"] * 2)
        self.assertEqual(len(list((QUERY_DATA / "explore").rglob("*.json.gz"))), 429)
        self.assertEqual(len(list((QUERY_DATA / "profiles").glob("*.json.gz"))), 129)

    def test_query_data_manifest(self):
        rows = (QUERY_DATA / "real_query_manifest.sha256").read_text(encoding="utf-8").splitlines()
        self.assertEqual(len(rows), 562)
        seen = set()
        for row in rows:
            digest, relative = row.split("  ", 1)
            self.assertNotIn(relative, seen)
            seen.add(relative)
            content = (QUERY_DATA / relative).read_bytes()
            self.assertEqual(hashlib.sha256(content).hexdigest(), digest, relative)

    def test_query_pages_resolve_assets_and_include_analytics(self):
        for page_name in QUERY_PAGES:
            page = REPO / "docs" / page_name
            text = page.read_text(encoding="utf-8")
            self.assertIn("static.cloudflareinsights.com/beacon.min.js", text)
            parser = LinkParser()
            parser.feed(text)
            for link in parser.links:
                if not link or link.startswith(("#", "http:", "https:", "mailto:", "data:")):
                    continue
                target = (page.parent / link.split("?", 1)[0].split("#", 1)[0]).resolve()
                self.assertTrue(target.exists(), f"{page.name}: missing {link}")

    def test_query_package_has_no_uncompressed_bulk_export(self):
        self.assertFalse((QUERY_DATA / "conditions.json").exists())
        self.assertEqual(list((QUERY_DATA / "explore").rglob("*.json")), [])
        self.assertEqual(list((QUERY_DATA / "profiles").glob("*.json")), [])
        self.assertEqual(list((QUERY_DATA / "sig").glob("*.json")), [])
        oversized = [path for path in QUERY_DATA.rglob("*") if path.is_file() and path.stat().st_size >= 100_000_000]
        self.assertEqual(oversized, [])


if __name__ == "__main__":
    unittest.main()
