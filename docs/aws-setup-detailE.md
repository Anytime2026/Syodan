# AWS セットアップ詳細手順（Phase E）

`aws-setup.md` の Phase E（Bedrock）を初学者向けに画面単位で説明します。  
リージョンはすべて **ap-northeast-1（東京）** に統一してください。

Phase A〜D の手順は [`aws-setup-detailABC.md`](./aws-setup-detailABC.md) / [`aws-setup-detailD.md`](./aws-setup-detailD.md) を参照。

## 目次

- [Phase E でやること](#phase-e-でやること)
- [重要: 「モデルアクセス」画面は廃止済み](#重要-モデルアクセス画面は廃止済み)
- [どこに何を設定するか](#どこに何を設定するか)
- [Phase D との関係](#phase-d-との関係)
- [E-0. 前提確認](#e-0-前提確認)
- [E-1. Anthropic 初回利用フォーム（FTU）](#e-1-anthropic-初回利用フォームftu)
- [E-2. モデル ID の選定（Syodan 推奨: Sonnet 4.6）](#e-2-モデル-id-の選定syodan-推奨-sonnet-46)
- [E-3. Playground で動作確認](#e-3-playground-で動作確認)
- [E-4. ECS タスク定義に環境変数を設定](#e-4-ecs-タスク定義に環境変数を設定)
- [E-5. 本番動作確認](#e-5-本番動作確認)
- [（任意）CLI でモデルアクセスを確認](#任意cli-でモデルアクセスを確認)
- [代替モデル構成（参考）](#代替モデル構成参考)
- [トラブルシューティング（Q&A 集）](#トラブルシューティングqa-集)
- [完了チェックリスト](#完了チェックリスト)
- [参考リンク](#参考リンク)

---

## Phase E でやること

| 順番 | 作業 | 内容 |
|------|------|------|
| E-1 | Anthropic FTU フォーム | アカウント単位で 1 回（ユースケース申告） |
| E-2 | モデル ID 選定 | `jp.anthropic.claude-sonnet-4-6` をベースに決める |
| E-3 | Playground 確認 | マネコンから推論が通るか試す |
| E-4 | タスク定義更新 | `BEDROCK_CHAT_MODEL_ID` / `BEDROCK_ANALYSIS_MODEL_ID` を設定 |
| E-5 | 本番確認 | ECS からロープレが動くか確認 |

**Phase E の目的:** ECS 上のアプリが Bedrock（Claude）を呼び出し、ロープレの AI 応答・分析が動く状態にする。

---

## 重要: 「モデルアクセス」画面は廃止済み

`aws-setup.md` 旧手順の「Bedrock コンソール → **モデルアクセス** → Claude 系を有効化」は **2025 年 9 月以降、商業リージョンでは不要・画面自体が廃止** されています。

| 時期 | 手順 |
|------|------|
| 旧（〜2025/08） | モデルアクセス画面でモデルごとに手動有効化 |
| **現行（2025/09〜）** | サーバーレス基盤モデルは **デフォルトで利用可能**。IAM / SCP で制限する方式に変更 |

出典: [Bedrock モデルアクセスの簡素化（AWS Security Blog）](https://aws.amazon.com/blogs/security/simplified-amazon-bedrock-model-access/)、[モデルアクセスのリクエスト（公式）](https://docs.aws.amazon.com/bedrock/latest/userguide/model-access.html)

**現行で残る必須作業は次の 2 点:**

1. **Anthropic モデル**: 初回利用フォーム（FTU）の提出（アカウントあたり 1 回）
2. **ECS タスク定義**: 利用するモデル ID を環境変数で指定

> Bedrock マネコンに「アプリのデフォルトモデル ID」を保存する画面は **存在しません**。本番で効く設定は ECS の環境変数だけです。

---

## どこに何を設定するか

初学者が混乱しやすいポイントを整理します。

```
┌─────────────────────────────────────────────────────────────┐
│ ① Bedrock マネコン（確認・初回のみ）                          │
│    ・Anthropic 初回利用フォーム（FTU）— 未提出なら 1 回だけ   │
│    ・プレイグラウンドで jp.anthropic.claude-sonnet-4-6 テスト  │
│    ※ ここにアプリ用 modelId を永続保存する機能はない         │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ ② IAM（Phase D）— タスクロール syodan-ecs-task-role           │
│    inference-profile への bedrock:InvokeModel 許可           │
│    詳細: aws-setup-detailD.md                                 │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ ③ ECS タスク定義 ← ★ 本番で実際に効く設定                     │
│    BEDROCK_CHAT_MODEL_ID=jp.anthropic.claude-sonnet-4-6     │
│    BEDROCK_ANALYSIS_MODEL_ID=jp.anthropic.claude-sonnet-4-6  │
│    AWS_REGION=ap-northeast-1                                  │
│    AWS_STUB_MODE=false                                        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ ④ ローカル開発（任意）                                        │
│    backend/.env に同じキーを設定                              │
└─────────────────────────────────────────────────────────────┘
```

| やりたいこと | 設定場所 | 設定値（Syodan 推奨） |
|-------------|----------|----------------------|
| 使うモデルを指定（本番） | ECS タスク定義の環境変数 | `jp.anthropic.claude-sonnet-4-6` |
| 同上（ローカル） | `backend/.env` | 同上 |
| 呼び出し権限 | IAM タスクロール（Phase D） | `inference-profile` への `InvokeModel` |
| 利用可能か確認 | Bedrock プレイグラウンド | Claude Sonnet 4.6 でテスト |
| 初回のみ | Bedrock モデルカタログ | Anthropic FTU フォーム |
| リージョン固定 | ECS 環境変数 | `AWS_REGION=ap-northeast-1` |

---

## Phase D との関係

| レイヤー | Phase | 内容 |
|----------|-------|------|
| IAM 権限 | D | `syodan-ecs-task-role` に `bedrock:InvokeModel` 等 |
| モデル利用同意・ID 設定 | **E** | FTU フォーム + 環境変数 |

Phase D 未完了のまま Phase E を進めても、推論時に `AccessDeniedException` になります。**D → E の順**で実施してください。

### Sonnet 4.6 利用時の IAM 注意

`jp.anthropic.claude-sonnet-4-6` は **推論プロファイル（Inference Profile）ID** です。foundation-model ID とは IAM の Resource ARN が異なります。

[`aws-setup-detailD.md`](./aws-setup-detailD.md) の `SyodanEcsTaskPolicy` で `inference-profile/*` ワイルドカードを使っていれば **追加不要** なことが多いです。403 が出る場合は、以下を明示追加してください。

```json
{
  "Effect": "Allow",
  "Action": [
    "bedrock:InvokeModel",
    "bedrock:InvokeModelWithResponseStream"
  ],
  "Resource": "arn:aws:bedrock:ap-northeast-1:{account-id}:inference-profile/jp.anthropic.claude-sonnet-4-6"
}
```

---

## E-0. 前提確認

### チェックリスト

- [ ] リージョンが **ap-northeast-1**（マネコン右上）
- [ ] Phase D 完了（`syodan-ecs-task-role` + `SyodanEcsTaskPolicy`）
- [ ] VPC Interface エンドポイント `bedrock-runtime` が設定済み（推奨。NAT 経由でも可）
- [ ] AWS アカウントに **有効な支払い方法** が登録済み（Marketplace 連携モデル用）

### 会社ポリシーがある場合

組織で SCP や IAM により Bedrock がブロックされている場合、FTU を提出しても呼び出せません。インフラ担当に以下を確認してください。

- `bedrock:InvokeModel` がタスクロールで許可されているか
- 組織 SCP で `bedrock:*` が Deny されていないか
- 利用前に EULA レビューが必要か（[モデルアクセスのリクエスト](https://docs.aws.amazon.com/bedrock/latest/userguide/model-access.html) 参照）

---

## E-1. Anthropic 初回利用フォーム（FTU）

Anthropic モデルは「デフォルト有効」ですが、**初回呼び出し前にユースケース申告が必須**です（アカウントまたは Organization 管理アカウントで 1 回）。

出典: [モデルアクセスのリクエスト — Anthropic models](https://docs.aws.amazon.com/bedrock/latest/userguide/model-access.html)

### マネコン手順

1. [Amazon Bedrock コンソール](https://ap-northeast-1.console.aws.amazon.com/bedrock/home?region=ap-northeast-1) を **ap-northeast-1** で開く
2. 左メニュー **モデルカタログ（Model catalog）** を選択
3. プロバイダー **Anthropic** でフィルタ
4. 利用予定モデルを選択（推奨: **Claude Sonnet 4.6**）
5. **プレイグラウンドで開く（Open in playground）** またはモデル詳細から操作
6. 初回の場合 **ユースケース詳細の送信（Submit use case details）** フォームが表示される
7. フォームを入力して **送信（Submit）**

> 既に普段から `jp.anthropic.claude-sonnet-4-6` を利用できている場合、FTU は **提出済み** の可能性が高いです。この場合 E-1 はスキップして E-3 へ進んでください。

### フォーム入力例（Syodan 向け）

| 項目 | 入力例 |
|------|--------|
| 会社名 | 貴社名 |
| Web サイト | 会社サイト、または個人の場合は GitHub / ポートフォリオ URL |
| 利用者 | External（社外ユーザー向け）または Internal |
| 業種 | 該当する業種を選択 |
| ユースケース | 「営業ヒアリングのロールプレイ練習用 AI。音声入力を文字起こしし、仮想顧客として Claude が応答。セッション終了後に会話を分析する。」 |

> 個人開発者で会社サイトがない場合、GitHub プロフィールやプロジェクト URL で可（[公式ドキュメント](https://docs.aws.amazon.com/bedrock/latest/userguide/model-access.html)）。

### 承認タイミング

送信成功後、**通常は即時に利用可能**になります。Organization の管理アカウントで API（`PutUseCaseForModelAccess`）から提出した場合、子アカウントにも継承されます。

### AWS Organizations 利用時

管理アカウントから 1 回 API で提出すれば子アカウントに継承可能。マネコンから各アカウントで個別提出も可。詳細は [モデルアクセスの SDK/CLI 管理 — Step 2](https://docs.aws.amazon.com/bedrock/latest/userguide/model-access.html)。

---

## E-2. モデル ID の選定（Syodan 推奨: Sonnet 4.6）

このプロジェクトのバックエンドは `invoke_model` の `modelId` に環境変数の値をそのまま渡します（`backend/app/integrations/aws_clients.py`）。**コード変更は不要**で、環境変数の差し替えだけでモデルを切り替えられます。

### Syodan 推奨: `jp.anthropic.claude-sonnet-4-6`

| 項目 | 内容 |
|------|------|
| modelId | `jp.anthropic.claude-sonnet-4-6` |
| 種別 | **推論プロファイル ID**（foundation-model ID ではない） |
| ベースモデル | Claude Sonnet 4.6 |
| ルーティング先 | **日本国内のみ** — 東京（`ap-northeast-1`）と大阪（`ap-northeast-3`） |
| プレフィックス `jp.` | 日本向け Geo 推論プロファイル（[推論プロファイルのサポート](https://docs.aws.amazon.com/bedrock/latest/userguide/inference-profiles-support.html)） |

Claude Code 等で普段 `jp.anthropic.claude-sonnet-4-6` を使っている場合、Syodan でも **同じ ID** を指定するだけです。

### 環境変数への割り当て（推奨）

| 用途 | 環境変数 | 推奨 modelId | コード上の呼び出し |
|------|----------|--------------|-------------------|
| ロープレ中の顧客 AI 応答 | `BEDROCK_CHAT_MODEL_ID` | `jp.anthropic.claude-sonnet-4-6` | `audio_pipeline.py` |
| 顧客プロファイル生成・セッション分析 | `BEDROCK_ANALYSIS_MODEL_ID` | `jp.anthropic.claude-sonnet-4-6` | `program_service.py`, `session_finalize.py` |

**両方とも同じ Sonnet 4.6 で問題ありません。** 品質を統一したい場合の推奨構成です。

> 音声ロープレは発話のたびに Bedrock を呼ぶため、Haiku より **応答遅延・コストは高く** なります。速度・コスト優先でチャットだけ軽量モデルに分けたい場合は [代替モデル構成](#代替モデル構成参考) を参照してください。

### foundation-model ID との違い

| 指定方法 | 例 | Syodan での利用 |
|----------|-----|----------------|
| foundation-model ID | `anthropic.claude-sonnet-4-6` | Sonnet 4.6 では **直接指定不可** のことが多い |
| 推論プロファイル ID | `jp.anthropic.claude-sonnet-4-6` | **こちらを使う** |
| 他リージョン向け | `us.anthropic.claude-sonnet-4-6`, `global.anthropic.claude-sonnet-4-6` | 日本データレジデンシー要件がある場合は **使わない** |

### モデル一覧の確認方法

マネコン **モデルカタログ** → **Claude Sonnet 4.6** の詳細ページで **Inference profile IDs** を確認するか、CLI:

```powershell
aws bedrock list-inference-profiles --region ap-northeast-1 `
  --query "inferenceProfileSummaries[?contains(inferenceProfileId,'claude-sonnet-4-6')].{id:inferenceProfileId,name:inferenceProfileName}" `
  --output table
```

最新の一覧は [Bedrock モデル一覧（Models at a glance）](https://docs.aws.amazon.com/bedrock/latest/userguide/models-supported.html) を参照。

---

## E-3. Playground で動作確認

FTU 提出済み（または提出後）、マネコンから推論を試します。

### 手順

1. **Bedrock コンソール → プレイグラウンド（Playground）**（またはモデルカタログから「プレイグラウンドで開く」）
2. モデル: **Claude Sonnet 4.6** を選択（ID が `jp.anthropic.claude-sonnet-4-6` であることを確認）
3. プロンプト例: `こんにちは。営業ロープレのテストです。仮想顧客として応答してください。`
4. **実行（Run）** → 応答が返れば OK

Playground が通れば、アカウント側の FTU・モデル利用は問題ありません。通らない場合は E-1 を再確認するか、[トラブルシューティング](#トラブルシューティングqa-集) を参照。

### 初回呼び出しと Marketplace 権限

3rd パーティモデルの **アカウント初回呼び出し** 時、バックグラウンドで Marketplace サブスクリプションが走ります。ECS タスクロールに Marketplace 権限がない場合、**管理者が Playground で先に 1 回実行**しておくと、以降はタスクロールの `bedrock:InvokeModel` だけで動くことが多いです。

出典: [モデルアクセスのリクエスト](https://docs.aws.amazon.com/bedrock/latest/userguide/model-access.html)、[Marketplace 権限エラーの解決](https://repost.aws/knowledge-center/bedrock-resolve-marketplace-permission)

---

## E-4. ECS タスク定義に環境変数を設定

**本番でモデルを切り替える唯一の設定箇所** です。

### 手順

1. **ECS → タスク定義 → `syodan-backend` → 新しいリビジョンを作成**
2. コンテナ `syodan-backend` の **環境変数** に追加（または既存値を更新）:

| キー | 値（Syodan 推奨） |
|------|-------------------|
| `BEDROCK_CHAT_MODEL_ID` | `jp.anthropic.claude-sonnet-4-6` |
| `BEDROCK_ANALYSIS_MODEL_ID` | `jp.anthropic.claude-sonnet-4-6` |
| `AWS_REGION` | `ap-northeast-1` |
| `AWS_STUB_MODE` | `false` |

3. **作成** で新リビジョンを保存
4. **ECS → クラスタ `syodan` → サービス `syodan-backend` → 更新**
   - タスク定義: 最新リビジョン
   - **強制新規デプロイ** にチェック → **更新**

### ローカル開発（`backend/.env`）

```env
AWS_REGION=ap-northeast-1
AWS_STUB_MODE=false
BEDROCK_CHAT_MODEL_ID=jp.anthropic.claude-sonnet-4-6
BEDROCK_ANALYSIS_MODEL_ID=jp.anthropic.claude-sonnet-4-6
```

`AWS_STUB_MODE=true` のままだと Bedrock は呼ばれずスタブ応答を返します。

### コード上の使われ方

| 環境変数 | 呼び出し箇所 | タイミング |
|----------|-------------|-----------|
| `BEDROCK_CHAT_MODEL_ID` | `audio_pipeline.py` | ロープレ中の顧客 AI 応答 |
| `BEDROCK_ANALYSIS_MODEL_ID` | `program_service.py`, `session_finalize.py` | 顧客プロファイル生成・セッション分析 |

`BedrockClient.invoke()` は `modelId` をそのまま `bedrock-runtime` の `invoke_model` に渡します。推論プロファイル ID も同じ API で指定できます。

---

## E-5. 本番動作確認

Phase F（Docker push）後、または既にイメージが ECR にある状態で:

1. フロント `frontend/.env` で ALB の URL を設定
2. `http://localhost:5173/roleplay/setup` からロープレ開始
3. プッシュトークで話す → AI が音声応答すれば **Bedrock（Sonnet 4.6）+ Polly + Transcribe** が動作
4. セッション終了 → 分析結果が表示されれば **分析（Sonnet 4.6）** も動作

### CloudWatch で Bedrock エラーを確認

1. [CloudWatch `/ecs/syodan`](https://console.aws.amazon.com/cloudwatch/home?region=ap-northeast-1#logsV2:log-groups/log-group/$252Fecs$252Fsyodan)
2. `AccessDeniedException`, `ValidationException`, `model` で検索

---

## （任意）CLI でモデルアクセスを確認

AWS CLI 2.27.42 以降（[公式前提条件](https://docs.aws.amazon.com/bedrock/latest/userguide/model-access.html)）:

```powershell
# Sonnet 4.6 foundation-model の利用可否
aws bedrock get-foundation-model-availability `
  --model-id anthropic.claude-sonnet-4-6 `
  --region ap-northeast-1

# 推論プロファイルの存在確認
aws bedrock get-inference-profile `
  --inference-profile-identifier jp.anthropic.claude-sonnet-4-6 `
  --region ap-northeast-1
```

`agreementAvailability.status` が `AVAILABLE` ならアカウントで利用可能です。

### Playground と同等の API テスト（任意）

```powershell
# Python 例（ローカルから ap-northeast-1 へ）
# modelId に jp.anthropic.claude-sonnet-4-6 を指定
```

```python
import boto3, json

client = boto3.client("bedrock-runtime", region_name="ap-northeast-1")
response = client.invoke_model(
    modelId="jp.anthropic.claude-sonnet-4-6",
    contentType="application/json",
    accept="application/json",
    body=json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 256,
        "messages": [{"role": "user", "content": "営業ロープレのテストです。"}],
    }),
)
print(json.loads(response["body"].read())["content"][0]["text"])
```

---

## 代替モデル構成（参考）

Sonnet 4.6 以外を使う場合や、チャットだけ軽量化したい場合の例です。

### 速度・コスト優先（チャットのみ Haiku）

| 用途 | 環境変数 | modelId |
|------|----------|---------|
| ロープレ中の応答 | `BEDROCK_CHAT_MODEL_ID` | `anthropic.claude-3-5-haiku-20241022-v1:0` |
| 分析 | `BEDROCK_ANALYSIS_MODEL_ID` | `jp.anthropic.claude-sonnet-4-6` |

Haiku は ap-northeast-1 で ON_DEMAND。foundation-model ID をそのまま指定できます。

### 旧デフォルト（リポジトリ初期値）

| 用途 | modelId |
|------|---------|
| チャット | `anthropic.claude-3-5-haiku-20241022-v1:0` |
| 分析 | `anthropic.claude-3-5-sonnet-20241022-v2:0`（INFERENCE_PROFILE 型。失敗時は `apac.anthropic.claude-3-5-sonnet-20241022-v2:0`） |

---

## トラブルシューティング（Q&A 集）

| 症状 | 原因 | 対処 |
|------|------|------|
| `AccessDeniedException`（Bedrock） | IAM 不足 or FTU 未提出 | Phase D ポリシー確認 → E-1 FTU 提出 |
| `You don't have access to the model with the specified model ID` | FTU 未提出 or modelId 誤り | `jp.anthropic.claude-sonnet-4-6` を確認（`anthropic.claude-sonnet-4-6` ではない） |
| inference-profile 関連の 403 | IAM に profile ARN なし | Phase D で `inference-profile/jp.anthropic.claude-sonnet-4-6` を追加 |
| 初回のみ 403、数分後に成功 | Marketplace サブスクリプション処理中 | 最大 15 分待つ（[公式](https://docs.aws.amazon.com/bedrock/latest/userguide/model-access.html)） |
| マネコンに「モデルアクセス」がない | 2025/09 以降の仕様変更 | **正常**。モデルカタログ + FTU を使用 |
| Playground は OK、ECS だけ NG | タスクロール or 環境変数 | D-4 確認、`AWS_STUB_MODE=false`、強制新規デプロイ |
| 応答がスタブのまま | `AWS_STUB_MODE=true` | タスク定義で `false` に変更 |
| 応答が遅い | Sonnet 4.6 は Haiku より重い | チャットだけ Haiku に分離（[代替構成](#代替モデル構成参考)） |
| 会社承認が必要 | 組織ポリシー | SCP / 情シスに `bedrock:InvokeModel` と inference-profile の許可を依頼 |

---

## 完了チェックリスト

### Phase E

- [ ] Anthropic FTU フォームを提出済み（または既存利用で提出済みを確認）
- [ ] Playground で **Claude Sonnet 4.6**（`jp.anthropic.claude-sonnet-4-6`）の推論が成功
- [ ] タスク定義に `BEDROCK_CHAT_MODEL_ID=jp.anthropic.claude-sonnet-4-6`
- [ ] タスク定義に `BEDROCK_ANALYSIS_MODEL_ID=jp.anthropic.claude-sonnet-4-6`
- [ ] `AWS_REGION=ap-northeast-1`、`AWS_STUB_MODE=false`
- [ ] ECS サービスを強制新規デプロイ済み
- [ ] ロープレで AI 応答が返る（スタブではない）
- [ ] セッション終了後の分析が動作する

### Phase D との連携

- [ ] `syodan-ecs-task-role` に Bedrock 権限あり（`inference-profile` 含む）
- [ ] `AWS_STUB_MODE=false`（本番）

---

## 次のステップ

Phase E 完了後は **Phase F**（Docker イメージ push → ECS デプロイ → フロント接続）— [`aws-setup.md`](./aws-setup.md)

---

## 参考リンク

- [モデルアクセスのリクエスト（現行公式）](https://docs.aws.amazon.com/bedrock/latest/userguide/model-access.html)
- [Bedrock モデルアクセスの簡素化（2025 年変更）](https://aws.amazon.com/blogs/security/simplified-amazon-bedrock-model-access/)
- [推論プロファイルのサポートリージョンとモデル](https://docs.aws.amazon.com/bedrock/latest/userguide/inference-profiles-support.html)
- [推論の前提条件（IAM）](https://docs.aws.amazon.com/bedrock/latest/userguide/inference-prereq.html)
- [推論プロファイルの前提条件](https://docs.aws.amazon.com/bedrock/latest/userguide/inference-profiles-prereq.html)
- [Bedrock モデル一覧](https://docs.aws.amazon.com/bedrock/latest/userguide/models-supported.html)
- [Marketplace 権限エラーの解決](https://repost.aws/knowledge-center/bedrock-resolve-marketplace-permission)

---

簡易版は [`aws-setup.md`](./aws-setup.md) を参照。Phase D は [`aws-setup-detailD.md`](./aws-setup-detailD.md) を参照。
