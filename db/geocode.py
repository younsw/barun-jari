"""카카오 로컬 API로 흡연시설 주소를 위도·경도로 바꿉니다.

사용법:
    KAKAO_REST_API_KEY=... python3 db/geocode.py
    (또는 저장소 루트 .env 파일에 KAKAO_REST_API_KEY=... 를 적어 두면 자동으로 읽습니다)

동작:
1. db/barun-jari.db에서 좌표가 비어 있는 시설만 고릅니다.
2. 주소 검색 → (실패 시) 층·호수를 뗀 주소로 다시 검색 → (실패 시) 시설명 키워드 검색
3. 결과를 SQLite에 저장하고, Supabase에 적용할 db/geocode_update.sql을 만듭니다.
4. 어떤 방법으로 찾았는지 db/data/geocode_report.csv에 남깁니다. keyword로 찾은 행은 직접 확인하세요.
"""

import csv
import json
import os
import re
import sqlite3
import time
import urllib.parse
import urllib.request
from pathlib import Path

DB_DIR = Path(__file__).resolve().parent
DB_PATH = DB_DIR / "barun-jari.db"
UPDATE_SQL_PATH = DB_DIR / "geocode_update.sql"
REPORT_PATH = DB_DIR / "data" / "geocode_report.csv"
API = "https://dapi.kakao.com/v2/local/search/{kind}.json?"


def load_key() -> str:
    key = os.environ.get("KAKAO_REST_API_KEY", "").strip()
    env_file = DB_DIR.parent / ".env"
    if not key and env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            if line.startswith("KAKAO_REST_API_KEY="):
                key = line.split("=", 1)[1].strip()
    if not key:
        raise SystemExit("KAKAO_REST_API_KEY가 없습니다 (.env 또는 환경변수에 넣어 주세요)")
    return key


def simplify_address(address: str) -> str:
    """'서울특별시 중랑구 면목동 359-15번지 지하1층' → '서울특별시 중랑구 면목동 359-15'
    '서울특별시 중랑구 동일로 802, 지하1층 (중화동, 대신빌딩)' → '서울특별시 중랑구 동일로 802'"""
    text = re.sub(r"\(.*?\)", " ", address).split(",")[0]
    text = re.sub(r"(\d+(?:-\d+)?)번지.*", r"\1", text)
    tokens = []
    for token in text.split():
        tokens.append(token)
        if re.fullmatch(r"\d+(?:-\d+)?", token):
            break
    return " ".join(tokens)


def search(key: str, kind: str, query: str) -> dict | None:
    url = API.format(kind=kind) + urllib.parse.urlencode({"query": query, "size": 1})
    request = urllib.request.Request(url, headers={"Authorization": f"KakaoAK {key}"})
    with urllib.request.urlopen(request, timeout=10) as response:
        documents = json.load(response)["documents"]
    return documents[0] if documents else None


def geocode(key: str, name: str, address: str, district: str) -> tuple[float, float, str] | None:
    attempts = [("address", address), ("address", simplify_address(address))]
    attempts.append(("keyword", f"{district} {name}"))
    seen = set()
    for kind, query in attempts:
        if query in seen:
            continue
        seen.add(query)
        doc = search(key, kind, query)
        time.sleep(0.05)
        if not doc:
            continue
        # 키워드 검색은 다른 구의 같은 이름 가게가 나올 수 있어 자치구를 확인합니다
        if kind == "keyword" and district not in doc.get("address_name", ""):
            continue
        method = "address" if query == address else ("address_simplified" if kind == "address" else "keyword")
        return float(doc["y"]), float(doc["x"]), method
    return None


def sql_text(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def main() -> None:
    key = load_key()
    conn = sqlite3.connect(DB_PATH)
    rows = conn.execute(
        "SELECT id, district, name, address FROM smoking_facilities WHERE latitude IS NULL OR longitude IS NULL ORDER BY id"
    ).fetchall()
    print(f"좌표 없는 시설 {len(rows)}건 변환 시작")

    report, updates = [], []
    for facility_id, district, name, address in rows:
        result = geocode(key, name, address, district)
        if result:
            lat, lng, method = result
            conn.execute("UPDATE smoking_facilities SET latitude = ?, longitude = ? WHERE id = ?", (lat, lng, facility_id))
            updates.append(
                f"update public.smoking_facilities set latitude = {lat}, longitude = {lng} "
                f"where name = {sql_text(name)} and address = {sql_text(address)};"
            )
        else:
            lat = lng = None
            method = "failed"
        report.append((facility_id, name, address, method, lat, lng))
    conn.commit()
    conn.close()

    UPDATE_SQL_PATH.write_text(
        "-- db/geocode.py가 만든 좌표 업데이트 (Supabase SQL Editor에서 실행)\n" + "\n".join(updates) + "\n",
        encoding="utf-8",
    )
    with REPORT_PATH.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["id", "name", "address", "method", "latitude", "longitude"])
        writer.writerows(report)

    counts = {}
    for row in report:
        counts[row[3]] = counts.get(row[3], 0) + 1
    print("결과:", ", ".join(f"{k} {v}건" for k, v in sorted(counts.items())))
    print(f"→ {UPDATE_SQL_PATH.name}, {REPORT_PATH.name} 생성. seed.sql도 갱신하려면 python3 db/export_seed.py")


if __name__ == "__main__":
    main()
