# 会話レイテンシ改善（2026-06-23）

## 意図

商談ロールプレイの体感遅延を短縮し、PTT離し後すぐに顧客AIが応答し始めるようにする。PTTボタンは「発話終了の合図」に徹し、音声は話している間にサーバーへ送ってSTTを先行開始する。

## 変更概要

### フロントエンド
- `usePushToTalk`: MediaRecorder一括送信から AudioContext + 16kHz PCM ストリーミング（~256msチャンク）へ変更
- `useHearingWebSocket`: `ptt_start` に `pcm_s16le` を付与、`transcript_partial` 受信、Web Audio API によるギャップレス再生
- `TranscriptDrawer`: 途中認識テキストを薄く表示

### バックエンド
- `TranscribeStreamSession`: PTT中にPCMチャンクを逐次投入するSTTセッション
- `hearing.py`: PCMパスで `ptt_start` 時にSTT開始、`ptt_end` で finish → 即LLM。webm/mp3バッチパスは後方互換維持
- プロンプト用 profile/state/program をWS接続時にキャッシュ（毎ターンDB再読込を廃止）
- `emit_audio`: `.result()` ブロックを廃止し `asyncio.Queue` で非同期送信
- `audio_pipeline`: 初回TTS最小文字数 6 → 4
- Polly: `POLLY_SPEECH_RATE`（デフォルト `110%`）で SSML prosody 対応

## レイテンシの見込み（理論値）

| 段階 | 改善前 | 改善後 |
|------|--------|--------|
| STT開始 | ptt_end 後 | 発話開始直後 |
| STT完了 | ptt_end + 0.5〜1.5s | ptt_end 時点でほぼ完了 |
| 初回MP3 | ptt_end + 2〜4s | ptt_end + 0.5〜1.5s |

3秒発話の例: STT待ちが発話時間分（~3秒）短縮される。

## 検証

```bash
cd backend && pytest
python scripts/test_hearing_ws.py  # PCM + レガシーバッチの2ターン
```

手動計測: ブラウザ開発者ツールの Network → WS で `ptt_end` 送信から最初のバイナリ（MP3）受信までの時間を比較。

## 未対応（スコープ外）

- バージイン（AI話し中の割り込み）
- WebRTC（サーバーSTT/LLM/TTS構成では効果が薄い）
- Bedrockへの会話履歴渡し
