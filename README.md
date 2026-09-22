![Cover Image](https://raw.githubusercontent.com/sunrin-today/.github/assets/banner_rounded.png)

# Sunrin Today Instagram Uploader

급식 이미지를 Instagram [@sunrin_today](https://instagram.com/sunrin_today)에 올립니다. 공식 Graph API를 씁니다.

전체 구조는 [선린투데이 아키텍처](https://github.com/sunrin-today/.github#아키텍처)를 보면 됩니다.

## 설치

Node.js, pnpm, Python 3

```bash
git clone https://github.com/sunrin-today/instagram-uploader.git
cd instagram-uploader
cp .env.example .env
pnpm install
pnpm run setup:python
```

토큰이 만료됐거나 삭제 권한이 필요하면 [docs/tokens.md](docs/tokens.md)를 보면 됩니다.

## 사용

```bash
pnpm run verify        # 토큰만 확인
pnpm run manual:meal   # 오늘 급식
pnpm run manual:rest   # 이 달의 휴식
pnpm run manual:trim:dry  # 365개 초과분 미리보기
pnpm run manual:trim   # 오래된 글부터 365개로 맞춤
pnpm run start:once    # 프로덕션 Job과 동일
```

## 라이선스

[BSD-2-Clause](LICENSE)
