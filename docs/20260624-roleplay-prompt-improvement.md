# ロープレプロンプト全面改善（2026-06-24）

## 概要

B2B商談ロープレのLLMプロンプトを3種（ペルソナ生成・会話・分析）に分離・強化し、会話履歴注入とペルソナ拡張データで本格的な連続商談を再現できるようにした。

## 変更ファイル一覧

| ファイル | 内容 |
|---------|------|
| `backend/app/services/prompts.py` | 新規。3種プロンプト定数とヘルパー |
| `backend/app/services/audio_pipeline.py` | 新プロンプト組立・messages 対応 |
| `backend/app/services/program_service.py` | persona_extras 保存 |
| `backend/app/services/session_finalize.py` | 分析プロンプト強化 |
| `backend/app/integrations/aws_clients.py` | messages 引数・stub 更新 |
| `backend/app/websocket/hearing.py` | 会話履歴注入 |
| `backend/app/api/routes/sessions.py` | `get_conversation_log` |
| `backend/app/domain/models.py` | `persona_extras` 列 |
| `backend/alembic/versions/006_customer_persona_extras.py` | マイグレーション |
| `backend/tests/test_prompts.py` | ユニットテスト |

## 3種プロンプトの役割

### PROFILE_SYSTEM（プログラム作成時）

- 見込み顧客ペルソナを JSON で生成
- 追加キー: `hidden_motivations`, `typical_objections`, `background_facts`, `communication_style`
- `persona_extras` JSON 列に保存（API では非公開）

### CHAT_SYSTEM_TEMPLATE（ヒアリング中）

- 正データ + 心理状態 + 開示済み情報 + 前回サマリ + 時間圧を構造化注入
- `true_challenge` は「内部参照・絶対開示禁止」セクションに分離
- `awareness_level` / `rapport_level` を数値→振る舞い文に変換

### ANALYSIS_SYSTEM（セッション終了時）

- 会話を分析し `awareness_level`, `rapport_level`, `disclosed_info`, `session_summary`, `title` を更新
- 判定時に `true_challenge` と前回状態を参照

## 会話履歴注入フロー

```
PTT終了
  → get_conversation_log()（今ターンの user 追記前）
  → user 発話を log に追記
  → to_bedrock_messages(history[-20:])
  → 末尾に今回 user メッセージを追加
  → Bedrock invoke_stream(system, messages=[...])
```

## マイグレーション

```bash
cd backend
alembic upgrade head
```

追加列: `customer_profiles.persona_extras` (JSON, nullable)

既存レコードは `NULL` のまま動作する（プロンプト側でデフォルト値にフォールバック）。

## ローカル確認

```bash
cd backend
.venv/bin/python -m pytest tests/test_prompts.py tests/test_program_flow.py -q
```

`AWS_STUB_MODE=true`（テスト conftest 既定）で Bedrock スタブが新ペルソナ JSON を返す。

## 例: 改善前後のプロンプト差

**改善前:** `profile_json` に `true_challenge` が平文で含まれ、会話履歴なし

**改善後:** 内部参照セクションで開示ルールを明示、前回サマリ・開示済み情報・直近20ターンの messages を LLM に渡す
