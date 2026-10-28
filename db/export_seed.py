"""SQLite DB(db/barun-jari.db)의 흡연시설을 Supabase용 seed SQL로 내보냅니다.

사용법:
    python3 db/export_seed.py

결과: db/seed.sql (migrations 적용 후 Supabase SQL Editor에서 실행)
같은 (시설명, 주소)는 건너뛰므로 여러 번 실행해도 됩니다.
"""

import sqlite3
from pathlib import Path

DB_DIR = Path(__file__).resolve().parent
DB_PATH = DB_DIR / "barun-jari.db"
SEED_PATH = DB_DIR / "seed.sql"

COLUMNS = ("district", "category", "name", "address", "room_count", "latitude", "longitude")


def sql_value(value) -> str:
    if value is None:
        return "null"
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def main() -> None:
    conn = sqlite3.connect(DB_PATH)
    rows = conn.execute(f"SELECT {', '.join(COLUMNS)} FROM smoking_facilities ORDER BY id").fetchall()
    conn.close()

    values = ",\n".join("  (" + ", ".join(sql_value(v) for v in row) + ")" for row in rows)
    SEED_PATH.write_text(
        "-- 흡연시설 seed (db/export_seed.py로 생성, 직접 고치지 마세요)\n"
        f"insert into public.smoking_facilities ({', '.join(COLUMNS)}) values\n"
        f"{values}\n"
        "on conflict (name, address) do nothing;\n",
        encoding="utf-8",
    )
    print(f"{len(rows)}건 → {SEED_PATH.name}")


if __name__ == "__main__":
    main()
