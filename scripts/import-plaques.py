"""Build the local catalogue from an Open Plaques worldwide CSV (openplaques.org/data).
Usage: python3 scripts/import-plaques.py download.csv > plaque-stories.json
The export contains public-domain data. No photographs are imported.
"""
import csv
import json
import math
import re
import sys
from collections import Counter

rules = [
    ("Filming locations", r"filmed (?:here|on this road|at Oakworth Station|in and around Pennan)|filming location"),
    ("Former uses of buildings", r"on this site stood|stood on this site|formerly (?:a|an|the)|originally (?:a|an|the)|was converted (?:from|into)"),
    ("Industrial heritage", r"\b(?:cotton mill|flour mill|watermill|windmill|colliery|ironworks|pumping station|canal lock|coal mine|railway station)\b"),
]
hook = re.compile(r"\b(?:first|invented|developed|founded|designed|built|discovered|composed|wrote|born here|lived here|worked here|opened|inventor)\b", re.I)
avoid = re.compile(r"\b(?:massacr\w*|slaughter\w*|lynch\w*|abuse\w*|sexual\w*|assault\w*|rape\w*|suicid\w*|murder\w*|shoot\w*|shot|kill\w*|blood\w*|execut\w*|tortur\w*|victims?|terroris\w*|prison\w*|bomb\w*|gun\w*|battle\w*|cemeter\w*|buried|burial|slaves?|slavery|unveiled by|erected by|sponsored by|translated|reverse side)\b|[<>\[\]]|https?://", re.I)
candidates = []
with open(sys.argv[1], encoding="utf-8-sig", newline="") as source:
    for row in csv.DictReader(source):
        text = " ".join(row["inscription"].split())
        place = row["area"].strip()
        country = row["country"].strip()
        name = row["lead_subject_name"].strip()
        if not name:
            heading, separator, _ = text.partition(". ")
            if separator and 2 <= len(heading.split()) <= 7 and len(heading) < 60:
                name = heading
        if not (place and country and name and row["language"] == "English" and row["photographed?"] == "true" and row["geolocated?"] == "true"):
            continue
        if text.endswith(("...", "…")):
            continue
        if not (12 <= len(text.split()) <= 75 and 3 <= len(name) <= 70):
            continue
        if avoid.search(name + " " + text) or not re.search(r"\b[12]\d{3}\b", text):
            continue
        subject = "Commemorative plaques"
        for kind, pattern in rules:
            evidence = name if kind == "Industrial heritage" else text
            if re.search(pattern, evidence, re.I):
                subject = kind
                break
        if subject in ("Commemorative plaques", "Industrial heritage") and not hook.search(text):
            continue
        try:
            lat, lon = float(row["latitude"]), float(row["longitude"])
        except ValueError:
            continue
        if not (-85 < lat < 85 and -180 <= lon <= 180 and (lat or lon)):
            continue
        heading, separator, remainder = text.partition(". ")
        if separator and len(heading.split()) <= 5 and len(remainder) >= 60 and not re.search(r"\b(?:St|Dr|Mr|Mrs|[A-Z])$", heading):
            text = remainder
        if text[-1] not in ".!?":
            text += "."
        candidates.append(dict(id=int(row["id"]), name=name, subject=subject, text=text, lat=lat, lon=lon, country=country, area=place))

# Prioritise the rarer subjects, then a spread of towns within each country.
candidates.sort(key=lambda p: (p["subject"] == "Commemorative plaques", -p["id"]))
counts = Counter()
seen = set()
out = []
for p in candidates:
    country, area = p["country"], p["area"]
    cell = (round(p["lat"]*10), round(p["lon"]*10*math.cos(math.radians(p["lat"]))), p["subject"])
    keys = {("cell", cell), ("name", area, p["name"].casefold()), ("text", p["text"].casefold())}
    if keys & seen or counts[country, area] >= 3 or counts[country] >= 240:
        continue
    seen.update(keys)
    counts[country, area] += 1
    counts[country] += 1
    out.append(p)
json.dump(out, sys.stdout, ensure_ascii=False, indent=1)
print()
