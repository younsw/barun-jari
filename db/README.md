# db

흡연시설 데이터를 담은 SQLite DB입니다.

| 파일 | 설명 |
|---|---|
| `schema.sql` | `smoking_facilities` 테이블 정의 |
| `import_csv.py` | CSV를 DB에 적재하는 스크립트 (같은 시설명+주소는 건너뜀) |
| `data/` | 원본 CSV (UTF-8로 변환해 보관) |
| `barun-jari.db` | 적재된 SQLite DB |

## 다시 만들기

```bash
rm -f db/barun-jari.db
python3 db/import_csv.py db/data/seoul_jungnang_smoking_facilities_20260212.csv
```

다른 구 CSV도 같은 명령으로 추가할 수 있습니다.

## 출처

서울특별시 중랑구 흡연시설 현황 (2026-02-12), 공공데이터포털
