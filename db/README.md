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
| `migrations/005_function_permissions.sql` | 함수 호출 권한 정리 (Supabase 보안 점검 반영) |
| `migrations/006_adult_verification.sql` | 성인 인증 저장 함수 (임시 출생연도 인증, 서버에서 다시 판단) |
| `migrations/007_report_photos.sql` | 신고 현장 사진: `reports.photo_path`, 비공개 버킷 `report-photos` (JPEG·5MB, 본인 폴더만) |
| `seed.sql` | 흡연시설 242건 (`python3 db/export_seed.py`로 생성) |

적용 상태: Supabase 프로젝트 `barun-jari`(tnpbliawewjtnhubcqei)에 001~007과 seed가 적용되어 있습니다. 새 프로젝트에 적용할 때는 SQL Editor에서 `migrations/`를 번호 순서대로 실행한 뒤 `seed.sql`을 실행합니다.

화면에서 쓰는 함수:
- 포인트 요약: `supabase.rpc('get_my_point_summary')` → `{ total, today, daily_limit }`
- 포인트 적립은 화면에서 직접 할 수 없습니다. 신고가 `accepted`가 되면 DB가 자동으로 적립합니다.
- 관리자 지정: Supabase 대시보드에서 `users.is_admin`을 `true`로 바꿉니다.

## 좌표 채우기 (지오코딩)

```bash
# .env에 KAKAO_REST_API_KEY=... 를 넣은 뒤
python3 db/geocode.py      # SQLite에 위도·경도 저장 + geocode_update.sql 생성
python3 db/export_seed.py  # seed.sql에도 좌표 반영
```

`geocode_update.sql`을 Supabase SQL Editor에서 실행하면 실서비스 DB에도 좌표가 들어갑니다.
`data/geocode_report.csv`에서 `keyword`(시설명으로 찾음)·`failed` 행은 직접 확인하세요.

## 출처

서울특별시 중랑구 흡연시설 현황 (2026-02-12), 공공데이터포털
