# AWS Bedrock / ロープレAI 正常化（2026-06-19）

## 症状

- ユーザー発話に対し、固定テンプレート文（スタブ応答）のみ返る
- CloudWatch Logs に `AccessDeniedException`（`ap-northeast-3` の foundation-model）

## 根本原因

1. **IAM `SyodanEcsTaskPolicy` v1** が `ap-northeast-1` のみ許可していた  
   - `jp.anthropic.claude-sonnet-4-6` は東京・大阪へルーティングする推論プロファイルのため、呼び出し時に `ap-northeast-3` 側 foundation-model への権限が必要
2. **ECS 上の Docker イメージが古い**（エラーハンドリング・`media_format` 未対応など）
3. ローカル `.env` は `AWS_STUB_MODE=true` のまま（ローカル単体開発用。AWS バックエンドとは別）

## 実施した修正

### IAM（v3）

`backend/scripts/syodan-ecs-task-policy.json` を適用:

- `arn:aws:bedrock:ap-northeast-3::foundation-model/anthropic.claude-*`
- `arn:aws:bedrock:ap-northeast-3:542000445970:inference-profile/jp.anthropic.claude-sonnet-4-6`

```bash
aws iam create-policy-version \
  --policy-arn arn:aws:iam::542000445970:policy/SyodanEcsTaskPolicy \
  --policy-document file://backend/scripts/syodan-ecs-task-policy.json \
  --set-as-default
```

### モデル ID

| 用途 | 環境変数 | 値 |
|------|----------|-----|
| 会話応答 | `BEDROCK_CHAT_MODEL_ID` | `jp.anthropic.claude-sonnet-4-6` |
| プロファイル生成・分析 | `BEDROCK_ANALYSIS_MODEL_ID` | `jp.anthropic.claude-sonnet-4-6` |

ECS タスク定義（rev 4）で `AWS_STUB_MODE=false` を確認済み。

### コード

- `program_service.py`: LLM プロファイル JSON のパース堅牢化（リトライ・コードブロック除去）
- `hearing.py`: `ptt_end` で `media_format` を指定可能（テスト・将来拡張用）
- `aws_clients.py`: Bedrock / Transcribe / Polly のエラーログ

### デプロイ

```bash
cd backend
docker build -t syodan-backend .
# ECR push 後
aws ecs update-service --cluster syodan --service syodan-backend \
  --region ap-northeast-1 --force-new-deployment
```

## 検証結果

```bash
# API スモーク
API_BASE_URL=http://syodan-alb-520683133.ap-northeast-1.elb.amazonaws.com \
  python scripts/smoke_test.py

# STT → Bedrock → Polly 一連（Polly 生成 mp3 を WebSocket 送信）
API_BASE_URL=http://syodan-alb-... WS_BASE_URL=ws://syodan-alb-... \
  python scripts/test_hearing_ws.py
```

- プログラム作成: LLM 生成プロファイル（スタブの「中堅（300名）」ではない）
- WebSocket 1ターン: Transcribe「こんにちは、テストです。」→ Bedrock 応答 → Polly 音声バイト受信

## ローカル開発時の注意

`backend/.env` で `AWS_STUB_MODE=true` の場合、ローカルバックエンドは引き続きスタブ応答。  
AWS 上のロープレを試すときは `frontend/.env` の ALB URL を使い、フロントから ECS バックエンドへ接続すること。

## 参考ログ（修正前）

```
AccessDeniedException: ... bedrock:InvokeModel on resource:
arn:aws:bedrock:ap-northeast-3::foundation-model/anthropic.claude-sonnet-4-6
```
