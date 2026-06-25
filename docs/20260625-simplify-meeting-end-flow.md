# 商談終了フローの簡素化および総合評価への遷移追加

## 変更内容
1. 商談終了ボタン押下後、あるいは制限時間によるセッション終了後に、自動的に「評価詳細」画面へ遷移するように修正しました。
   中間画面のボタンや余計なリンクを完全に排除し、処理中は「評価詳細画面へ移動しています。しばらくお待ちください…」というメッセージのみを表示し、そのまま自動遷移するようにしました。
2. 評価詳細画面において、全セッションが完了しており総合評価（シリーズ総評）が表示可能である場合、画面下部のアクションエリアに「総合評価へ」ボタン（青色のプライマリボタン）を表示するようにしました。

## 対象ファイル
* [RoleplayMeetingPage.tsx](file:///c:/Users/nonno_ishii/Anytime/Syodan/frontend/src/pages/RoleplayMeetingPage.tsx)
* [EvaluationDetailPage.tsx](file:///c:/Users/nonno_ishii/Anytime/Syodan/frontend/src/pages/EvaluationDetailPage.tsx)

## 修正詳細
### RoleplayMeetingPage.tsx
1. **`handleSessionEnded`（セッションタイムアウト時）**:
   - タイムアウト処理完了後に `navigate` を用いて `/evaluations/${sessionId}` へ自動遷移するように変更。
   - 依存配列に `navigate` を追加。
2. **`handleEnd`（商談終了ボタン押下時）**:
   - 終了処理完了後に `/evaluations/${sessionId}` へ自動遷移するように変更。
3. **`ended` 時のUI表示**:
   - 複数のリンクや「評価を見る」ボタンを完全に廃止。
   - メッセージを「評価詳細画面へ移動しています。しばらくお待ちください…」のみに変更。

### EvaluationDetailPage.tsx
1. **総合評価（シリーズ総評）の表示判定の追加**:
   - プログラムの進捗 (`allSessionsDone`) および総合評価表示可能フラグ (`showOverallReview`) の判定ロジックを追加。
2. **アクションボタンエリアの条件分岐**:
   - 総合評価表示可能である場合、「一覧に戻る」「ホームに戻る（サブボタン）」「総合評価へ（メインボタン）」の3つのボタンを表示。
   - それ以外の場合は従来通り「一覧に戻る」「ホームに戻る（メインボタン）」を表示。
