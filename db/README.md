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

## Supabase (실서비스용)

| 파일 | 설명 |
|---|---|
| `migrations/001_users.sql` | 회원 (성인 인증 여부, 관리자 여부). 가입 시 자동 생성 |
| `migrations/002_smoking_facilities.sql` | 흡연시설 (누구나 조회) |
| `migrations/003_reports.sql` | 오류 신고 (성인 인증 회원만 작성, 상태 변경은 관리자만) |
| `migrations/004_point_ledger.sql` | 포인트 (하루 최대 10점, 신고 반영 시 +3, 중복 적립 방지) |
| `seed.sql` | 흡연시설 242건 (`python3 db/export_seed.py`로 생성) |

적용 순서: Supabase SQL Editor에서 `migrations/` 파일을 번호 순서대로 실행한 뒤 `seed.sql`을 실행합니다.

화면에서 쓰는 함수:
- 포인트 요약: `supabase.rpc('get_my_point_summary')` → `{ total, today, daily_limit }`
- 포인트 적립은 화면에서 직접 할 수 없습니다. 신고가 `accepted`가 되면 DB가 자동으로 적립합니다.
- 관리자 지정: Supabase 대시보드에서 `users.is_admin`을 `true`로 바꿉니다.

## 출처

서울특별시 중랑구 흡연시설 현황 (2026-02-12), 공공데이터포털
