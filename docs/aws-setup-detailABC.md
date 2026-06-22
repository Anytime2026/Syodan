# AWS セットアップ詳細手順（Phase A / B / C）

`aws-setup.md` の初学者向け詳細版です。マネコン操作を画面単位で説明します。  
リージョンはすべて **ap-northeast-1（東京）** に統一してください。

## 目次

- [全体アーキテクチャ](#全体アーキテクチャ)
- [作業順序の推奨](#作業順序の推奨)
- [Phase A: ネットワーク（VPC）](#phase-a-ネットワークvpc)
- [Phase B: データストア](#phase-b-データストア)
- [Phase C: コンピュート（ECR / ECS / ALB）](#phase-c-コンピュートecr--ecs--alb)
- [Phase C 事前準備（IAM / CloudWatch / SG）](#phase-c-事前準備iam--cloudwatch--sg)
- [トラブルシューティング（Q&A 集）](#トラブルシューティングqa-集)
- [完了チェックリスト](#完了チェックリスト)

---

## 全体アーキテクチャ

```
[ブラウザ localhost:5173]
        ↓ HTTP / WebSocket
   [ALB]  public サブネット（1a, 1c）
        ↓ :8000
   [ECS Fargate]  private サブネット
        ├──→ [RDS PostgreSQL]  private
        ├──→ [S3]  音声保存
        ├──→ [Bedrock / Transcribe / Polly]  AWS API
        └──→ [Secrets Manager]  起動時に環境変数注入
```

| レイヤー | 公開範囲 | 役割 |
|----------|----------|------|
| ALB | インターネット向け（HTTP:80） | 外向き入口 |
| ECS | private のみ | アプリ本体 |
| RDS | private のみ | データ永続化 |
| S3 | パブリックブロック | 音声ファイル |

---

## 作業順序の推奨

```
Phase A  VPC / NAT / VPCエンドポイント
    ↓
Phase B  事前: ECS用SG・RDS用SG
         RDS → S3 → Secrets Manager
    ↓
Phase C  事前: IAMロール / CloudWatchロググループ / ALB用SG
         ECR → ECSクラスタ → ALB+TG → タスク定義 → ECSサービス
    ↓
Phase D〜F  IAM最終確認 / Bedrock / docker push
```

---

## Phase A: ネットワーク（VPC）

### A-1. VPC 作成（ウィザード）

**VPC コンソール → VPC を作成 → 「VPC など」**

| 項目 | 値 | 備考 |
|------|-----|------|
| 作成するリソース | **VPC など** | VPC + サブネット + IGW + ルートテーブル一括 |
| IPv4 CIDR | `10.0.0.0/16` | |
| AZ 数 | **2**（`1a`, `1c`） | |
| パブリックサブネット | 2 | ALB 用 |
| プライベートサブネット | 2 | ECS / RDS 用 |
| テナンシー | **デフォルト** | OK |
| NAT ゲートウェイ | **1 つ**（または 1 AZ あたり 1 つ） | **「なし」は NG**（後述 A-3） |
| VPC エンドポイント | **S3 ゲートウェイ** にチェック | Interface 型は別途 A-4 |
| DNS ホスト名を有効化 | **オン** | ECS / RDS / Interface EP で必要 |
| DNS 解決を有効化 | **オン** | 同上 |

作成後、サブネット名・CIDR を以下に合わせてリネーム（ウィザードのデフォルト名のままでも CIDR で判別可）:

| 名前 | CIDR | AZ | 用途 |
|------|------|-----|------|
| `syodan-public-1a` | `10.0.1.0/24` | 1a | ALB |
| `syodan-public-1c` | `10.0.2.0/24` | 1c | ALB |
| `syodan-private-1a` | `10.0.11.0/24` | 1a | ECS / RDS |
| `syodan-private-1c` | `10.0.12.0/24` | 1c | ECS / RDS |

**public の判定:** ルートテーブルに `0.0.0.0/0 → igw-xxx` があること。

---

### A-3. NAT Gateway（詳細）

NAT は **private サブネットの ECS がインターネットへ出る出口**（HULFT Webhook 等）。

```
[ECS private] → 0.0.0.0/0 → [NAT] → [IGW] → インターネット
```

**NAT は public サブネットに置く**（private だと IGW 経由で外に出られない）。

#### ウィザードで NAT を作った場合

**VPC コンソール → NAT ゲートウェイ** で `Available` な NAT があれば A-3 は完了。private ルートテーブルの `0.0.0.0/0 → nat-xxx` を確認するだけ。

#### 手動作成手順

**ステップ 1: Elastic IP**

- **方法 A（推奨）:** NAT 作成画面で「新しい Elastic IP の割り当て」を選ぶ（先に作る必要なし）
- **方法 B:** VPC → Elastic IP → 割り当て（名前例: `syodan-nat-eip`）

**ステップ 2: NAT Gateway 作成**

1. **VPC コンソール → NAT ゲートウェイ → NAT ゲートウェイを作成**
2. 名前: `syodan-nat-1a`
3. サブネット: **`syodan-public-1a`**（public のみ）
4. 接続タイプ: Public
5. Elastic IP: 新規または既存を選択
6. 状態が **Available** になるまで待つ（1〜3 分）

**ステップ 3: private ルートテーブル**

1. **VPC → ルートテーブル** → private サブネットに紐づくテーブルを開く
2. **ルートを編集** → 追加:

```
送信先:   0.0.0.0/0
ターゲット: NAT ゲートウェイ → syodan-nat-1a
```

private が 2 つのルートテーブルに分かれている場合は **両方** に追加。  
コスト最小なら NAT は **1 つ（1a）** で可（1c の private も同じ NAT へ向けられる）。

#### 完成時のルート構成

| ルートテーブル | 0.0.0.0/0 の向き先 |
|----------------|-------------------|
| public 用 | `igw-xxx` |
| private 用 | `nat-xxx` |

---

### A-4. VPC エンドポイント（推奨）

#### 何のためか

| 経路 | 説明 |
|------|------|
| NAT のみ | ECS → NAT → インターネット → AWS 公開 API |
| VPC EP あり | ECS → VPC 内の専用口 → AWS サービス（インターネットを通らない） |

A-4 は **推奨**。NAT だけでも動くが、本番では EP を作る想定。

#### Gateway 型（S3 のみ）

| 項目 | 値 |
|------|-----|
| タイプ | Gateway |
| サービス | `com.amazonaws.ap-northeast-1.s3` |
| VPC | `syodan-vpc` |
| ルートテーブル | **private 用** にチェック |

ウィザードで S3 ゲートウェイを有効にしていれば **作成済みのことが多い**。  
**VPC → エンドポイント** で確認。SG 不要。

#### Interface 型（7 サービス）

各サービスを **1 つずつ** 作成（計 7 回）:

| 名前（任意） | サービス名 |
|-------------|-----------|
| `syodan-bedrock-runtime` | `bedrock-runtime` |
| `syodan-transcribe` | `transcribe` |
| `syodan-polly` | `polly` |
| `syodan-secretsmanager` | `secretsmanager` |
| `syodan-ecr-api` | `ecr.api` |
| `syodan-ecr-dkr` | `ecr.dkr` |
| `syodan-logs` | `logs` |

共通設定:

| 項目 | 値 |
|------|-----|
| タイプ | Interface |
| VPC | `syodan-vpc` |
| サブネット | private × 2 |
| SG | `syodan-vpc-endpoint-sg`（専用 SG） |
| プライベート DNS を有効化 | **オン**（コード変更不要） |

**`syodan-vpc-endpoint-sg` のインバウンド:**

```
HTTPS 443 ← ソース: syodan-ecs-task-sg
```

#### アプリとの対応

| エンドポイント | 用途 |
|----------------|------|
| s3 | 音声一時保存・録音保存 |
| bedrock-runtime | Claude 応答・分析 |
| transcribe | 音声→文字 |
| polly | 文字→音声 |
| secretsmanager | ECS 起動時シークレット |
| ecr.api / ecr.dkr | イメージ pull |
| logs | CloudWatch Logs |

---

## Phase B: データストア

### Phase B で作るもの

| 順番 | リソース | 役割 |
|------|----------|------|
| 事前 | SG × 2 | ECS 用・RDS 用 |
| B-1 | RDS PostgreSQL | 本番 DB |
| B-2 | S3 | 音声保存 |
| B-3 | Secrets Manager × 3 | パスワード・API キー |

---

### B 事前準備: セキュリティグループ

#### `syodan-ecs-task-sg`（Phase B で作成、Phase C でも使用）

1. **VPC → セキュリティグループ → 作成**
2. 名前: `syodan-ecs-task-sg`、VPC: `syodan-vpc`
3. インバウンドは **Phase C で ALB から 8000 を追加**（今は空で可）

#### `syodan-rds-sg`

1. 名前: `syodan-rds-sg`、VPC: `syodan-vpc`
2. インバウンド:

```
PostgreSQL 5432 ← ソース: セキュリティグループ syodan-ecs-task-sg
```

---

### B-1. RDS PostgreSQL

#### ステップ 0: DB サブネットグループ

1. **RDS コンソール → サブネットグループ → 作成**
2. 名前: `syodan-db-subnet-group`
3. VPC: `syodan-vpc`
4. AZ: `1a`, `1c`
5. サブネット: **`syodan-private-1a`**, **`syodan-private-1c`** のみ

#### ステップ 1〜8: データベース作成

1. **RDS → データベース → データベースの作成**
2. **標準作成**（Easy create ではなく VPC/SG を細かく指定する）

| セクション | 項目 | 値 |
|-----------|------|-----|
| エンジン | タイプ | PostgreSQL 16.x |
| テンプレート | | 開発/テスト または サンドボックス |
| 設定 | DB 識別子 | `syodan-db` |
| 設定 | マスターユーザー | `syodan` |
| 設定 | 認証 | **セルフマネージド**（パスワードを自分で管理） |
| インスタンス | クラス | `db.t4g.micro` |
| 可用性 | | **シングル AZ**（開発初期） |
| 接続 | EC2 への接続 | **接続しない** |
| 接続 | VPC | `syodan-vpc` |
| 接続 | サブネットグループ | `syodan-db-subnet-group` |
| 接続 | パブリックアクセス | **いいえ** |
| 接続 | SG | **既存** `syodan-rds-sg` のみ |
| 接続 | ポート | `5432` |
| 追加設定 | 初期 DB 名 | `syodan` |
| 追加設定 | 暗号化 | **有効** |

3. **作成** → ステータス **利用可能** まで 5〜10 分待つ
4. **接続とセキュリティ** タブでエンドポイントを控える

`DATABASE_URL` の形式（Phase C で使用）:

```
postgresql+asyncpg://syodan:{パスワード}@{エンドポイント}:5432/syodan
```

---

### B-2. S3 バケット

1. **S3 → バケットを作成**
2. バケット名: `syodan-audio-{アカウントID}`（12 桁 ID、グローバル一意）
3. リージョン: `ap-northeast-1`
4. タイプ: **汎用**
5. **ブロックパブリックアクセス: 4 項目すべてオン**（2024 年以降デフォルト）
6. 暗号化: **SSE-S3**（デフォルトで可）
7. **バケットを作成**

**バケットポリシー** は Phase D でタスクロール ARN が分かってから追加可（IAM ロール側の権限だけでも動作する場合あり）。

---

### B-3. Secrets Manager

**シークレットをストア** → **その他のシークレットのタイプ** → **プレーンテキスト** で JSON。

暗号化キー: `aws/secretsmanager`、ローテーション: **オフ**。

#### `syodan/db`

```json
{
  "username": "syodan",
  "password": "RDSのマスターパスワード",
  "host": "syodan-db.xxxxx.ap-northeast-1.rds.amazonaws.com",
  "port": 5432,
  "dbname": "syodan",
  "database_url": "postgresql+asyncpg://syodan:パスワード@syodan-db.xxxxx.ap-northeast-1.rds.amazonaws.com:5432/syodan"
}
```

> `database_url` は ECS が `DATABASE_URL` 環境変数として注入するために必要（ECS は JSON 複数フィールドの自動組み立て非対応）。

#### `syodan/internal-api-key`

```json
{
  "api_key": "ランダム32文字以上"
}
```

HULFT Square には **この api_key のみ** 配布。AWS IAM キーは渡さない。

#### `syodan/hulft`

```json
{
  "webhook_url": ""
}
```

---

## Phase C: コンピュート（ECR / ECS / ALB）

### Phase C 事前準備（IAM / CloudWatch / SG）

#### ① タスク実行ロール `ecsTaskExecutionRole`

ECS エージェントが ECR pull・Logs・Secrets 取得に使用。

1. **IAM → ロール → 作成**
2. 信頼されたエンティティ: **Elastic Container Service → Elastic Container Service タスク**
3. ポリシー: `AmazonECSTaskExecutionRolePolicy`
4. ロール名: `ecsTaskExecutionRole`
5. **ロール作成後**（ウィザード途中では不可）に Secrets 用ポリシーを追加

**インラインポリシーが追加できない場合** → カスタマー管理ポリシーを作成してアタッチ:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["secretsmanager:GetSecretValue"],
      "Resource": "arn:aws:secretsmanager:ap-northeast-1:{account-id}:secret:syodan/*"
    }
  ]
}
```

ポリシー名例: `SyodanEcsSecretsRead` → `ecsTaskExecutionRole` にアタッチ。

#### ② タスクロール `syodan-ecs-task-role`

アプリ本体が Bedrock / S3 等を呼ぶときに使用。Phase D の JSON ポリシーをアタッチ。

> `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` を環境変数に **入れない**。

#### ③ CloudWatch ロググループ

「ロググループ」というトップレベルタブは **ない**。左メニュー **Log Management（ログ管理）** を開く。

直接 URL:  
https://console.aws.amazon.com/cloudwatch/home?region=ap-northeast-1#logsV2:log-groups

1. **アクション → ロググループを作成**
2. 名前: `/ecs/syodan`
3. 保持: 7〜30 日（任意）

旧 UI の場合: **Logs → Log groups**。

#### ④ ALB 用 SG `syodan-alb-sg`

**VPC コンソール → セキュリティグループ → 作成**（ALB 画面ではない）

| 項目 | 値 |
|------|-----|
| 名前 | `syodan-alb-sg` |
| VPC | `syodan-vpc` |

**インバウンド:**

```
HTTP  TCP 80  ソース: Anywhere-IPv4 (0.0.0.0/0)
```

**アウトバウンド:** デフォルト（すべてのトラフィック → 0.0.0.0/0）のまま。

##### `0.0.0.0/0` は危くないか？

- **開くのは ALB の 80 番だけ**。ECS / RDS は private で直接触れない。
- フロントが `localhost`、バックエンドが ALB DNS の構成では、送信元 IP を絞れないため **インターネット向け ALB では一般的**。
- リスクは「URL が分かれば API を叩ける」こと → **Phase G の HTTPS**、必要なら **WAF** で段階的に強化。
- **ECS の 8000 を 0.0.0.0/0 に開けるのは NG**。`syodan-alb-sg` からのみ許可。

#### ⑤ ECS タスク SG に ALB ルール追加

`syodan-ecs-task-sg` → **インバウンドのルールを編集** → 追加:

```
カスタム TCP  8000  ←  セキュリティグループ: syodan-alb-sg
```

---

### C-1. ECR

1. **ECR → リポジトリを作成**
2. 名前: `syodan-backend`、可視性: プライベート
3. イメージスキャン: **プライベートレジストリ → スキャン** で Basic のプッシュ時スキャンを有効化（または Enhanced / Inspector 連携）
4. URI を控える: `{account-id}.dkr.ecr.ap-northeast-1.amazonaws.com/syodan-backend`

---

### C-2. ECS クラスタ

1. **ECS → クラスター → 作成**
2. 名前: `syodan`、インフラ: **AWS Fargate のみ**

#### エラー: `Unable to assume the service linked role`

初回アカウントで `AWSServiceRoleForECS` が無い場合に発生。

```powershell
aws iam create-service-linked-role --aws-service-name ecs.amazonaws.com
```

1〜2 分待ってからクラスタを再作成。  
「既に存在する」エラーならロールはあるので再試行のみ。権限不足なら管理者に依頼。

---

### C-5. ALB（C-4 サービスより先に作成推奨）

#### ターゲットグループ

1. **EC2 → ターゲットグループ → 作成**
2. ターゲットタイプ: **IP**
3. 名前: `syodan-backend-tg`、プロトコル HTTP、ポート **8000**
4. VPC: `syodan-vpc`
5. ターゲット登録は **スキップ**

**ヘルスチェック（編集）:**

| 項目 | 値 |
|------|-----|
| パス | `/health` |
| ポート | トラフィックポート（8000） |
| 成功コード | 200 |

#### ALB 本体

1. **EC2 → ロードバランサー → 作成 → Application Load Balancer**

| セクション | 項目 | 値 |
|-----------|------|-----|
| 基本設定 | 名前 | `syodan-alb` |
| 基本設定 | スキーム | **インターネット向け** |
| **ネットワークマッピング** | VPC | `syodan-vpc` |
| **ネットワークマッピング** | 可用性ゾーンとサブネット | `syodan-public-1a`, `syodan-public-1c`（**2 AZ 必須**） |
| セキュリティグループ | | `syodan-alb-sg` のみ（デフォルト SG は外す） |
| リスナー | | HTTP:80 → `syodan-backend-tg` |

> 「マッピング」単体のセクション名はない。公式表記は **Network mapping（ネットワークマッピング）** 内の **Availability Zones and subnets（可用性ゾーンとサブネット）**。

#### アイドルタイムアウト（WebSocket 必須）

ALB → **属性** → **編集** → **接続アイドルタイムアウト**: `300` 秒（デフォルト 60 秒では WS が切れる）。

DNS 名を控える（Phase F のフロント `.env` に使用）。

---

### C-3. タスク定義

1. **ECS → タスク定義 → 新しいタスク定義を作成**

| 項目 | 値 |
|------|-----|
| ファミリー | `syodan-backend` |
| 起動タイプ | Fargate |
| CPU / メモリ | 0.5 vCPU / 1 GB |
| タスクロール | `syodan-ecs-task-role` |
| タスク実行ロール | `ecsTaskExecutionRole` |

**コンテナ `syodan-backend`:**

| 項目 | 値 |
|------|-----|
| イメージ | `{account-id}.dkr.ecr.ap-northeast-1.amazonaws.com/syodan-backend:latest` |
| ポート | TCP 8000 |

**環境変数（平文）:**

| キー | 値 |
|------|-----|
| `APP_ENV` | `production` |
| `AWS_REGION` | `ap-northeast-1` |
| `AWS_STUB_MODE` | `false` |
| `S3_BUCKET_NAME` | `syodan-audio-{account-id}` |
| `CORS_ORIGINS` | `http://localhost:5173` |
| `HULFT_STUB_MODE` | `true` |

**Secrets（値のタイプ: ValueFrom）:**

| キー | ValueFrom 例 |
|------|-------------|
| `DATABASE_URL` | `arn:...:secret:syodan/db-XXXXXX:database_url::` |
| `INTERNAL_API_KEY` | `arn:...:secret:syodan/internal-api-key-XXXXXX:api_key::` |
| `HULFT_WEBHOOK_URL` | `arn:...:secret:syodan/hulft-XXXXXX:webhook_url::` |

**ログ設定（「ログ設定」セクションは存在しない）:**

コンテナ定義内の **ログ収集を使用（Use log collection）** にチェック → **Amazon CloudWatch** を選択:

| キー | 値 |
|------|-----|
| `awslogs-group` | `/ecs/syodan` |
| `awslogs-region` | `ap-northeast-1` |
| `awslogs-stream-prefix` | `ecs` |

JSON エディタを使う場合:

```json
"logConfiguration": {
  "logDriver": "awslogs",
  "options": {
    "awslogs-group": "/ecs/syodan",
    "awslogs-region": "ap-northeast-1",
    "awslogs-stream-prefix": "ecs"
  }
}
```

---

### C-4. ECS サービス

1. **ECS → クラスタ syodan → サービス → 作成**

| 項目 | 値 |
|------|-----|
| タスク定義 | `syodan-backend` 最新 |
| サービス名 | `syodan-backend` |
| タスク数 | 1 |
| サブネット | private × 2 |
| パブリック IP | **オフ** |
| SG | `syodan-ecs-task-sg` |
| ロードバランサー | `syodan-alb` / HTTP:80 / `syodan-backend-tg` |
| ヘルスチェック猶予期間 | 120 秒 |

ECR にイメージが無いと `CannotPullContainerError` になる（Phase F で push 後に healthy 化）。

---

## トラブルシューティング（Q&A 集）

| 症状 | 原因 | 対処 |
|------|------|------|
| VPC ウィザードで NAT「なし」 | Phase A 手順と不一致 | NAT 1 つ以上を選択 |
| Interface EP だけでは不足 | S3 は Gateway 型 | S3 ゲートウェイ + Interface 7 種 |
| インラインポリシー追加不可 | ウィザード途中 or 権限不足 | ロール作成後に追加、またはカスタマー管理ポリシー |
| CloudWatch にロググループタブ無し | UI 変更 | **Log Management** を使用 |
| ALB で「マッピング」が見つからない | 名称違い | **ネットワークマッピング** 内のサブネット選択 |
| ECS クラスタ作成失敗（service linked role） | 初回アカウント | `create-service-linked-role` 後に再試行 |
| ターゲット unhealthy | SG / パス / ポート | ecs:8000←alb-sg、`/health`、8000 |
| WebSocket 60 秒で切断 | ALB タイムアウト | アイドルタイムアウト 300 秒 |
| Secrets 注入されない | 実行ロール権限 | `GetSecretValue` on `syodan/*` |
| DATABASE_URL 空 | JSON キー参照ミス | `syodan/db` に `database_url` 追加 |

---

## 完了チェックリスト

### Phase A

- [ ] VPC `syodan-vpc`（10.0.0.0/16）、public/private 各 2 AZ
- [ ] NAT Gateway が public 1a にあり、private の `0.0.0.0/0 → NAT`
- [ ] S3 Gateway エンドポイント
- [ ] Interface エンドポイント 7 種（推奨）
- [ ] DNS ホスト名・DNS 解決が有効

### Phase B

- [ ] `syodan-ecs-task-sg` / `syodan-rds-sg`
- [ ] RDS `syodan-db`（private、暗号化、5432←ecs-task-sg）
- [ ] S3 `syodan-audio-{account-id}`（パブリックブロック、SSE-S3）
- [ ] Secrets × 3（`database_url` 含む）

### Phase C

- [ ] `ecsTaskExecutionRole` + Secrets ポリシー
- [ ] `syodan-ecs-task-role` + Phase D ポリシー
- [ ] CloudWatch `/ecs/syodan`
- [ ] `syodan-alb-sg` + ecs-task-sg に 8000←alb
- [ ] ECR `syodan-backend`
- [ ] ECS クラスタ `syodan`
- [ ] ALB + TG（`/health`、アイドル 300 秒）
- [ ] タスク定義 + サービス（private、ALB 連携）

---

## 参考リンク

- [RDS DB インスタンス作成](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_CreateDBInstance.html)
- [S3 バケット作成](https://docs.aws.amazon.com/AmazonS3/latest/userguide/create-bucket-overview.html)
- [Secrets Manager シークレット作成](https://docs.aws.amazon.com/secretsmanager/latest/userguide/create_secret.html)
- [ECS タスク定義作成](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/create-task-definition.html)
- [ALB 作成](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/create-application-load-balancer.html)
- [ALB アイドルタイムアウト](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/edit-load-balancer-attributes.html)
- [ECS CloudWatch Logs](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/using_awslogs.html)

---

簡易版は [`aws-setup.md`](./aws-setup.md) を参照。Phase D は [`aws-setup-detailD.md`](./aws-setup-detailD.md)、Phase E は [`aws-setup-detailE.md`](./aws-setup-detailE.md) を参照してください。
