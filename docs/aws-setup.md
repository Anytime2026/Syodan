# AWS セットアップ手順（マネコン操作）

営業ヒアリングロープレAIのバックエンドを **ECS Fargate + ALB** でホストするための手順です。  
フロントエンドはローカル（`localhost:5173`）、バックエンドのみ AWS（`ap-northeast-1`）に配置します。

## 前提

- 会社 AWS アカウントへ管理者またはインフラ担当の権限があること
- 初回は **ALB の DNS 名 + HTTP/WS** で接続（独自ドメイン・ACM は後から追加可能）
- 機密情報はコードに書かず **Secrets Manager** と **IAM ロール** で管理する

---

## Phase A: ネットワーク（VPC）

### A-1. VPC 作成

1. VPC コンソール → **VPC を作成**
2. 設定例:
   - 名前: `syodan-vpc`
   - IPv4 CIDR: `10.0.0.0/16`
   - AZ: `ap-northeast-1a`, `ap-northeast-1c`（2 AZ）

### A-2. サブネット

| 名前 | CIDR | AZ | 用途 |
|------|------|-----|------|
| `syodan-public-1a` | `10.0.1.0/24` | 1a | ALB |
| `syodan-public-1c` | `10.0.2.0/24` | 1c | ALB |
| `syodan-private-1a` | `10.0.11.0/24` | 1a | ECS / RDS |
| `syodan-private-1c` | `10.0.12.0/24` | 1c | ECS / RDS |

Public サブネットは **インターネットゲートウェイ** へのルートを有効化。

### A-3. NAT Gateway

1. Elastic IP を 1 つ割り当て
2. Public サブネット（1a）に NAT Gateway を作成
3. Private サブネットのルートテーブルで `0.0.0.0/0` → NAT Gateway

### A-4. VPC エンドポイント（推奨・エンタープライズ）

Private サブネットから AWS API へのアウトバウンドを VPC 内に閉じます。

| タイプ | サービス |
|--------|----------|
| Gateway | `com.amazonaws.ap-northeast-1.s3` |
| Interface | `bedrock-runtime`, `transcribe`, `polly`, `secretsmanager`, `ecr.api`, `ecr.dkr`, `logs` |

Interface エンドポイントには専用 SG を付与し、ECS タスク SG からのみ HTTPS(443) を許可。

---

## Phase B: データストア

### B-1. RDS PostgreSQL

1. RDS → **データベースの作成** → PostgreSQL 16
2. 設定例:
   - 識別子: `syodan-db`
   - インスタンス: `db.t4g.micro`
   - ストレージ暗号化: **有効**
   - VPC: `syodan-vpc`、**プライベートサブネット** の DB サブネットグループ
   - パブリックアクセス: **いいえ**
   - SG: ECS タスク SG から TCP 5432 のみ許可

### B-2. S3 バケット

1. バケット名: `syodan-audio-{アカウントID}`（グローバル一意）
2. リージョン: `ap-northeast-1`
3. **ブロックパブリックアクセス**: すべてオン
4. 暗号化: **SSE-S3（AES-256）** または SSE-KMS
5. バケットポリシー: ECS タスクロールの `PutObject` / `GetObject` のみ許可

### B-3. Secrets Manager

以下のシークレットを作成:

| 名前 | 内容（JSON 例） |
|------|----------------|
| `syodan/db` | `{"username":"syodan","password":"...","host":"syodan-db.xxx.rds.amazonaws.com","port":5432,"dbname":"syodan"}` |
| `syodan/internal-api-key` | `{"api_key":"ランダム32文字以上"}` |
| `syodan/hulft` | `{"webhook_url":""}` （HULFT 接続時に設定） |

HULFT Square には **internal-api-key のみ** 配布し、AWS IAM キーは渡さない。

---

## Phase C: コンピュート（ECR / ECS / ALB）

### C-1. ECR

1. リポジトリ作成: `syodan-backend`
2. イメージスキャン: プッシュ時スキャン有効（推奨）

### C-2. ECS クラスタ

- 名前: `syodan`
- インフラ: AWS Fargate

### C-3. タスク定義

| 項目 | 値 |
|------|-----|
| 起動タイプ | Fargate |
| CPU / メモリ | 0.5 vCPU / 1 GB |
| コンテナポート | 8000 |
| 実行ロール | `ecsTaskExecutionRole`（ECR pull + Logs + Secrets 取得） |
| タスクロール | 下記 IAM ポリシー |

**環境変数（非機密）**:

```
APP_ENV=production
AWS_REGION=ap-northeast-1
AWS_STUB_MODE=false
S3_BUCKET_NAME=syodan-audio-{account-id}
CORS_ORIGINS=http://localhost:5173
HULFT_STUB_MODE=true
```

**Secrets（環境変数として注入）**:

- `DATABASE_URL` ← `syodan/db` を組み立て
- `INTERNAL_API_KEY` ← `syodan/internal-api-key`
- `HULFT_WEBHOOK_URL` ← `syodan/hulft`（任意）

### C-4. ECS サービス

- クラスタ: `syodan`
- 起動タイプ: Fargate
- タスク数: 1
- ネットワーク: **プライベートサブネット**、パブリック IP なし
- SG: ALB SG から TCP 8000 のみ許可

### C-5. ALB

