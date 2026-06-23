# ヒアリング開始で「Failed to fetch」になる不具合の修正

## 症状
ロープレの「ヒアリングを開始」ボタン押下で `Failed to fetch`。Vite devサーバーが
`TypeError: Cannot read properties of null (reading 'split')`
（`http-proxy` の `common.setupOutgoing` → `protocol.split(':')`）で**クラッシュ**し、以降の全リクエストが失敗していた。

## 原因
`frontend/.env.development` の `VITE_DEV_BACKEND_URL=` が空文字。
`frontend/vite.config.ts` が nullish 合体 `??` でフォールバックしていたため、空文字は
そのまま残り、プロキシ target が空文字になっていた。

```ts
// 修正前: "" は null/undefined ではないのでフォールバックされない
const backendTarget = env.VITE_DEV_BACKEND_URL ?? env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'
```

target が空のため `/api`・`/ws` の転送時に `http-proxy` が protocol を解決できず例外
→ Node プロセスが落ち、devサーバーごと停止していた。

## 修正
`??` を `||` に変更し、空文字も `.env` の `VITE_API_BASE_URL`（AWS ALB）へフォールバック。
あわせて `/ws` プロキシに `changeOrigin: true` を付与（ALB へのクロスホスト転送の堅牢化）。

```ts
const backendTarget =
  env.VITE_DEV_BACKEND_URL || env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'
// ...
'/ws': { target: backendTarget.replace(/^http/, 'ws'), ws: true, changeOrigin: true },
```

## 検証
- `npm run dev` 起動後、プロキシ経由で `GET /health` → 200、`GET /api/programs/<不存在ID>` → 404（バックエンド到達）。
- 連続リクエスト後もdevサーバーはクラッシュせず稼働継続。
- WSはフロントの `getWsBase()` が `.env` の `VITE_WS_BASE_URL=ws://syodan-alb...` を直接使用するため、ALB へ接続。

## 補足
手元でバックエンドを起動して開発したい場合は `.env.development` の
`VITE_DEV_BACKEND_URL` にローカルURL（例 `http://127.0.0.1:8000`）を設定すれば、
そちらが優先される。
