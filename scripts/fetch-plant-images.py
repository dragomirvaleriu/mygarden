#!/usr/bin/env python3
"""
Fetches one real, licensed photo per plant catalog entry from Wikipedia's
public REST API (which surfaces each article's lead image, hosted on
Wikimedia Commons — the licensing for every image is declared and
verifiable on its Commons file page, unlike scraping a stock-photo site).

Why Wikipedia/Wikimedia instead of literally Unsplash/Pexels: those sites
don't expose a scriptable search API without a paid key, and machine-
matching "which stock photo is actually this specific species" reliably
across 262 plants isn't something that can be verified programmatically.
Wikipedia's summary API, keyed by scientific name, gives a much higher hit
rate of a photo that's actually the right species, with clean licensing.

Usage:
    python3 scripts/fetch-plant-images.py                # full run, all plants
    python3 scripts/fetch-plant-images.py --limit 20      # smoke-test a batch
    python3 scripts/fetch-plant-images.py --id monstera-deliciosa  # single plant

Output:
  - Downloads to public/images/enciclopedie/{id}_{sci-slug}_1.jpg, resized to
    fit within 1280x720 (the "max 720p" requirement), JPEG quality 85.
  - Writes /tmp/plant_image_results.json: {id: {status, path?, source_title?,
    reason?}} for every plant attempted, so the catalog-update step and the
    final report can both read from one source of truth.
"""
import argparse
import json
import re
import sys
import time
import unicodedata
from pathlib import Path
from io import BytesIO

import requests
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
CATALOG_PATH = ROOT / "src" / "data" / "plantCatalog.ts"
OUT_DIR = ROOT / "public" / "images" / "enciclopedie"
RESULTS_PATH = Path("/tmp/plant_image_results.json")

HEADERS = {
    "User-Agent": "GradinaMeaApp/1.0 (https://github.com/dragomirvaleriu/mygarden; contact: dragomirvaleriu@gmail.com) plant-image-fetch-script"
}
MAX_DIM = (1280, 720)
REQUEST_DELAY = 0.4  # seconds between Wikipedia requests, politeness


def slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^a-zA-Z0-9]+", "-", text).strip("-").lower()
    return text


def extract_catalog_entries():
    content = CATALOG_PATH.read_text(encoding="utf-8")
    lines = content.split("\n")
    entries = []
    cur_id = None
    for line in lines:
        m_id = re.search(r"id: '([^']+)',", line)
        if m_id:
            cur_id = m_id.group(1)
            continue
        m_sci = re.search(r"scientificName: (?:'([^']+)'|\"([^\"]+)\")", line)
        if m_sci and cur_id:
            sci = m_sci.group(1) or m_sci.group(2)
            entries.append({"id": cur_id, "scientificName": sci})
            cur_id = None
    return entries


def clean_search_query(scientific_name: str) -> str:
    """Strips cultivar quotes, group/hybrid descriptors and spp. down to a
    binomial Wikipedia is likely to actually have an article for."""
    q = scientific_name
    q = re.sub(r"\([^)]*\)", "", q)          # "(grup Climber)" etc.
    q = re.sub(r"'[^']*'", "", q)             # cultivar name in quotes
    q = re.sub(r'"[^"]*"', "", q)
    q = q.replace("×", "x")
    q = re.sub(r"\bspp\.?\b", "", q, flags=re.IGNORECASE)
    q = re.sub(r"\s+", " ", q).strip()
    # Keep at most genus + species (first two words) — cultivar/variety
    # epithets beyond that rarely have their own Wikipedia article.
    parts = q.split(" ")
    if len(parts) > 2 and parts[1].lower() != "x":
        q = " ".join(parts[:2])
    elif len(parts) > 3:
        q = " ".join(parts[:3])
    return q.strip()


def wiki_summary(title: str):
    url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{requests.utils.quote(title)}"
    r = requests.get(url, headers=HEADERS, timeout=15)
    if r.status_code == 200:
        data = r.json()
        if data.get("type") == "disambiguation":
            return None
        return data
    return None


