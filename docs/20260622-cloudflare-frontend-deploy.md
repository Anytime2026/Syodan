# Cloudflare Pages フロントエンドデプロイ

## 概要

Syodan の React SPA を Cloudflare Pages にホストし、Pages Functions で AWS ALB へ API / WebSocket をプロキシする。

| 項目 | 値 |
|------|-----|
| 本番 URL | https://syodan-frontend.pages.dev |
| Pages プロジェクト | `syodan-frontend` |
| ビルド出力 | `frontend/dist` |
| バックエンド | `http://syodan-alb-520683133.ap-northeast-1.elb.amazonaws.com`（Pages シークレット `BACKEND_ORIGIN`） |

## アーキテクチャ

```
ブラウザ (HTTPS)
  → syodan-frontend.pages.dev
      ├─ 静的ファイル (dist/)
      └─ Pages Functions (_middleware.ts)
            → AWS ALB (HTTP) → ECS Fargate
```

本番ビルドでは `VITE_API_BASE_URL` を空にし、相対パス `/api`・`/ws` で同一オリジン通信する。Mixed Content と CORS を回避できる。

## 初回セットアップ（済）

```powershell
cd frontend
npm install
npx wrangler login
npx wrangler pages project create syodan-frontend --production-branch main
"http://syodan-alb-520683133.ap-northeast-1.elb.amazonaws.com" | npx wrangler pages secret put BACKEND_ORIGIN --project-name syodan-frontend
npm run pages:deploy
```

## 再デプロイ（手動）

Git 連携前、または緊急時:

```powershell
cd frontend
npm run pages:deploy
```

`--branch main` を付けて本番 URL（`syodan-frontend.pages.dev`）へ反映する。

## GitHub 連携（main マージで自動デプロイ）

Direct Upload で作成したプロジェクトは API から `source` を追加できない。**Cloudflare ダッシュボード**で GitHub を接続する。

### 前提

1. デプロイ関連ファイルが `main` にマージ済みであること（`frontend/functions/`, `frontend/public/_redirects`, `frontend/.env.production`, `frontend/wrangler.toml` 等）
2. Cloudflare アカウントに GitHub App「Cloudflare Workers & Pages」が `Anytime2026/Syodan` へインストール済み

### 手順

1. [Pages ビルド設定](https://dash.cloudflare.com/e677a2ee6ae7ae98dda7778e096cc426/pages/view/syodan-frontend/settings/builds) を開く
2. **Connect to Git**（または **Manage** → **Connect Git repository**）を選択
3. GitHub 認可後、リポジトリ `Anytime2026/Syodan` を選択
4. ビルド設定:

| 項目 | 値 |
|------|-----|
| Production branch | `main` |
| Root directory | `frontend` |
| Build command | `npm run build` |
| Build output directory | `dist` |

5. **Environment variables**（Settings → Environment variables）で `BACKEND_ORIGIN` を設定:
   - Production: `http://syodan-alb-520683133.ap-northeast-1.elb.amazonaws.com`（Encrypted）
   - Preview: 同上（プレビューブランチでも API プロキシが動くように）

6. 保存後、`main` へ push すると自動ビルド・デプロイが走る

### 動作

- `main` への push → 本番 `https://syodan-frontend.pages.dev` 更新
- その他ブランチ / PR → プレビュー URL（`xxxx.syodan-frontend.pages.dev`）

Git 連携後は `npm run pages:deploy` は通常不要（手動デプロイ用として残す）。

## ローカルで Pages 相当を試す

```powershell
cp .dev.vars.example .dev.vars   # BACKEND_ORIGIN を編集
npm run build
npx wrangler pages dev dist
```

## 追加ファイル

| ファイル | 役割 |
|----------|------|
| `public/_redirects` | SPA フォールバック (`/* /index.html 200`) |
| `functions/_middleware.ts` | `/api`, `/health`, `/internal`, `/ws` を ALB へ転送 |
| `wrangler.toml` | Pages プロジェクト設定 |
| `.env.production` | 本番ビルド時に ALB URL を空に上書き（Mixed Content 防止） |
| `.dev.vars.example` | ローカル `wrangler pages dev` 用 |

## 動作確認

1. https://syodan-frontend.pages.dev/ が 200
2. https://syodan-frontend.pages.dev/settings が 200（SPA ルート）
3. https://syodan-frontend.pages.dev/health が `{"status":"ok"}`
4. ブラウザでプログラム作成 → ロープレ開始（REST + WebSocket）

## トラブルシュート

| 症状 | 確認点 |
|------|--------|
| `syodan-frontend.pages.dev` が 404 | `--branch main` でデプロイしたか。プレビュー URL（`xxxx.syodan-frontend.pages.dev`）は別 |
| API が 500 `BACKEND_ORIGIN is not configured` | `wrangler pages secret put BACKEND_ORIGIN` を実行 |
| API / WS が 502 | ALB / ECS が起動しているか。`curl http://syodan-alb-.../health` |
| Mixed Content エラー / `Failed to fetch` | `frontend/.env` の `VITE_API_BASE_URL=http://...` が本番ビルドに埋め込まれていないか。`.env.production` で空に上書きして再デプロイ |
| WebSocket 切断 | Cloudflare ダッシュボードの Functions ログを確認。ALB が WS をサポートしているか |

## AWS 側

- ECS `CORS_ORIGINS` の更新は不要（同一オリジン）
- ALB HTTPS 化（Phase G）は未実施でも可（プロキシが HTTP で ALB と通信）

## 将来の拡張

- カスタムドメイン: Cloudflare Pages → Custom domains → DNS CNAME
- CI: GitHub Actions + `CLOUDFLARE_API_TOKEN`（Pages Edit 権限）
