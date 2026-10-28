"""흡연시설 CSV를 SQLite DB(db/barun-jari.db)에 적재합니다.

사용법:
    python3 db/import_csv.py db/data/seoul_jungnang_smoking_facilities_20260212.csv

CSV 헤더: 업종, 시설명(업소), 주소, 흡연실 개소수
UTF-8과 CP949(공공데이터 기본 인코딩) 모두 읽을 수 있습니다.
같은 (시설명, 주소)는 한 번만 들어갑니다.
"""

import csv
import re
import sqlite3
import sys
from pathlib import Path

DB_DIR = Path(__file__).resolve().parent
DB_PATH = DB_DIR / "barun-jari.db"
SCHEMA_PATH = DB_DIR / "schema.sql"


def read_rows(csv_path: Path) -> list[dict]:
    for encoding in ("utf-8-sig", "cp949"):
        try:
            with csv_path.open(encoding=encoding, newline="") as f:
                return list(csv.DictReader(f))
        except UnicodeDecodeError:
            continue
    raise ValueError(f"인코딩을 알 수 없습니다: {csv_path}")


def clean(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    csv_path = Path(sys.argv[1])
    rows = read_rows(csv_path)

    conn = sqlite3.connect(DB_PATH)
    conn.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))

    inserted = 0
    for row in rows:
        address = clean(row["주소"])
        district = next((w for w in address.split() if w.endswith("구")), "")
        cur = conn.execute(
            """INSERT OR IGNORE INTO smoking_facilities
               (district, category, name, address, room_count, source)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (
                district,
                clean(row["업종"]),
                clean(row["시설명(업소)"]),
                address,
                int(row["흡연실 개소수"] or 1),
                csv_path.name,
            ),
        )
        inserted += cur.rowcount
    conn.commit()

    total = conn.execute("SELECT COUNT(*) FROM smoking_facilities").fetchone()[0]
    conn.close()
    print(f"CSV {len(rows)}행 중 {inserted}행 추가 (중복 {len(rows) - inserted}행 건너뜀), DB 전체 {total}행")


if __name__ == "__main__":
    main()