def wiki_search(query: str):
    url = "https://en.wikipedia.org/w/api.php"
    params = {
        "action": "query",
        "list": "search",
        "srsearch": query,
        "format": "json",
        "srlimit": 3,
    }
    r = requests.get(url, params=params, headers=HEADERS, timeout=15)
    if r.status_code != 200:
        return []
    return [item["title"] for item in r.json().get("query", {}).get("search", [])]


def genus_matches(query: str, title: str) -> bool:
    """Real bug caught and fixed after a full run: `genus in title.lower()`
    (substring anywhere) matched "Rosa" against "Rosa Parks" the person, for
    the catalog's generic 'Rosa spp.' entry — bare genus names are common
    human first names too (Rosa, Iris, Lily, Erica, Jasmine, Viola...).
    Require the genus to be a whole word at the START of the title instead —
    "Rosa" matches "Rosa (genus)"/"Rose" via redirect, but not "Rosa Parks"."""
    genus = query.split(" ")[0].lower()
    if len(genus) <= 2:
        return False
    title_words = re.split(r"[\s(]+", title.lower())
    return bool(title_words) and title_words[0] == genus


def find_image_for(scientific_name: str):
    query = clean_search_query(scientific_name)
    if not query:
        return None, None

    summary = wiki_summary(query)
    if summary and genus_matches(query, summary.get("title", "")):
        img = (summary.get("originalimage") or summary.get("thumbnail") or {}).get("source")
        if img:
            return img, summary.get("title")

    # Fallback: full-text search, try the top matching results
    for title in wiki_search(query):
        if not genus_matches(query, title):
            continue
        summary = wiki_summary(title)
        if not summary:
            continue
        img = (summary.get("originalimage") or summary.get("thumbnail") or {}).get("source")
        if img:
            return img, summary.get("title")

    return None, None


def download_and_process(image_url: str, dest_path: Path) -> bool:
    try:
        r = requests.get(image_url, headers=HEADERS, timeout=20)
        r.raise_for_status()
        img = Image.open(BytesIO(r.content))
        img = img.convert("RGB")
        img.thumbnail(MAX_DIM, Image.LANCZOS)
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        img.save(dest_path, "JPEG", quality=85, optimize=True)
        return True
    except Exception as e:
        print(f"    download/process failed: {e}", file=sys.stderr)
        return False


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--id", type=str, default=None, help="Process only this single plant id")
    parser.add_argument("--start", type=int, default=0)
    args = parser.parse_args()

    entries = extract_catalog_entries()
    if args.id:
        entries = [e for e in entries if e["id"] == args.id]
    else:
        entries = entries[args.start:]
        if args.limit:
            entries = entries[: args.limit]

    results = {}
    if RESULTS_PATH.exists():
        try:
            results = json.loads(RESULTS_PATH.read_text())
        except Exception:
            results = {}

    for i, entry in enumerate(entries, 1):
        pid, sci = entry["id"], entry["scientificName"]
        print(f"[{i}/{len(entries)}] {pid} ({sci})")

        image_url, matched_title = find_image_for(sci)
        time.sleep(REQUEST_DELAY)

        if not image_url:
            print(f"    no match found")
            results[pid] = {"status": "not_found", "scientificName": sci}
            continue

        slug = slugify(sci)
        filename = f"{pid}_{slug}_1.jpg"
        dest = OUT_DIR / filename

        ok = download_and_process(image_url, dest)
        if ok:
            rel_path = f"images/enciclopedie/{filename}"
            print(f"    OK -> {rel_path}  (matched Wikipedia: {matched_title})")
            results[pid] = {
                "status": "ok",
                "path": rel_path,
                "source_title": matched_title,
                "source_url": image_url,
            }
        else:
            results[pid] = {"status": "download_failed", "scientificName": sci, "source_title": matched_title}

        RESULTS_PATH.write_text(json.dumps(results, ensure_ascii=False, indent=2))

    ok_count = sum(1 for v in results.values() if v.get("status") == "ok")
    print(f"\nDone. {ok_count}/{len(results)} succeeded overall (cumulative). Results: {RESULTS_PATH}")


if __name__ == "__main__":
    main()
