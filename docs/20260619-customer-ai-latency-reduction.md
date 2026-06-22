# 顧客AI応答レイテンシ削減

## 背景 / なぜ必要か
商談ロールプレイの顧客AI応答が遅く、営業担当が発話を終えてから音声が返るまでの体感遅延が大きかった。Bedrockモデル(`jp.anthropic.claude-sonnet-4-6`)は変更不可の制約のまま、パイプラインとインフラで短縮する。

## ボトルネック
`backend/app/services/audio_pipeline.py` の `stream_ai_audio` で、

1. Polly(TTS)合成がBedrockストリーミング消費と同一スレッドで直列実行されており、合成中はLLMのトークン生成が停止していた（最大要因）。
2. 最初の文も句点(`。`)到達まで待つため、初回音声までの体感遅延が大きかった。
3. ECSタスクが 0.5 vCPU(cpu=512) で、ffmpegトランスコード等のCPU処理とイベントループ/スレッドが競合していた。

## 変更内容

### コード (`audio_pipeline.py`)
- Polly合成を専用ワーカースレッド + キュー(`queue.Queue`)に分離。Bedrockのトークン生成と音声合成を並列化し、順序は単一コンシューマで保証。
- 初回チャンクのみ読点(`、`/`，`/`,`)でも区切り、最小文字数を `12 → 6` に緩和(`_FIRST_BOUNDARY` / `_FIRST_MIN_CHARS`)。2文目以降は従来通り文末区切り。
- 検証: 全文の欠落なし・出力順序保持を確認(`JOINED==FULL: True`)、pytest 15件パス。

### インフラ (ECS タスク定義 rev5)
- cpu `512 → 1024`、memory `1024 → 2048` に増強。
- 環境変数・シークレット・BedrockモデルID・ポート構成は rev4 から変更なし。

## デプロイ手順（実施済み）
1. `docker build --platform linux/amd64` でイメージ再ビルド。
2. ECR(`542000445970.dkr.ecr.ap-northeast-1.amazonaws.com/syodan-backend:latest`)へプッシュ。
   - 補足: Docker Desktopの資格情報ヘルパー(`credsStore: desktop`)が `The stub received bad data` で機能せず、一時的な docker config(`DOCKER_CONFIG`)にECRトークンを格納して回避。完了後に元設定へ復元、一時ファイルは削除。
3. 新タスク定義 `syodan-backend:5` を登録(`scripts/task-def-register.json`)。
4. `aws ecs update-service --task-definition syodan-backend:5 --force-new-deployment`。

## 稼働確認
- ローリングデプロイ完了(rolloutState=COMPLETED, running 1/1)。
- ALBターゲット healthy、`GET /health` が 200 `{"status":"ok"}`(応答 ~0.08s)。
- 新タスク起動ログにエラーなし、`alembic upgrade head` 正常。

## 今後の追加余地（未実施）
- STTを録音中のインクリメンタルストリーミング化（初回テキスト確定までを短縮）。フロント側プロトコル変更を伴うため別対応。