1. スキーム: internet-facing
2. サブネット: Public ×2
3. リスナー: **HTTP:80**（初回。HTTPS は Phase G）
4. ターゲットグループ:
   - タイプ: IP（Fargate）
   - ポート: 8000
   - ヘルスチェック: `GET /health`、200
5. **アイドルタイムアウト: 300 秒以上**（WebSocket 長時間接続）

デプロイ後、ALB の DNS 名（例: `syodan-alb-1234567890.ap-northeast-1.elb.amazonaws.com`）を控える。

---

## Phase D: IAM（最小権限）

詳細手順（マネコン画面単位）: [`aws-setup-detailD.md`](./aws-setup-detailD.md)

### タスクロールにアタッチするポリシー例

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
      "Resource": [
        "arn:aws:bedrock:ap-northeast-1::foundation-model/anthropic.claude-*",
        "arn:aws:bedrock:ap-northeast-3::foundation-model/anthropic.claude-*",
        "arn:aws:bedrock:ap-northeast-1:{account-id}:inference-profile/*",
        "arn:aws:bedrock:ap-northeast-3:{account-id}:inference-profile/jp.anthropic.claude-sonnet-4-6"
      ]
    },
    {
      "Effect": "Allow",
      "Action": ["transcribe:StartTranscriptionJob", "transcribe:GetTranscriptionJob"],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": ["polly:SynthesizeSpeech"],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject"],
      "Resource": "arn:aws:s3:::syodan-audio-{account-id}/*"
    },
    {
      "Effect": "Allow",
      "Action": ["secretsmanager:GetSecretValue"],
      "Resource": "arn:aws:secretsmanager:ap-northeast-1:{account-id}:secret:syodan/*"
    },
    {
      "Effect": "Allow",
      "Action": ["logs:CreateLogStream", "logs:PutLogEvents"],
      "Resource": "arn:aws:logs:ap-northeast-1:{account-id}:log-group:/ecs/syodan:*"
    }
  ]
}
```

**禁止事項**: ECS タスクに `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` を環境変数で設定しない。

---

## Phase E: Bedrock

詳細手順（マネコン画面単位）: [`aws-setup-detailE.md`](./aws-setup-detailE.md)

> **2025/09 以降**: 商業リージョンでは「モデルアクセス」画面は廃止。サーバーレスモデルはデフォルト有効。Anthropic のみ **初回利用フォーム（FTU）** が必要。

1. Bedrock コンソール → **モデルカタログ** → Anthropic モデルを選択 → **ユースケース詳細を送信**（FTU、1 アカウント 1 回）
2. **プレイグラウンド** で Claude Sonnet 4.6 の推論を確認
3. 利用モデル ID をタスク定義の環境変数に設定（推奨: 日本 Geo プロファイル）:
   - `BEDROCK_CHAT_MODEL_ID` = `jp.anthropic.claude-sonnet-4-6`
   - `BEDROCK_ANALYSIS_MODEL_ID` = `jp.anthropic.claude-sonnet-4-6`
4. ECS サービスを強制新規デプロイ

---

## Phase F: デプロイ

### ローカルからイメージをプッシュ

```bash
cd backend
aws ecr get-login-password --region ap-northeast-1 | docker login --username AWS --password-stdin {account-id}.dkr.ecr.ap-northeast-1.amazonaws.com
docker build -t syodan-backend .
docker tag syodan-backend:latest {account-id}.dkr.ecr.ap-northeast-1.amazonaws.com/syodan-backend:latest
docker push {account-id}.dkr.ecr.ap-northeast-1.amazonaws.com/syodan-backend:latest
```

ECS サービスを強制新規デプロイ。

### フロントエンド接続設定

`frontend/.env`:

```
VITE_API_BASE_URL=http://{ALB_DNS名}
VITE_WS_BASE_URL=ws://{ALB_DNS名}
```

```bash
cd frontend
npm.cmd install
npm.cmd run dev
```

ブラウザで `http://localhost:5173/roleplay/setup` を開き、ロープレを開始。

---

## Phase G: HTTPS アップグレード（将来）

会社ポリシーで HTTPS 必須の場合:

1. Route53 でドメイン取得・ホストゾーン作成
2. ACM で証明書発行（DNS 検証）
3. ALB に HTTPS:443 リスナー追加、HTTP → HTTPS リダイレクト
4. フロント `.env` を `https://` / `wss://` に更新

---

## セキュリティチェックリスト

- [ ] RDS はプライベートサブネット、暗号化有効
- [ ] S3 はパブリックアクセスブロック
- [ ] ECS はプライベートサブネット、タスクロールで AWS 接続
- [ ] 内部 API キーは Secrets Manager 管理、HULFT のみに配布
- [ ] CloudWatch Logs でアプリログを収集（DEBUG で真の課題を出さない）
- [ ] CORS は `localhost:5173` のみ（必要最小限）
- [ ] SG は ALB→ECS→RDS のみ通信を許可

---

## トラブルシューティング

| 症状 | 確認点 |
|------|--------|
| `/health` が 502 | ECS タスクが起動しているか、TG ヘルスチェック |
| WebSocket 切断 | ALB アイドルタイムアウト ≥ 300 秒 |
| Bedrock 403 | モデルアクセス承認、タスクロール IAM |
| CORS エラー | `CORS_ORIGINS` に `http://localhost:5173` |
| DB 接続失敗 | RDS SG、Secrets の接続文字列、サブネットグループ |
