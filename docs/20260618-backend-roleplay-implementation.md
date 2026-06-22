# バックエンド・ロープレ画面 実装サマリ（2026-06-18）

## 実装範囲

- FastAPI バックエンド（ドメインモデル、REST API、WebSocket PTT パイプライン）
- セッション終了処理（CustomerState 更新、S3 録音、HULFT スタブ）
- 内部 API（HULFT 書き戻し、`X-API-Key` 認証）
- フロントエンド Zoom 風ロープレ画面（Setup + Meeting）
- AWS マネコン手順書（[`aws-setup.md`](./aws-setup.md)）

## REST API

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/health` | ヘルスチェック |
| POST | `/api/programs` | プログラム作成 |
| GET | `/api/programs/{id}` | プログラム詳細 |
| POST | `/api/programs/{id}/sessions` | セッション作成 |
| GET | `/api/programs/{id}/sessions` | セッション一覧 |
| GET | `/api/sessions/{id}` | セッション詳細 |
| POST | `/api/sessions/{id}/start` | 開始 |
| POST | `/api/sessions/{id}/end` | 正常終了 |
| POST | `/api/sessions/{id}/abort` | 異常終了 |
| GET | `/api/review/{token}` | 先輩評価ページデータ |
| POST | `/internal/evaluation-artifacts` | HULFT 書き戻し |

## WebSocket

- 接続: `ws://{host}/ws/sessions/{session_id}/hearing`
- PTT: `ptt_start` → binary chunks → `ptt_end`
- 応答: `transcript`, binary（TTS）, `turn_complete`, `time_warning`, `session_ended`

## ローカル開発

```bash
# バックエンド
cd backend
docker compose up -d
copy .env.example .env
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# フロントエンド
cd frontend
copy .env.example .env
npm.cmd install
npm.cmd run dev
```

## テスト

```bash
cd backend
pip install -r requirements.txt -r requirements-dev.txt
python -m pytest tests/ -v
```

要件定義 §5.1〜5.5・§7・§9.5 をカバーする API 統合テスト（SQLite インメモリ、AWS スタブ）。

## AWS 接続時スモークテスト

```bash
set API_BASE_URL=https://your-alb.ap-northeast-1.elb.amazonaws.com
python scripts/smoke_test.py
```

フロントエンド `.env`:

```
VITE_API_BASE_URL=https://your-alb-dns.ap-northeast-1.elb.amazonaws.com
# WSS は https から自動導出（VITE_WS_BASE_URL 省略可）
```

ECS タスクの `CORS_ORIGINS` に `http://localhost:5173` を設定すること。
