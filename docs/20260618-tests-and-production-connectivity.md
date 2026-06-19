# テスト・本番接続対応（2026-06-18）

## 実施内容

### バックエンドテスト（要件定義準拠）

`backend/tests/` に pytest 統合テスト 15 件を追加。

| テストファイル | カバーする要件 |
|---------------|----------------|
| `test_health.py` | ALB ヘルスチェック `/health` |
| `test_program_flow.py` | §5.1 プログラム作成、§5.5 真の課題非公開、CORS |
| `test_session_lifecycle.py` | §5.3 セッション、§7 状態遷移・異常終了後リトライ |
| `test_internal_api.py` | §9.5 HULFT 書き戻し内部 API・API キー認証 |
| `test_review_page.py` | §5.4 先輩評価ページ・UUID URL |

実行:

```bash
cd backend
pip install -r requirements.txt -r requirements-dev.txt
python -m pytest tests/ -v
```

### 本番構成（AWS バックエンド + ローカルフロント）

| 項目 | 対応 |
|------|------|
| CORS | ECS の `CORS_ORIGINS=http://localhost:5173`（`.env.example` に明記） |
| WebSocket | `frontend/src/lib/api.ts` で `https://` → `wss://` を自動導出 |
| DB マイグレーション | `entrypoint.sh` で `alembic upgrade head` 後に Uvicorn 起動 |
| スモークテスト | `backend/scripts/smoke_test.py`（ALB 向け） |

### バグ修正

- **真の課題の開示タイミング**: `ProgramService.to_response` で `status == closed` のときのみ `reveal_challenge=true`（総評完了まで非公開）
- **非同期 SQLAlchemy**: `SessionService.to_response` で evaluations の遅延ロードを回避
- **内部 API 認証**: `X-API-Key` 未指定時は 401 を返す（422 ではなく）

## フロント接続例

```env
# frontend/.env（AWS ALB 利用時）
VITE_API_BASE_URL=https://syodan-alb-xxxxx.ap-northeast-1.elb.amazonaws.com
```

`npm run dev` で `http://localhost:5173` から ALB へ HTTPS/WSS 接続。

## スモークテスト例

```bash
set API_BASE_URL=https://syodan-alb-xxxxx.ap-northeast-1.elb.amazonaws.com
python backend/scripts/smoke_test.py
```

チェック内容: `/health`、CORS、プログラム作成、セッション開始/中断、内部 API キー拒否。
