# Sales Gym（Syodan）

営業ヒアリングの音声ロールプレイを行うトレーニングサービス。

| レイヤ | 技術 |
|--------|------|
| フロントエンド | React 19、React Router 7、TypeScript、Vite |
| バックエンド | Python 3.12、FastAPI、SQLAlchemy、Alembic |
| インフラ / AI | PostgreSQL、AWS（Bedrock / Transcribe / Polly / S3）、ECS Fargate |

---

## コントリビュートの流れ

1. リポジトリをクローンする
2. [前提条件](#前提条件)を満たす
3. [開発環境を構築](#開発環境の構築)する（パターン A または B）
4. [動作確認](#動作確認)でセットアップ完了を確認する
5. `main` からブランチを切って変更する
6. [PR 前チェック](#pr-前チェック)を通す
7. `main` 向けに Pull Request を作成する

---

## 前提条件

### 必須ツール

| ツール | バージョン | 用途 |
|--------|-----------|------|
| Git | 2.x 以上 | ソース管理 |
| Node.js | **22.x**（CI と同一） | フロントエンド |
| npm | 10.x 以上 | 依存関係（**CI は npm 固定**） |
| Python | **3.12 以上** | バックエンド・テスト |
| Docker Desktop | 最新 | ローカル PostgreSQL（パターン B のみ） |

パターン A（フロントのみ）を選ぶ場合、Python と Docker は不要です。

### バージョン確認

<details>
<summary>Windows（PowerShell）</summary>

```powershell
git --version
node --version    # v22.x.x
npm --version
python --version  # Python 3.12.x（パターン B / バックエンド変更時）
docker compose --version  # パターン B のみ
```

</details>

<details>
<summary>macOS / Linux</summary>

```bash
git --version
node --version    # v22.x.x
npm --version
python3 --version # Python 3.12.x（パターン B / バックエンド変更時）
docker compose --version  # パターン B のみ
```

</details>

### リポジトリの取得

```bash
git clone <リポジトリ URL>
cd Syodan
```

### どちらのパターンを選ぶか

| パターン | 向いている変更 | 必要なもの |
|----------|---------------|-----------|
| **A: フロントのみ** | UI / UX、画面ロジック | Node.js のみ |
| **B: フロント + バックエンド** | API、DB、WebSocket、ドメインロジック | Node.js + Python + Docker |

迷ったら **パターン A** から始めてください。フロントの変更だけならこれで十分です。

---

## 開発環境の構築

### パターン A: フロントのみ（推奨）

バックエンドは共有 ECS（ALB）を使い、手元ではフロントだけ起動します。  
**社内ネットワーク等、ALB（`syodan-alb-*.ap-northeast-1.elb.amazonaws.com`）へ到達できる環境が必要です。**

#### 手順

```bash
cd frontend
npm ci
npm run dev
```

`frontend/.env.development` はリポジトリに含まれており、既定で共有 ALB を指します。  
初回クローン後にファイルが無い場合のみ:

```bash
cp .env.example .env.development   # macOS / Linux
copy .env.example .env.development   # Windows
```

#### 起動確認

ブラウザで http://127.0.0.1:5173 を開き、トップ画面が表示されれば OK です。

---

### パターン B: フロント + バックエンドをローカルで完結

DB・API・WebSocket をすべて手元で動かします。AWS 認証情報は不要です（スタブモードで動作）。

#### 1. PostgreSQL を起動

**Docker Desktop を起動してから**実行してください。

<details>
<summary>Windows（PowerShell）</summary>

```powershell
cd backend
docker compose up -d
docker compose ps   # STATUS が healthy になるまで待つ
```

</details>

<details>
<summary>macOS / Linux</summary>

```bash
cd backend
docker compose up -d
docker compose ps   # STATUS が healthy になるまで待つ
```

</details>

接続情報（`docker-compose.yml` 既定値）:

| 項目 | 値 |
|------|-----|
| ホスト | `localhost:5432` |
| DB 名 | `syodan` |
| ユーザー | `syodan` |
| パスワード | `syodan_dev` |

#### 2. Python 仮想環境と依存関係

<details>
<summary>Windows（PowerShell）</summary>

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt -r requirements-dev.txt
copy .env.example .env
```

</details>

<details>
<summary>macOS / Linux</summary>

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt -r requirements-dev.txt
cp .env.example .env
```

</details>

`.env` は `.env.example` のコピーでそのまま使えます。  
`AWS_STUB_MODE=true`・`HULFT_STUB_MODE=true`・`SLACK_STUB_MODE=true` が既定のため、AWS / HULFT / Slack の認証情報なしで開発できます。

> **注意**: 以降のバックエンド操作（マイグレーション・起動・テスト）は、ターミナルごとに仮想環境を有効化してから実行してください。

#### 3. DB マイグレーション

仮想環境を有効化した状態で:

<details>
<summary>Windows（PowerShell）</summary>

```powershell
cd backend
.\scripts\migrate.ps1
```

スクリプト実行がブロックされる場合:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

</details>

<details>
<summary>macOS / Linux</summary>

```bash
cd backend
python -m alembic upgrade head
```

テーブルはあるが `alembic_version` が無い場合:

```bash
python -m alembic stamp 001
python -m alembic upgrade head
```

</details>

`Migration complete.`（またはエラーなく終了）が出れば成功です。

#### 4. バックエンド起動

<details>
<summary>Windows（PowerShell）— 推奨</summary>

```powershell
cd backend
.\scripts\run_dev.ps1
```

`run_dev.ps1` は次を自動で行います:

- ポート 8000（使用中なら 8002）で Uvicorn を起動
- `frontend/.env.development` の `VITE_DEV_BACKEND_URL` をローカル URL に更新

</details>

<details>
<summary>macOS / Linux（手動）</summary>

```bash
cd backend
source .venv/bin/activate

# フロントのプロキシ先をローカルに合わせる
echo "VITE_DEV_BACKEND_URL=http://127.0.0.1:8000" > ../frontend/.env.development

python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

</details>

起動ログに `Uvicorn running on http://127.0.0.1:8000` が出れば成功です。  
**このターミナルは閉じずに開いたまま**にしてください。

#### 5. フロントエンド起動（別ターミナル）

```bash
cd frontend
npm ci
npm run dev
```

ブラウザで http://127.0.0.1:5173 を開きます。

---

## 動作確認

セットアップ完了後、次を順に確認してください。

### 1. バックエンドのヘルスチェック

パターン B の場合（バックエンドを直接叩く）:

```bash
curl http://127.0.0.1:8000/health
# => {"status":"ok"}
```

パターン A / B 共通（Vite プロキシ経由）:

```bash
curl http://127.0.0.1:5173/health
# => {"status":"ok"}
```

`/health` が `{"status":"ok"}` を返さない場合、[トラブルシュート](#トラブルシュート)を参照してください。

### 2. 画面の基本動作

1. http://127.0.0.1:5173 でトップ画面が表示される
2. プログラム作成画面に遷移できる（パターン B では DB への書き込みも確認できる）

ロールプレイ（音声）の動作確認にはマイク許可が必要です。パターン A では AWS 上の STT / TTS が使われます。

### 3. テストの実行

変更内容に応じて、該当するチェックを実行します。

**フロントエンドを変更した場合:**

```bash
cd frontend
npm ci
npm run ci        # format:check + lint
npm run build     # 任意だが PR 前に推奨
```

**バックエンドを変更した場合:**

<details>
<summary>Windows（PowerShell）</summary>

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
$env:APP_ENV="test"
$env:DATABASE_URL="sqlite+aiosqlite://"
$env:AWS_STUB_MODE="true"
$env:HULFT_STUB_MODE="true"
$env:INTERNAL_API_KEY="test-internal-key"
$env:CORS_ORIGINS="http://localhost:5173"
pytest tests/ -q
```

</details>

<details>
<summary>macOS / Linux</summary>

```bash
cd backend
source .venv/bin/activate
APP_ENV=test \
DATABASE_URL=sqlite+aiosqlite:// \
AWS_STUB_MODE=true \
HULFT_STUB_MODE=true \
INTERNAL_API_KEY=test-internal-key \
CORS_ORIGINS=http://localhost:5173 \
pytest tests/ -q
```

</details>

**両方変更した場合**（Git Bash / WSL / macOS / Linux）:

```bash
./scripts/ci-check.sh
```

---

## PR 前チェック

`main` 向け PR では GitHub Actions（[`.github/workflows/ci.yml`](.github/workflows/ci.yml)）が次を実行します。

| ジョブ | 内容 |
|--------|------|
| Frontend | `npm ci` → `format:check` → `lint` |
| Backend | `pip install` → `pytest` |

PR 作成前に、変更した側のチェックをローカルで通してください。

### チェックリスト

- [ ] フロントを変更した → `cd frontend && npm ci && npm run ci` が通る
- [ ] バックエンドを変更した → `pytest tests/ -q` が通る（上記の環境変数付き）
- [ ] `package.json` を変更した → `npm install` で `package-lock.json` も更新してコミットする
- [ ] `.env` / API キー / Slack トークンをコミットしていない
- [ ] 意図しないファイル（`node_modules/`, `.venv/`, `dist/` など）をコミットしていない

### 依存関係を追加・更新したとき

ローカルで `pnpm` を使っていても、**CI は npm 固定**です。

```bash
cd frontend
npm install          # package-lock.json を更新
git add package.json package-lock.json
```

`pnpm-lock.yaml` だけ更新して `package-lock.json` を忘れると、CI の `npm ci` で失敗します。

### フォーマット / Lint の自動修正

```bash
cd frontend
npm run format       # Prettier
npm run lint:fix     # ESLint
npm run ci           # 再確認
```

---

## 環境変数

### バックエンド（`backend/.env`）

`backend/.env.example` をコピーして作成します（`.gitignore` 対象のためコミットしません）。

| 変数 | ローカル開発での目安 |
|------|---------------------|
| `DATABASE_URL` | 例のまま（docker-compose 既定値） |
| `AWS_STUB_MODE` | `true`（AWS 不要） |
| `HULFT_STUB_MODE` | `true` |
| `SLACK_STUB_MODE` | `true` |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` |

API キーやトークンは **`.env` にのみ** 記載し、コードへハードコードしないでください。

### フロントエンド（`frontend/.env.development`）

| 変数 | 説明 |
|------|------|
| `VITE_DEV_BACKEND_URL` | 開発時プロキシ先。パターン A は共有 ALB、パターン B は `http://127.0.0.1:8000` |

`VITE_DEV_BACKEND_URL` を空にしないでください（Vite プロキシが壊れます）。  
ローカル backend を使う場合は `run_dev.ps1`（Windows）または上記手順で URL を設定してください。

ローカル専用の上書きには `frontend/.env.development.local` も使えます（git 管理外）。

---

## トラブルシュート

| 症状 | 原因と対処 |
|------|-----------|
| `docker compose up` が失敗 | Docker Desktop が起動しているか確認 |
| マイグレーション失敗 | `docker compose ps` で PostgreSQL が `healthy` か確認 → 仮想環境が有効か確認 → 再実行 |
| `curl .../health` が繋がらない（パターン B） | バックエンドの Uvicorn が起動しているか、ポート（8000 or 8002）を確認 |
| フロントから API に繋がらない | `frontend/.env.development` の `VITE_DEV_BACKEND_URL` を確認。変更後は `npm run dev` を再起動 |
| `Failed to fetch` / Vite がクラッシュ | `VITE_DEV_BACKEND_URL` が空でないか確認（[docs/20260619-vite-proxy-failed-to-fetch-fix.md](docs/20260619-vite-proxy-failed-to-fetch-fix.md)） |
| ポート 8000 が使用中（Windows） | `run_dev.ps1` が 8002 にフォールバック。フロントの URL も自動更新される |
| `npm ci` が失敗 | `package.json` と `package-lock.json` の不整合 → `npm install` で lock を更新 |
| `format:check` / `lint` 失敗 | `npm run format` / `npm run lint:fix` → `npm run ci` で再確認 |
| AWS 実サービスでロールプレイしたい | `AWS_STUB_MODE=false`、AWS 認証設定、S3 バケット・Bedrock モデル ID を `.env` に設定（運用チームに相談） |

---

## リポジトリ構成

```
Syodan/
├── frontend/          # React SPA（Vite dev server :5173）
├── backend/           # FastAPI API + WebSocket（Uvicorn :8000）
│   ├── alembic/       # DB マイグレーション
│   ├── app/           # アプリケーション本体
│   ├── tests/         # pytest
│   └── scripts/       # 開発用スクリプト（migrate.ps1, run_dev.ps1 等）
├── docs/              # 設計・運用メモ
├── scripts/           # リポジトリ全体の CI チェック
└── .github/workflows/ # CI / デプロイ
```

---

## 関連ドキュメント

| ファイル | 内容 |
|----------|------|
| [backend/README.md](backend/README.md) | バックエンドの責務・API 契約 |
| [frontend/README.md](frontend/README.md) | フロントの責務・開発コマンド |
| [システム仕様書.md](システム仕様書.md) | 全体仕様・API 一覧 |
| [docs/20260624-ci-pass-procedure.md](docs/20260624-ci-pass-procedure.md) | CI 失敗時の詳細な対処 |
| [docs/aws-setup.md](docs/aws-setup.md) | AWS インフラ構築（運用者向け） |
| [要件定義.md](要件定義.md) | サービス要件 |

## ライセンス

社内プロジェクト。外部公開の可否はリポジトリ管理者に確認してください。
