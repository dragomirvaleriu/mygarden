#!/usr/bin/env python3
"""Second pass for the 18 plants the main fetch-plant-images.py run missed —
mostly hybrid names with x/× symbols or cultivar quotes that need a manually
picked search query rather than the automatic cleanup heuristic."""
import json
import re
import time
import unicodedata
from pathlib import Path
from io import BytesIO

import requests
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "public" / "images" / "enciclopedie"
RESULTS_PATH = Path("/tmp/plant_image_results.json")

HEADERS = {
    "User-Agent": "GradinaMeaApp/1.0 (https://github.com/dragomirvaleriu/mygarden; contact: dragomirvaleriu@gmail.com) plant-image-fetch-script"
}
MAX_DIM = (1280, 720)

# id -> (search query to use, scientificName to slug the filename with)
OVERRIDES = {
    "margareta": "Leucanthemum vulgare",
    "picea-pungens": "Picea pungens",
    "althaea-rosea": "Alcea rosea",
    "gladiolus-hybridus": "Gladiolus",
    "stipa-tenuissima": "Nassella tenuissima",
    "cupressocyparis-leylandii": "Cuprocyparis leylandii",
    "aster-novi-belgii": "Symphyotrichum novi-belgii",
    "pennisetum-alopecuroides": "Pennisetum alopecuroides",
    "schizostylis-coccinea": "Hesperantha coccinea",
    "prunus-dulcis": "Prunus dulcis",
    "verbena-hibrid": "Verbena (plant)",
    "bacopa": "Chaenostoma cordatum",
    "calibrachoa": "Calibrachoa",
    "fuchsia": "Fuchsia",
    "nemesia": "Nemesia (plant)",
    "perovskia-atriplicifolia": "Salvia yangii",
    "centranthus-ruber": "Centranthus ruber",
    "verbascum-hybridum": "Verbascum",
}


def slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^a-zA-Z0-9]+", "-", text).strip("-").lower()
    return text


def wiki_summary(title):
    url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{requests.utils.quote(title)}"
    r = requests.get(url, headers=HEADERS, timeout=15)
    if r.status_code == 200:
        data = r.json()
        if data.get("type") == "disambiguation":
            return None
        return data
    return None


def download_and_process(image_url, dest_path):
    try:
        r = requests.get(image_url, headers=HEADERS, timeout=20)
        r.raise_for_status()
        img = Image.open(BytesIO(r.content)).convert("RGB")
        img.thumbnail(MAX_DIM, Image.LANCZOS)
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        img.save(dest_path, "JPEG", quality=85, optimize=True)
        return True
    except Exception as e:
        print(f"    failed: {e}")
        return False


def main():
    results = json.loads(RESULTS_PATH.read_text())
    for pid, query in OVERRIDES.items():
        print(f"{pid} -> searching '{query}'")
        summary = wiki_summary(query)
        time.sleep(0.4)
        if not summary:
            print("    still no match")
            continue
        img_url = (summary.get("originalimage") or summary.get("thumbnail") or {}).get("source")
        if not img_url:
            print("    no image on page")
            continue
        orig_sci = results.get(pid, {}).get("scientificName", query)
        slug = slugify(orig_sci)
        filename = f"{pid}_{slug}_1.jpg"
        dest = OUT_DIR / filename
        if download_and_process(img_url, dest):
            rel_path = f"images/enciclopedie/{filename}"
            print(f"    OK -> {rel_path} (matched: {summary.get('title')})")
            results[pid] = {
                "status": "ok",
                "path": rel_path,
                "source_title": summary.get("title"),
                "source_url": img_url,
            }
            RESULTS_PATH.write_text(json.dumps(results, ensure_ascii=False, indent=2))

    ok = sum(1 for v in results.values() if v.get("status") == "ok")
    print(f"\nDone. {ok}/{len(results)} succeeded overall (cumulative).")


if __name__ == "__main__":
    main()
