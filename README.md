# 책상 낚시터 (Desk Fishing)

화면 구석에 늘 떠 있는 작은 낚시터. 엑셀을 켜 놓은 채로 **Ctrl**만 눌러서 낚시하고,
잡은 물고기를 팔아 번 돈으로 장비를 사서 캐릭터를 키우는 게임이에요.

## 실행 (Windows)

1. [Node.js](https://nodejs.org) LTS 설치
2. 이 폴더에서:

```bash
npm install
```

```bash
npm start
```

화면 오른쪽 아래에 낚시터가 떠요. 위쪽 막대를 잡고 끌면 옮길 수 있어요.

## 설치 파일(.exe) 만들기

```bash
npm run dist
```

`dist/` 폴더에 설치 파일이 생겨요. 설치하면 `AppData\Local\Programs\DeskFishing` 아래에 깔려요.

## 자동 업데이트 (GitHub Releases)

설치형(`DeskFishing Setup x.x.x.exe`)으로 깔면, 켜질 때와 1시간마다 새 버전을 확인해서 받아 둬요.
다 받으면 낚시터에 ⬆ 버튼이 생기고, 누르거나 다음에 껐다 켜면 새 버전이 돼요. zip 버전은 자동 업데이트가 안 돼요.

처음 한 번 준비:
1. GitHub 가입 후 **Public** 저장소 `desk-fishing`을 만들어요. 코드는 안 올려도 돼요. 설치 파일만 Releases에 올라가요.
2. `package.json`의 `"owner": "YOUR_GITHUB_ID"`를 내 GitHub 아이디로 바꿔요.
3. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) → **Generate new token (classic)**, `repo`를 체크하고 만든 토큰을 복사해요.
4. 명령 프롬프트에서 아래처럼 저장해요. 그 뒤 **명령 프롬프트를 새로 열어야** 적용돼요.

```bash
setx GH_TOKEN "복사한토큰"
```

새 버전 올리기 (코드를 고칠 때마다):

```bash
npm version patch --no-git-tag-version
```

```bash
npm run release
```

첫 줄은 버전을 0.1.0 → 0.1.1처럼 올리고, 둘째 줄은 설치 파일을 만들어 GitHub에 올려요. 버전을 안 올리면 업데이트로 인식되지 않아요.

## 하는 법

1. **던지기**: 키를 꾹 누르면 힘 게이지가 움직여요. 떼면 그 거리로 던져요. 멀리 던질수록 희귀한 물고기가 나오지만 오래 기다려요.
2. **입질**: 찌 위에 `!`가 뜨면 바로 눌러요. 0.35초 안에 누르면 PERFECT(가격 1.3배)예요.
3. **힘겨루기**: 꾹 누르면 감고, 떼면 풀어요. 오른쪽 장력 막대가 빨개지면 떼야 해요.
4. **피니시**: 커서가 초록 칸에 올 때 눌러요. 희귀한 물고기일수록 여러 번 맞춰야 해요.

잡은 물고기는 **어망**에 담기고, 상점에서 팔면 **지갑**에 돈이 들어와요. 지갑 돈으로 **상점**에서 낚싯대, 줄, 미끼를 사면 **캐릭터** 능력치가 올라가요.
도감을 채우면 새 **장소**가 열려요.

## 파일 구조

| 파일 | 하는 일 |
|---|---|
| `main.js` | 창 만들기, 전역 키 감지(uiohook-napi), 저장, 상점·장소 처리 |
| `preload.js` | 화면과 main.js 사이 통로 (`window.api`) |
| `src/shared.js` | **게임 데이터**: 장소, 물고기, 장비, 능력치·가격 계산 |
| `src/widget.*` | 화면 구석의 작은 낚시터 (캔버스 픽셀아트, 낚시 상태 머신) |
| `src/panel.*` | 캐릭터 / 상점 / 장소 / 도감 / 수익 / 설정 / 정보 창 |

## 내용 바꾸기

모든 게임 데이터는 `src/shared.js` 한 곳에 있어요.

- **장소 추가**: `LOCATIONS`에 `{ id, name, need(열리는 도감 수), water(물 색), desc }` 추가
- **물고기 추가**: `FISH`에 `loc`를 장소 id로 해서 추가 (tier 1~4, 크기, 가격, 색)
- **장비 추가**: `ITEMS`의 `rod` / `line` / `bait`에 추가 (`stats`: reel, line, luck, size, reaction)

저장 파일 위치: `%APPDATA%\desk-fishing\save.json` (지우면 처음부터 다시 시작)

## 알아 둘 점

- 다른 창을 쓰는 중에도 키를 받으려면 `uiohook-napi`가 필요해요. 이 라이브러리를 못 불러오면 낚시터 창이 선택돼 있을 때만 키가 동작해요. 설정 탭에 상태가 나와요.
- 키 입력을 가로채지 않으니 Ctrl을 눌러도 다른 프로그램에는 그대로 전달돼요.
