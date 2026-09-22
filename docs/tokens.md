# Instagram 토큰 가이드

토큰은 두 개입니다. 절대 한 칸에 섞지 마세요.

| 용도 | env | Secret Manager | 발급 방식 | 수명 |
|---|---|---|---|---|
| 올리기, 목록, 토큰 갱신 | `INSTAGRAM_ACCESS_TOKEN` | `instagram-access-token` | Instagram Login | 약 60일. 업로더/리프레셔가 자동 갱신 |
| 게시물 삭제 | `INSTAGRAM_DELETE_ACCESS_TOKEN` | `instagram-delete-access-token` | Facebook Login | 약 60일. **Explorer 값은 1~2시간** |

삭제 host:

```env
INSTAGRAM_DELETE_GRAPH_API_BASE="https://graph.facebook.com/v25.0"
```

앱 ID/시크릿은 로컬 `.env`에 넣지 않습니다. 삭제 토큰을 **장기 토큰으로 바꿀 때**와 Cloud Run 리프레셔(`sunrin-today-instagram-token-refresher`)에만 씁니다.

- Secret: `instagram-delete-app-id`, `instagram-delete-app-secret`
- 앱: Meta 앱 **Sunrin Today Manager** → 앱 설정 → 기본 설정
- Instagram 로그인 화면의 Instagram 앱 ID/시크릿이 아닙니다.

실제 토큰 값은 git에 올리지 마세요. `.env`, `tokens/`는 gitignore입니다.

---

## 올리기 토큰이 깨졌을 때

`Cannot parse access token`이면 `INSTAGRAM_ACCESS_TOKEN`이 깨졌거나 Facebook 토큰이 들어간 겁니다. Graph API Explorer 토큰을 여기에 넣으면 안 됩니다.

프로덕션 Job이 오늘도 올리고 있으면 Secret Manager 값이 맞습니다. 그걸 로컬에 다시 넣으세요. 값은 채팅/커밋에 붙이지 마세요.

```bash
gcloud secrets versions access latest --secret=instagram-access-token --project=sunrin-today
```

나온 값만 `INSTAGRAM_ACCESS_TOKEN`에 넣습니다. 앞뒤 따옴표·공백·JSON 전체가 들어가면 다시 `Cannot parse`가 납니다.

---

## 올리기 토큰 새로 발급

Secret Manager 값도 안 되면, **올리는 앱**(Sunrin Today Manager가 아님)에서 Instagram Login 토큰을 다시 받습니다.

1. [developers.facebook.com/apps](https://developers.facebook.com/apps)에서 원래 업로더용 Meta 앱을 엽니다
2. 이용 사례 → **Instagram 로그인이 포함된 API 설정**
3. Instagram 앱 ID / Instagram 앱 시크릿이 보이는 화면입니다
4. **액세스 토큰 생성** 또는 **계정 추가** → `@sunrin_today`로 로그인
5. 대시보드에서 만든 토큰은 약 60일짜리입니다

대시보드에 생성 버튼이 없으면 OAuth로 받습니다. `REDIRECT`는 앱에 등록된 리다이렉트 URL과 같아야 합니다.

```bash
# 브라우저에서 열고 로그인. 주소창의 code= 값을 복사
open "https://www.instagram.com/oauth/authorize?client_id=INSTAGRAM앱ID&redirect_uri=REDIRECT&response_type=code&scope=instagram_business_basic,instagram_business_content_publish"

# 단기 토큰
curl -s -X POST https://api.instagram.com/oauth/access_token \
  -F client_id=INSTAGRAM앱ID \
  -F client_secret=INSTAGRAM앱시크릿 \
  -F grant_type=authorization_code \
  -F redirect_uri=REDIRECT \
  -F code=주소창의code

# 장기로 교환. expires_in이 500만 근처여야 함
curl -s "https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=INSTAGRAM앱시크릿&access_token=단기토큰"
```

장기 토큰을 `.env`의 `INSTAGRAM_ACCESS_TOKEN`과 Secret Manager에 넣습니다.

```bash
printf '%s' '장기토큰' | gcloud secrets versions add instagram-access-token --project=sunrin-today --data-file=-
```

확인:

```bash
pnpm run verify
```

`username: sunrin_today`가 나오면 됩니다.

---

## 삭제 토큰 다시 받기

Explorer **Generate Access Token**은 항상 단기입니다. 그걸 그대로 `.env`에 넣으면 1~2시간 뒤 `Session has expired`가 납니다.

### 1. Graph API Explorer

1. https://developers.facebook.com/tools/explorer/
2. Meta 앱: **Sunrin Today Manager**
3. User Token
4. 권한: `instagram_basic`, `instagram_manage_contents`, `pages_show_list`, `pages_read_engagement`
5. Generate Access Token → 선린투데이 페이지 접근 허용

### 2. 장기로 교환

```bash
curl -s "https://graph.facebook.com/v25.0/oauth/access_token?grant_type=fb_exchange_token&client_id=삭제용앱ID&client_secret=삭제용앱시크릿&fb_exchange_token=Explorer토큰"
```

`expires_in`이 500만 근처(약 60일)여야 합니다. 3600~7200이면 아직 단기입니다.

### 3. 수명 확인

`data_access_expires_at`은 약 90일짜리 데이터 접근 기한입니다. 토큰 수명이 아닙니다. **`expires_at`만** 보면 됩니다.

```bash
curl -s "https://graph.facebook.com/debug_token?input_token=장기토큰&access_token=앱ID|앱시크릿"
```

`expires_at`이 오늘이면 단기, 한 달 뒤면 장기입니다.

### 4. 저장

로컬 `.env`:

```env
INSTAGRAM_DELETE_ACCESS_TOKEN="2에서 받은 장기 토큰"
INSTAGRAM_DELETE_GRAPH_API_BASE="https://graph.facebook.com/v25.0"
```

프로덕션:

```bash
printf '%s' '장기토큰' | gcloud secrets versions add instagram-delete-access-token --project=sunrin-today --data-file=-
```

리프레셔와 업로더 Job 둘 다 이 시크릿을 씁니다. 앱 ID/시크릿은 리프레셔에만 있으면 됩니다.

Job에 아직 안 붙어 있으면:

```bash
gcloud secrets add-iam-policy-binding instagram-delete-access-token \
  --project=sunrin-today \
  --member="serviceAccount:sunrin-today-uploader-sa@sunrin-today.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud run jobs update sunrin-today-instagram-uploader \
  --region=asia-northeast1 \
  --project=sunrin-today \
  --update-secrets=INSTAGRAM_DELETE_ACCESS_TOKEN=instagram-delete-access-token:latest \
  --update-env-vars=INSTAGRAM_DELETE_GRAPH_API_BASE=https://graph.facebook.com/v25.0
```

---

## 365개 유지

업로드가 성공하면 오래된 글부터 지워서 365개를 맞춥니다. `INSTAGRAM_MEDIA_LIMIT`를 안 넣으면 365입니다.

지금 바로 맞출 때:

```bash
pnpm run manual:trim:dry
pnpm run manual:trim
```

`User is performing too many actions`이면 속도 제한입니다. 10~15분 뒤 다시 실행하면 이어서 지웁니다.

`code=190` / `Session has expired`이면 삭제 토큰이 만료된 겁니다. 위 절차로 장기를 다시 받으세요.
