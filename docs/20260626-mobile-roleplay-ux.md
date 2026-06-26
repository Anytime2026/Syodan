# スマホ向けロールプレイUX改善（2026-06-26）

## 意図

スマホでPTT押下時にマイク許可ダイアログとポインターイベントが競合して「話しています…」でスタックする問題、およびAI音声再生後に `aiSpeaking` が解除されず次の発話ができない問題を解消する。

## 変更内容

### マイク許可の事前取得
- `useMicrophonePermission` / `requestMicrophoneAccess`: 許可取得と sessionStorage への記録
- `PreSessionPage`: セッション開始ボタン押下時にマイク許可を要求
- `MicPermissionGate`: 直接URLアクセス時のフォールバックオーバーレイ

### PTTレース条件の解消
- `usePushToTalk`: `pressedRef` による離指検知、マイクストリーム保持、戻り値 `boolean`
- `RoleplayMeetingPage`: マイク準備後に `ptt_start` 送信、`pttActiveRef` で `ptt_end` の空送信防止
- `ControlBar`: pointer capture / cancel、AI話し中の disabled とラベル

### AI音声再生の堅牢化
- `primeAudioPlayback`: PTT押下時に AudioContext をアンロック
- `HTMLAudioElement` フォールバック（suspended 時）
- `turn_complete` 受信時のフォールバックタイマーで `aiSpeaking` 強制解除

### スマホUI
- PTTボタン全幅・56px以上、safe-area 対応、タッチ端末では「押して話す」表記

## 検証

```bash
cd frontend && npm run build
```

実機確認（iOS Safari / Android Chrome）:
1. PreSession から開始 → ロールプレイで許可ダイアログが出ないこと
2. AI応答後に顧客タイルの話し中表示が消えること
3. デスクトップで Space キー PTT が動作すること

## 追記（2026-06-26）モバイルレイアウト

字幕とPTTの重なりを解消:
- `meeting-stage` でコンテンツ領域とコントロールバーを分離（重なりなし）
- モバイルでは字幕をフロー内配置（absolute廃止）、初期状態は閉じる
- PTTを画面最下部・親指ゾーンに固定（60px、safe-area対応）
- 参加者タイルは2列コンパクト表示で縦スペースを確保
- [Apple HIG](https://developer.apple.com/design/human-interface-guidelines) に沿いタップ領域44pt以上・主要操作の視覚的階層を明確化
