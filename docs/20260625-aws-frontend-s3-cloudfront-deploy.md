# AWS フロントエンドデプロイ手順（S3 + CloudFront）

Syodan の React SPA を **Amazon S3** に置き、**Amazon CloudFront** 経由で HTTPS 公開する手順です。  
Cloudflare Pages と同様に、**静的ファイルは S3**、**`/api`・`/ws` などは ALB（ECS）へプロキシ**します。

独自ドメインは使わず、CloudFront のデフォルト URL（`https://d3sqjmfezufvi4.cloudfront.net`）で運用しています。

---

## この手順で作るもの

| リソース | 役割 | 値（本番） |
|----------|------|------------|
| S3 バケット | `frontend/dist` の静的ファイル置き場 | `syodan-frontend-542000445970` |
| CloudFront | HTTPS CDN + API/WS のルーティング | `https://d3sqjmfezufvi4.cloudfront.net` |
| （既存）ALB | バックエンド API / WebSocket | `syodan-alb-520683133.ap-northeast-1.elb.amazonaws.com` |

---

## 全体像

```
ブラウザ (HTTPS)
  → CloudFront（例: dxxxx.cloudfront.net）
      ├─ /, /settings, /assets/* など  → S3（dist/）
      ├─ /api/*, /health, /internal/* → ALB（HTTP:80）→ ECS
      └─ /ws/*                        → ALB（WebSocket）
```

**ポイント**

- フロントの本番ビルドでは `VITE_API_BASE_URL` を空にし、ブラウザは **同一オリジン** の `/api`・`/ws` にアクセスします（`frontend/.env.production` 参照）。
- CloudFront が ALB へ中継するため、ブラウザから ALB への直接アクセスや CORS 設定の追加は不要です（Cloudflare Pages と同じ考え方）。
- S3 は **非公開**（パブリックアクセスブロック ON）。閲覧は CloudFront の **Origin Access Control（OAC）** 経由のみにします。

参考: [Restrict access to an Amazon S3 origin（OAC）](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html)

---

## 用語（最小限）

| 用語 | 意味 |
|------|------|
| **オリジン** | CloudFront がデータを取りに行く先（S3 や ALB） |
| **ビヘイビア（キャッシュビヘイビア）** | URL パスごとに「どのオリジンへ送るか」を決めるルール |
| **OAC** | CloudFront だけが S3 を読めるようにする仕組み（OAI の後継。AWS 推奨） |
| **ディストリビューション** | CloudFront の配信設定一式。作成・更新に数分〜15分かかることがある |

---

## 前提条件

- AWS アカウント（本プロジェクトのバックエンドと同じアカウント）
- リージョン **ap-northeast-1（東京）** で作業する（S3 バケットは東京リージョンに作成）
- バックエンド ALB が起動しており、次が成功すること:

```powershell
curl http://syodan-alb-520683133.ap-northeast-1.elb.amazonaws.com/health
# → {"status":"ok"} など
```

- 手元 PC に Node.js と npm（または pnpm）が入っていること
- AWS マネジメントコンソールにログインできること（IAM ユーザーでも可）

**AWS アカウント ID（本リポジトリの例）**: `542000445970`  
バケット名などはアカウント内で一意にするため、以下では `{アカウントID}` と表記します。

---

## クイック再デプロイ（CLI）

初回セットアップ完了後は次のスクリプトで再デプロイできます。

```powershell
cd frontend/scripts/aws
./deploy.ps1
```

手動の場合:

```powershell
cd frontend
npm run build
aws s3 sync dist/ s3://syodan-frontend-542000445970/ --delete --region ap-northeast-1
aws cloudfront create-invalidation --distribution-id E2TK0UGVYW3AWD --paths "/*"
```

---

## 初回セットアップ（CLI で実施済み: 2026-06-25）

以下は初回フルデプロイで作成済みのリソースです。

| リソース | ID / 名前 |
|----------|-----------|
| S3 バケット | `syodan-frontend-542000445970` |
| CloudFront OAC | `E2ETRY95P5LSW7` |
| CloudFront ディストリビューション | `E2TK0UGVYW3AWD` |
| 本番 URL | https://d3sqjmfezufvi4.cloudfront.net |
| IaC 設定ファイル | `frontend/scripts/aws/` |

---


| 順番 | 作業 | 所要目安 |
|------|------|----------|
| 1 | S3 バケット作成 | 5分 |
| 2 | CloudFront ディストリビューション作成（S3 + ALB） | 15〜30分 |
| 3 | フロントをビルドして S3 にアップロード | 5分 |
| 4 | ECS の `FRONTEND_BASE_URL` を更新 | 10分 |
| 5 | 動作確認 | 10分 |

