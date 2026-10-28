-- 바른자리 흡연시설 DB 스키마 (SQLite)

CREATE TABLE IF NOT EXISTS smoking_facilities (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  district      TEXT    NOT NULL,              -- 자치구 (예: 중랑구)
  category      TEXT    NOT NULL,              -- 업종 (게임업소, 체육시설업 ...)
  name          TEXT    NOT NULL,              -- 시설명(업소)
  address       TEXT    NOT NULL,              -- 주소 (공백 정리된 원문)
  room_count    INTEGER NOT NULL DEFAULT 1,    -- 흡연실 개소수
  latitude      REAL,                          -- 위도 (지오코딩 후 채움)
  longitude     REAL,                          -- 경도 (지오코딩 후 채움)
  source        TEXT    NOT NULL,              -- 원본 데이터 파일명
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (name, address)
);

CREATE INDEX IF NOT EXISTS idx_facilities_district ON smoking_facilities (district);
CREATE INDEX IF NOT EXISTS idx_facilities_category ON smoking_facilities (category);
CREATE INDEX IF NOT EXISTS idx_facilities_location ON smoking_facilities (latitude, longitude);
