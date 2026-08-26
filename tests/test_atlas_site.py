import gzip
import hashlib
import json
import unittest
from html.parser import HTMLParser
from pathlib import Path


REPO = Path(__file__).resolve().parents[1]
ATLAS = REPO / "docs" / "atlas"
DATA = ATLAS / "data"


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

    def test_pages_resolve_local_assets_and_show_provenance(self):
        pages = sorted(ATLAS.glob("*.html"))
        self.assertEqual(len(pages), 5)
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
        self.assertEqual(release["release"], "v0.1.0")
        self.assertEqual(
            release["site_archive_sha256"],
            "f709360677d8ffaf1ea88dff347c115a573b17f255aef6edd6b27e5b7f55f264",
        )
        oversized = [path for path in ATLAS.rglob("*") if path.is_file() and path.stat().st_size >= 100_000_000]
        self.assertEqual(oversized, [])


if __name__ == "__main__":
    unittest.main()