---

## Phase 1: S3 バケットを作る

### 1-1. バケット作成

1. [Amazon S3 コンソール](https://s3.console.aws.amazon.com/s3/home?region=ap-northeast-1) を開く
2. **バケットを作成** をクリック
3. 次のように設定:

| 項目 | 値 |
|------|-----|
| バケット名 | `syodan-frontend-{アカウントID}`（例: `syodan-frontend-542000445970`） |
| AWS リージョン | アジアパシフィック（東京）ap-northeast-1 |
| オブジェクト所有者 | **バケット所有者の強制**（デフォルトのまま） |
| パブリックアクセスをすべてブロック | **オン**（4項目すべてチェック） |
| バケットのバージョニング | 無効（演習用途では十分） |
| デフォルトの暗号化 | SSE-S3（デフォルトで可） |

4. **バケットを作成**

### 1-2. やってはいけないこと

- **静的ウェブサイトホスティングを有効にしない**  
  OAC は S3 の **REST API エンドポイント** 向けです。ウェブサイトエンドポイント（`s3-website-...`）とは別物です。  
  参考: [Restrict access to an Amazon S3 origin](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html)

- バケットをパブリックにしない

この時点ではバケットは空のままで問題ありません。

---

## Phase 2: CloudFront ディストリビューションを作る

### 2-1. 新規ディストリビューション作成（ウィザード）

1. [CloudFront コンソール](https://console.aws.amazon.com/cloudfront/v4/home) を開く
2. **ディストリビューションを作成** → **シングルウェブサイトまたはアプリ**（または Standard distribution）を選択
3. **オリジン** で S3 バケットを指定:
   - オリジンタイプ: **Amazon S3**
   - オリジン: 先ほど作った `syodan-frontend-{アカウントID}`
   - **Origin access**: **Origin access control settings (recommended)** を選び、新規 OAC を作成（名前例: `syodan-frontend-oac`）
   - **Sign requests**: **Sign requests (recommended)**（デフォルト）
4. ウィザード中に **S3 バケットポリシーを CloudFront にコピーする** 旨の表示が出たら、**ポリシーをコピー** し、S3 バケットの **アクセス許可 → バケットポリシー** に貼り付けて保存する  
   （コンソールが自動適用する場合もあります。未設定だと後で 403 になります）

参考: [Configure OAC for CloudFront distributions with Amazon S3 origins](https://repost.aws/knowledge-center/cloudfront-oac-origins)

### 2-2. ALB を第2オリジンとして追加

ディストリビューション作成後（または作成ウィザードのオリジン追加で）:

1. **Origins（オリジン）** タブ → **Create origin**
2. 設定:

| 項目 | 値 |
|------|-----|
| Origin domain | `syodan-alb-520683133.ap-northeast-1.elb.amazonaws.com` |
| Protocol | **HTTP only**（ALB は現状 HTTP:80。CloudFront↔ビューアは HTTPS） |
| HTTP port | 80 |
| Origin name（任意） | `syodan-alb` |

参考: [Use various origins with CloudFront distributions（ALB）](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/DownloadDistS3AndCustomOrigins.html)

### 2-3. デフォルトビヘイビア（静的ファイル → S3）

**Behaviors** タブの **Default (*)** を編集:

| 項目 | 値 |
|------|-----|
| Origin | S3 バケット（`syodan-frontend-...`） |
| Viewer protocol policy | **Redirect HTTP to HTTPS** |
| Allowed HTTP methods | GET, HEAD |
| Cache policy | **CachingOptimized**（マネージド） |
| Compress objects automatically | オン（推奨） |

参考: [Use managed cache policies（CachingOptimized）](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/using-managed-cache-policies.html)

**Settings** タブ:

| 項目 | 値 |
|------|-----|
| Default root object | `index.html` |

### 2-4. API / WebSocket 用の追加ビヘイビア（ALB へ）

Cloudflare の `functions/_middleware.ts` と同じパスを ALB に転送します。  
**より具体的なパスを上に** 並べます（CloudFront は上から順にマッチ）。

**Create behavior** をパスごとに追加:

| 優先（上ほど先） | Path pattern | Origin | 主な設定 |
|------------------|--------------|--------|----------|
| 1 | `/ws/*` | `syodan-alb` | 下記「ALB 向け共通」 |
| 2 | `/api/*` | `syodan-alb` | 同上 |
| 3 | `/internal/*` | `syodan-alb` | 同上 |
| 4 | `/health` | `syodan-alb` | 同上 |

**ALB 向け共通設定**

| 項目 | 値 | 理由 |
|------|-----|------|
| Viewer protocol policy | Redirect HTTP to HTTPS | ブラウザは HTTPS |
| Allowed HTTP methods | GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE | REST API |
| Cache policy | **CachingDisabled** | API/WS はキャッシュしない |
| Origin request policy | **AllViewer** | WebSocket ヘッダー転送に必要 |

WebSocket については AWS 公式でも **AllViewer** または `Sec-WebSocket-*` ヘッダーの転送を推奨しています。  
参考: [Use WebSockets with CloudFront distributions](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/distribution-working-with.websockets.html)

> **補足**: `/api/*` は `/api` 単体にはマッチしません。本アプリは `/api/programs` などサブパスを使うため問題ありません。

### 2-5. SPA ルート用のカスタムエラーレスポンス

React Router の `/settings` などは S3 に実ファイルがないため、S3 は **403 Access Denied** を返します。  
CloudFront で `index.html` に差し替え、HTTP 200 で返します（Cloudflare の `_redirects` と同じ役割）。

**Error pages** タブ → **Create custom error response** を **2回** 作成:

| HTTP error code | Customize error response | Response page path | HTTP response code | Error caching minimum TTL |
|-----------------|--------------------------|--------------------|--------------------|---------------------------|
| 403 | Yes | `/index.html` | 200 | 10（秒） |
| 404 | Yes | `/index.html` | 200 | 10（秒） |

参考:

- [Configure error response behavior](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/custom-error-pages-procedure.html)
- [Deploy a React-based SPA to S3 and CloudFront（Prescriptive Guidance）](https://docs.aws.amazon.com/prescriptive-guidance/latest/patterns/deploy-a-react-based-single-page-application-to-amazon-s3-and-cloudfront.html)

### 2-6. ディストリビューション URL を控える

**General** タブの **Distribution domain name**（例: `d1234abcd.cloudfront.net`）をメモします。  
本番 URL は **`https://` + このドメイン** です。

ステータスが **Deployed** になるまで待ちます（初回は十数分かかることがあります）。

---

## Phase 3: フロントをビルドして S3 にアップロード

### 3-1. ビルド

```powershell
cd frontend
npm ci
npm run build
```

`dist/` が生成されます。  
`.env.production` により `VITE_API_BASE_URL` は空のままビルドされます（変更不要）。

### 3-2. S3 へアップロード

**方法 A: AWS CLI（推奨）**

```powershell
# 初回のみ: aws configure で ap-northeast-1 の認証情報を設定
aws s3 sync dist/ s3://syodan-frontend-542000445970/ --delete --region ap-northeast-1
```

`--delete` は S3 上の古いファイルを削除します（ビルド成果物と同期）。

**方法 B: マネコン**

1. S3 バケットを開く → **アップロード**
2. `dist` フォルダ**の中身**（`index.html`, `assets/` など）をすべて選択してアップロード
3. フォルダごと `dist/` というプレフィックスで上げないよう注意（ルートに `index.html` がある状態にする）

### 3-3. CloudFront キャッシュの無効化

再デプロイ後、すぐ反映させるにはキャッシュを消します。

```powershell
aws cloudfront create-invalidation `
  --distribution-id EXXXXXXXXXXXXX `
  --paths "/*"
```

`EXXXXXXXXXXXXX` は CloudFront コンソールの **Distribution ID** です。

---

## Phase 4: バックエンド（ECS）の設定更新

HULFT 連携などで使う評価ページ URL は `FRONTEND_BASE_URL` から生成されます。  
CloudFront の URL に合わせて ECS タスク定義を更新します。

1. `backend/scripts/task-def-register.json` の `FRONTEND_BASE_URL` を変更:

```json
{
  "name": "FRONTEND_BASE_URL",
  "value": "https://d1234abcd.cloudfront.net"
}
```

2. ECS コンソールで新しいタスク定義リビジョンを登録し、サービスを **強制新規デプロイ**

`CORS_ORIGINS` は同一オリジンプロキシのため **変更不要** です。

---

## Phase 5: 動作確認

CloudFront の URL を `https://YOUR_DISTRIBUTION.cloudfront.net` に置き換えて確認します。

| # | 確認内容 | 期待結果 |
|---|----------|----------|
| 1 | トップ `https://...cloudfront.net/` | 画面が表示される（200） |
| 2 | `https://...cloudfront.net/settings` | SPA ルートが表示される（XML エラーや真っ白でない） |
| 3 | `https://...cloudfront.net/health` | `{"status":"ok"}` |
| 4 | ブラウザでプログラム作成 → ロープレ開始 | REST と WebSocket が動く |
| 5 | 開発者ツールの Network | API が `https://...cloudfront.net/api/...` 向き（ALB 直ではない） |

PowerShell での簡易チェック:

```powershell
curl https://YOUR_DISTRIBUTION.cloudfront.net/health
```

---

## 再デプロイ（2回目以降）

フロントのコードを変更したとき:

```powershell
cd frontend
npm run build
aws s3 sync dist/ s3://syodan-frontend-542000445970/ --delete --region ap-northeast-1
aws cloudfront create-invalidation --distribution-id EXXXXXXXXXXXXX --paths "/*"
```

HTML/JS の変更は invalidation 後、通常 **1〜2分** で全世界のエッジに反映されます。

---

## Cloudflare からの切り替え

1. 上記 Phase 1〜5 を完了し、CloudFront URL で問題ないことを確認
2. ECS の `FRONTEND_BASE_URL` を CloudFront URL に更新済みであることを確認
3. 利用者向け URL を CloudFront に切り替え
4. 問題なければ Cloudflare Pages のデプロイを停止（並行稼働期間を設けると安全）

既存の Cloudflare 手順: [`docs/20260622-cloudflare-frontend-deploy.md`](./20260622-cloudflare-frontend-deploy.md)

---

## トラブルシュート

| 症状 | 確認・対処 |
|------|------------|
| CloudFront 経由で S3 が **403 Access Denied** | OAC 用の **バケットポリシー** が S3 に入っているか。`AWS:SourceArn` のディストリビューション ID が正しいか。[OAC 設定](https://repost.aws/knowledge-center/cloudfront-oac-origins) |
| `/settings` が XML の AccessDenied | カスタムエラーレスポンス（403→`/index.html` 200）が未設定 |
| `/health` や `/api/*` が 502/504 | ALB / ECS が起動しているか。`curl http://syodan-alb-.../health` |
| **Mixed Content** / `Failed to fetch` | 本番ビルドに `VITE_API_BASE_URL=http://...` が埋め込まれていないか。`.env.production` で空にして再ビルド |
| WebSocket がすぐ切れる | `/ws/*` ビヘイビアの Origin request policy が **AllViewer** か。ALB のアイドルタイムアウト ≥ 300秒（[`docs/aws-setup.md`](./aws-setup.md)） |
| 変更が反映されない | `create-invalidation` を実行したか。ビヘイビア変更後はディストリビューションが **Deployed** になるまで待つ |
| S3 に直接 URL でアクセスしたい | 設計上不可（非公開バケット）。必ず CloudFront 経由 |

---

## 将来: 独自ドメインを付ける場合（今回はスキップ可）

1. Route 53 または外部 DNS でドメインを用意
2. **ACM（us-east-1）** で証明書を発行（CloudFront 用証明書は us-east-1 必須）
3. CloudFront の **Alternate domain name (CNAME)** にドメインを追加
4. DNS を CloudFront に向ける
5. `FRONTEND_BASE_URL` を `https://your-domain.example` に更新

参考: [Restrict access to Application Load Balancers](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/restrict-access-to-load-balancer.html)

---

## 公式ドキュメント（参照元）

| トピック | URL |
|----------|-----|
| CloudFront 標準ディストリビューションの開始 | https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/GettingStarted.SimpleDistribution.html |
| S3 オリジンへの OAC | https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html |
| 複数オリジン・パスルーティング | https://repost.aws/knowledge-center/cloudfront-requests-origins |
| マネージドキャッシュポリシー | https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/using-managed-cache-policies.html |
| マネージドオリジンリクエストポリシー | https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/using-managed-origin-request-policies.html |
| WebSocket | https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/distribution-working-with.websockets.html |
| カスタムエラーレスポンス | https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/custom-error-pages-procedure.html |
| React SPA on S3 + CloudFront | https://docs.aws.amazon.com/prescriptive-guidance/latest/patterns/deploy-a-react-based-single-page-application-to-amazon-s3-and-cloudfront.html |
| ALB をオリジンに使う | https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/DownloadDistS3AndCustomOrigins.html |

---

## リポジトリ内の関連ファイル

| ファイル | 役割 |
|----------|------|
| `frontend/.env.production` | 本番ビルドで API URL を空にする |
| `frontend/functions/_middleware.ts` | Cloudflare 用プロキシ（AWS では CloudFront ビヘイビアが代替） |
| `frontend/public/_redirects` | Cloudflare 用 SPA フォールバック（AWS ではカスタムエラーレスポンスが代替） |
| `backend/scripts/task-def-register.json` | `FRONTEND_BASE_URL` の更新先 |
| `docs/20260622-cloudflare-frontend-deploy.md` | 現行 Cloudflare デプロイ手順 |
