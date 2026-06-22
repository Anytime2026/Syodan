# AWS セットアップ詳細手順（Phase D）

`aws-setup.md` の Phase D（IAM 最小権限）を初学者向けに画面単位で説明します。  
リージョンはすべて **ap-northeast-1（東京）** に統一してください。

Phase A〜C の手順は [`aws-setup-detailABC.md`](./aws-setup-detailABC.md) を参照。

## 目次

- [Phase D でやること](#phase-d-でやること)
- [Phase C との関係（完了済みかの確認）](#phase-c-との関係完了済みかの確認)
- [2 種類の IAM ロール](#2-種類の-iam-ロール)
- [D-0. 事前準備](#d-0-事前準備)
- [D-1. カスタマー管理ポリシー作成](#d-1-カスタマー管理ポリシー作成)
- [D-2. タスクロール作成（未作成の場合）](#d-2-タスクロール作成未作成の場合)
- [D-3. ポリシーをロールにアタッチ](#d-3-ポリシーをロールにアタッチ)
- [D-4. タスク定義との紐付け確認](#d-4-タスク定義との紐付け確認)
- [D-5. S3 バケットポリシー（任意）](#d-5-s3-バケットポリシー任意)
- [禁止事項](#禁止事項)
- [トラブルシューティング（Q&A 集）](#トラブルシューティングqa-集)
- [完了チェックリスト](#完了チェックリスト)
- [参考リンク](#参考リンク)

---

## Phase D でやること

| 作業 | リソース名 | 内容 |
|------|-----------|------|
| ポリシー作成 | `SyodanEcsTaskPolicy` | Bedrock / Transcribe / Polly / S3 の最小権限 |
| ロールへアタッチ | `syodan-ecs-task-role` | アプリ実行時に使うタスクロール |
| 紐付け確認 | タスク定義 `syodan-backend` | タスクロール欄が正しいか確認 |
| 任意 | S3 バケットポリシー | タスクロール ARN を明示的に許可 |

**Phase D の目的:** ECS 上の FastAPI アプリが、長期キーなしで AWS サービスを呼べるようにする。

---

## Phase C との関係（完了済みかの確認）

Phase C 事前準備で `syodan-ecs-task-role` の **ロール作成**は触れていますが、**ポリシー JSON の作成・アタッチは Phase D の作業**です。

以下 3 点をマネコンで確認してください。

1. **IAM → ロール → `syodan-ecs-task-role`** が存在する
2. そのロールの **許可** タブに `SyodanEcsTaskPolicy`（または同等のカスタムポリシー）がある
3. **ECS → タスク定義 `syodan-backend`** の **タスクロール** が `syodan-ecs-task-role`

| 状態 | 判定 |
|------|------|
| 3 つすべて OK | Phase D 完了 |
| ロールだけある・ポリシーが空 | Phase D の D-1〜D-3 を実施 |
| ポリシーはあるがタスク定義未設定 | D-4 を実施し、サービスを強制新規デプロイ |

---

## 2 種類の IAM ロール

ECS Fargate には IAM ロールが **2 種類** あります。混同しないことが重要です。

```
┌─────────────────────────────────────────────────────────┐
│  ECS タスク                                              │
│                                                          │
│  [ECS エージェント] ──→ タスク実行ロール                  │
│       │                  ecsTaskExecutionRole            │
│       │                  ・ECR からイメージ pull          │
│       │                  ・CloudWatch Logs へ書き込み     │
│       │                  ・起動時に Secrets を環境変数注入 │
│       │                  （Phase C 事前準備で作成済み）   │
│       │                                                  │
│  [FastAPI アプリ] ──→ タスクロール  ← Phase D            │
│                          syodan-ecs-task-role            │
│                          ・Bedrock（Claude 応答・分析）    │
│                          ・Transcribe（音声→文字）         │
│                          ・Polly（文字→音声）             │
│                          ・S3（録音・一時ファイル）        │
└─────────────────────────────────────────────────────────┘
```

| ロール | 誰が使うか | Phase |
|--------|-----------|-------|
| `ecsTaskExecutionRole` | ECS エージェント（コンテナ起動前後） | C 事前準備 |
| `syodan-ecs-task-role` | アプリコード（boto3 / AWS SDK） | **D** |

> Secrets Manager と CloudWatch Logs は **実行ロール** が担当します。タスクロールに `secretsmanager:*` や `logs:*` を付ける必要はありません（`aws-setup.md` の旧ポリシー例に含まれていたが、本番構成では実行ロール側で十分）。

---

## D-0. 事前準備

### アカウント ID を控える

1. マネコン右上のアカウント名をクリック
2. **12 桁のアカウント ID** をメモ（例: `123456789012`）

以降の `{account-id}` はこの数字に置き換えます。

### 前提リソース（Phase B / C で作成済みであること）

| リソース | 用途 |
|----------|------|
| S3 `syodan-audio-{account-id}` | ポリシーの Resource ARN |
| ECS タスク定義 `syodan-backend` | タスクロール欄の確認先 |
| `ecsTaskExecutionRole` | 実行ロール（Phase D では触らない） |

---

## D-1. カスタマー管理ポリシー作成

公式手順: [ECS タスク IAM ロールの作成（マネコン）](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-iam-roles.html)

### 手順

1. [IAM コンソール](https://console.aws.amazon.com/iam/) を開く
2. 左メニュー **ポリシー** → **ポリシーを作成**
3. **ポリシーエディター** で **JSON** タブを選択
4. 以下を貼り付け（`{account-id}` を実際の ID に置換）

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "BedrockClaudeInvoke",
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": [
        "arn:aws:bedrock:ap-northeast-1::foundation-model/anthropic.claude-*",
        "arn:aws:bedrock:ap-northeast-3::foundation-model/anthropic.claude-*",
        "arn:aws:bedrock:ap-northeast-1:{account-id}:inference-profile/*",
        "arn:aws:bedrock:ap-northeast-3:{account-id}:inference-profile/jp.anthropic.claude-sonnet-4-6"
      ]
    },
    {
      "Sid": "TranscribeJobs",
      "Effect": "Allow",
      "Action": [
        "transcribe:StartTranscriptionJob",
        "transcribe:GetTranscriptionJob"
      ],
      "Resource": "*"
    },
    {
      "Sid": "PollyTTS",
      "Effect": "Allow",
      "Action": ["polly:SynthesizeSpeech"],
      "Resource": "*"
    },
    {
      "Sid": "S3AudioBucket",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject"],
      "Resource": "arn:aws:s3:::syodan-audio-{account-id}/*"
    }
  ]
}
```

5. **次へ**
6. **ポリシー名**: `SyodanEcsTaskPolicy`
7. **説明**（任意）: `Syodan ECS task role - Bedrock, Transcribe, Polly, S3`
8. **ポリシーを作成**

### 各 Statement の根拠（このアプリのコード）

| Sid | Action | コード上の用途 |
|-----|--------|----------------|
| BedrockClaudeInvoke | `bedrock:InvokeModel` | `BedrockClient.invoke()` — 顧客応答・セッション分析 |
| BedrockClaudeInvoke | `bedrock:InvokeModelWithResponseStream` | 将来のストリーム応答用（[Bedrock 推論の前提条件](https://docs.aws.amazon.com/bedrock/latest/userguide/inference-prereq.html)） |
| TranscribeJobs | `StartTranscriptionJob`, `GetTranscriptionJob` | `TranscribeClient.transcribe_audio()` |
| PollyTTS | `polly:SynthesizeSpeech` | `PollyClient.synthesize()` |
| S3AudioBucket | `s3:PutObject`, `s3:GetObject` | 録音保存・STT 一時ファイル・presigned URL |

### `aws-setup.md` 旧ポリシーとの違い

| 項目 | 旧（aws-setup.md） | 本ドキュメント（推奨） |
|------|-------------------|----------------------|
| Bedrock Action | `InvokeModel` のみ | `InvokeModelWithResponseStream` も追加 |
| Bedrock Resource | foundation-model のみ | inference-profile も追加（クロスリージョン推論プロファイル利用時） |
| Secrets Manager | タスクロールに記載 | **削除**（実行ロール `ecsTaskExecutionRole` が担当） |
| CloudWatch Logs | タスクロールに記載 | **削除**（`AmazonECSTaskExecutionRolePolicy` が担当） |

### Bedrock のモデル ID と ARN

タスク定義の環境変数（Phase E で設定）の例:

```
BEDROCK_CHAT_MODEL_ID=jp.anthropic.claude-sonnet-4-6
BEDROCK_ANALYSIS_MODEL_ID=jp.anthropic.claude-sonnet-4-6
```

`anthropic.claude-*` のワイルドカードで上記モデルをカバーします。特定モデルだけに絞る場合は Resource を個別 ARN に変更してください（[推論プロファイルの前提条件](https://docs.aws.amazon.com/bedrock/latest/userguide/inference-profiles-prereq.html)）。

---

## D-2. タスクロール作成（未作成の場合）

Phase C 事前準備で `syodan-ecs-task-role` を作っていれば **D-3 へスキップ**。

### 手順

1. **IAM → ロール → ロールを作成**
2. **信頼されたエンティティのタイプ**: AWS のサービス
3. **ユースケース**: **Elastic Container Service** → **Elastic Container Service タスク**
4. **許可を追加**: ここでは **何も選ばず** **次へ**（ポリシーは D-3 で付ける）
5. **ロール名**: `syodan-ecs-task-role`
6. **ロールを作成**

### 信頼ポリシー（参考）

ウィザードが自動設定する信頼関係の例:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ecs-tasks.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

AWS 公式では `aws:SourceAccount` 条件を追加して confused deputy を防ぐことが推奨されています（[ECS タスク IAM ロール](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-iam-roles.html)）。組織のセキュリティポリシーに従って必要なら **信頼関係** タブから編集してください。

---

## D-3. ポリシーをロールにアタッチ

### 手順

1. **IAM → ロール → `syodan-ecs-task-role`** を開く
2. **許可** タブ → **許可を追加** → **ポリシーをアタッチ**
3. 検索欄に `SyodanEcsTaskPolicy` と入力してチェック
4. **許可を追加**

### 確認

**許可** タブに以下が表示されていれば OK:

| タイプ | 名前 |
|--------|------|
| カスタマーインライン または カスタマー管理 | `SyodanEcsTaskPolicy` |

`AmazonECSTaskExecutionRolePolicy` が付いている場合は **誤アタッチ** です。実行ロール用のポリシーなので、タスクロールから外してください。

---

## D-4. タスク定義との紐付け確認

### 手順

1. **ECS → タスク定義 → `syodan-backend`**（最新リビジョン）を開く
2. 以下を確認:

| 項目 | 正しい値 |
|------|----------|
| タスクロール | `syodan-ecs-task-role` |
| タスク実行ロール | `ecsTaskExecutionRole` |

### ロールを変更した場合

タスク定義のロール欄は **リビジョン単位** で固定されます。変更後は必ず:

1. **ECS → クラスタ `syodan` → サービス `syodan-backend`**
2. **更新** → **強制新規デプロイ** にチェック → **更新**

---

## D-5. S3 バケットポリシー（任意）

Phase B で S3 バケットを作成済みの場合、IAM ロール側の `s3:PutObject` / `s3:GetObject` だけで動作するケースが多いです（同一アカウント内）。

より明示的にアクセスを制限したい場合:

1. **S3 → `syodan-audio-{account-id}` → アクセス許可 → バケットポリシー → 編集**
2. 以下を貼り付け（`{account-id}` を置換）

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowSyodanEcsTaskRole",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::{account-id}:role/syodan-ecs-task-role"
      },
      "Action": ["s3:PutObject", "s3:GetObject"],
      "Resource": "arn:aws:s3:::syodan-audio-{account-id}/*"
    }
  ]
}
```

> Transcribe が S3 上の音声を読む際、同一アカウントではデフォルトで動作することが多いです。STT が `AccessDenied` になる場合は、Transcribe サービスプリンシパル向けのバケットポリシー追加を検討してください。

---

## 禁止事項

| 禁止 | 理由 |
|------|------|
| タスク定義の環境変数に `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` を設定 | 長期キーの漏洩リスク。Fargate はタスクロールから一時クレデンシャルが自動供給される |
| HULFT Square に AWS IAM キーを配布 | 内部 API キー（`syodan/internal-api-key`）のみ配布する |

---

## トラブルシューティング（Q&A 集）

| 症状 | 原因 | 対処 |
|------|------|------|
| Bedrock `AccessDeniedException` | タスクロールに Bedrock 権限なし、またはモデル未承認 | D-1 ポリシー確認 → Phase E（モデルアクセス / Anthropic FTU） |
| Transcribe ジョブ `FAILED` | S3 へのアップロード失敗 or 権限不足 | CloudWatch Logs でエラー確認、`s3:PutObject` 確認 |
| Polly `AccessDeniedException` | タスクロールに Polly 権限なし | D-3 でポリシーアタッチ確認 |
| S3 `AccessDenied` | バケット名不一致 or ポリシー未設定 | `S3_BUCKET_NAME` 環境変数とポリシー ARN の一致確認 |
| ロール変更が反映されない | 古いタスク定義リビジョンで稼働中 | 強制新規デプロイ |
| インラインポリシー追加不可 | ウィザード途中 or 権限不足 | ロール作成後に追加、またはカスタマー管理ポリシー（D-1）を使用 |
| Secrets が注入されない | **実行ロール** の権限不足 | `ecsTaskExecutionRole` に `SyodanEcsSecretsRead` があるか確認（Phase C） |

### CloudWatch Logs での確認方法

1. [CloudWatch ログ管理](https://console.aws.amazon.com/cloudwatch/home?region=ap-northeast-1#logsV2:log-groups) → `/ecs/syodan`
2. 最新のログストリームを開く
3. `AccessDenied` や `not authorized to perform` を検索

エラーメッセージの `arn:aws:iam::...:role/...` がどのロールかを確認し、タスクロールか実行ロールかを切り分けます（[ECS 権限のトラブルシューティング](https://repost.aws/knowledge-center/ecs-troubleshoot-permissions)）。

---

## 完了チェックリスト

### Phase D

- [ ] `SyodanEcsTaskPolicy` が IAM に存在する
- [ ] `syodan-ecs-task-role` に `SyodanEcsTaskPolicy` がアタッチ済み
- [ ] タスク定義 `syodan-backend` のタスクロールが `syodan-ecs-task-role`
- [ ] タスク定義に `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` がない
- [ ] （任意）S3 バケットポリシーでタスクロール ARN を明示許可

### Phase C との連携確認（Phase D 完了後）

- [ ] `ecsTaskExecutionRole` に `AmazonECSTaskExecutionRolePolicy` + `SyodanEcsSecretsRead`
- [ ] CloudWatch ロググループ `/ecs/syodan` が存在する
- [ ] VPC Interface エンドポイント（bedrock-runtime, transcribe, polly, s3, secretsmanager, logs）が設定済み（推奨）

---

## 次のステップ

Phase D 完了後:

1. **Phase E**: Bedrock モデルアクセス（Anthropic 初回利用フォーム等）— [`aws-setup-detailE.md`](./aws-setup-detailE.md)
2. **Phase F**: Docker イメージ push → ECS 強制新規デプロイ → フロント `.env` 設定

---

## 参考リンク

- [Amazon ECS タスク IAM ロール](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task-iam-roles.html)
- [Amazon ECS タスク実行 IAM ロール](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_execution_IAM_role.html)
- [ECS タスク定義パラメータ（taskRoleArn）](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html)
- [Bedrock 推論の前提条件（IAM）](https://docs.aws.amazon.com/bedrock/latest/userguide/inference-prereq.html)
- [Bedrock 推論プロファイルの前提条件](https://docs.aws.amazon.com/bedrock/latest/userguide/inference-profiles-prereq.html)
- [Bedrock モデルアクセスの簡素化（2025 年以降）](https://aws.amazon.com/blogs/security/simplified-amazon-bedrock-model-access/)
- [ECS 権限問題のトラブルシューティング](https://repost.aws/knowledge-center/ecs-troubleshoot-permissions)

---

簡易版は [`aws-setup.md`](./aws-setup.md) を参照。Phase A〜C は [`aws-setup-detailABC.md`](./aws-setup-detailABC.md) を参照。
