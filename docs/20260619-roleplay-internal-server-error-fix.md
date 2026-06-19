# ロープレ開始時 Internal Server Error 修正（2026-06-19）

## 症状

フロントで「ヒアリングを開始」を押すと `Internal Server Error`（HTTP 500）が返り、ロープレを開始できない。

## 根本原因

AWS 権限／Bedrock の問題ではない（Bedrock sonnet-4-6 はプロファイルを正常生成していた）。

`POST /api/programs` のプロファイル保存時、本番 PostgreSQL の `customer_profiles` テーブルの
自由記述列が `VARCHAR(128)` のまま残っており、LLM が生成する 128 文字超の日本語
（`true_challenge` / `personality_type` 等）を INSERT して例外発生。

```
asyncpg.exceptions.StringDataRightTruncationError: value too long for type character varying(128)
[SQL: INSERT INTO customer_profiles (... true_challenge, personality_type ...)]
```

マイグレーション `001` 自体は `surface_need` / `true_challenge` を `Text` 定義していたが、
本番テーブルは初回に古いスキーマで作成され、alembic は stamp のみされていたため
実テーブル型とコードが乖離していた。

## 修正

### マイグレーション `002`（`backend/alembic/versions/002_widen_customer_profile_text.py`）

`customer_profiles` の LLM 自由記述列を全て `TEXT` 化（長さ制限を撤廃）。
現在の列型に依存しない `ALTER COLUMN ... TYPE TEXT` で冪等的に修正。

対象列: `industry`, `company_size`, `role_title`, `surface_need`, `true_challenge`, `personality_type`

### モデル（`backend/app/domain/models.py`）

`CustomerProfile` の上記列を `String(...)` → `Text` に統一（dev の `create_all` とも整合）。

### コード整理（KISS）

- `app/websocket/hearing.py`: 一時デバッグ計装（`_agent_log` / `debug-4c07bd.log` 書き込み）を削除
- `frontend/src/pages/RoleplaySetupPage.tsx`: 一時デバッグ fetch（localhost:7710）を削除

## デプロイ

```bash
cd backend
docker build -t 542000445970.dkr.ecr.ap-northeast-1.amazonaws.com/syodan-backend:latest .
docker push 542000445970.dkr.ecr.ap-northeast-1.amazonaws.com/syodan-backend:latest
aws ecs update-service --cluster syodan --service syodan-backend \
  --region ap-northeast-1 --force-new-deployment
```

entrypoint の `alembic upgrade head` で起動時に `001 -> 002` が適用される
（CloudWatch Logs で確認済み）。

## 検証結果（ALB 経由）

- `POST /api/programs` → 201。Bedrock 生成の詳細プロファイル（長文 `personality_type` 含む）が保存
- `scripts/test_hearing_ws.py`（program → session → start → WS）:
  - Transcribe: ユーザー音声「こんにちは、テストです。」をテキスト化
  - Bedrock sonnet-4-6: 顧客ロールの応答を生成（スタブではない）
  - Polly: 応答音声バイトを WebSocket 受信
  - `Hearing WebSocket pipeline check passed.`

ボタン押下 → 録音 → Transcribe → Bedrock sonnet-4-6 → Polly 音声返答の一連が動作。

## 追記: 「接続待ち」から進まない（WebSocket）

### 症状

ミーティング画面には遷移するが ControlBar が「接続待ち」のまま、「押して話す」が無効。
dev server ログ:

```
[vite] ws proxy socket error: Error: read ECONNRESET
```

### 原因

`frontend/src/lib/api.ts` の `getWsBase()` が DEV 時は必ず Vite プロキシ（`/ws`）経由に
していたが、ALB への WebSocket アップグレードをプロキシ中継すると `ECONNRESET` で切断され
接続が確立しなかった（HTTP の `/api` プロキシは正常）。ブラウザから ALB への直接 WS は
`scripts/test_hearing_ws.py` で動作確認済み。

### 修正

`getWsBase()` を「`VITE_WS_BASE_URL` が設定されていれば DEV でもそれを優先（ALB へ直結）」
に変更。`frontend/.env` の `VITE_WS_BASE_URL=ws://syodan-alb-...` を直接使う。
http オリジン（localhost:5173）からの `ws://`接続は mixed-content 制約外で許可される。

あわせて一時デバッグ計装を全削除:
`useHearingWebSocket.ts` / `usePushToTalk.ts` / `vite.config.ts`（localhost:7710 への fetch）。

ブラウザを再読み込みすれば「接続中」になり、押して話す → 会話が可能。
