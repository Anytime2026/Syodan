# 商談添付ファイル機能追加計画

## 意図（なぜ必要か）
AI顧客とのロールプレイにおいて、事前に自社の営業資料や製品概要などをインプットできるようにすることで、AI顧客がその前提情報に基づいた現実的な営業シミュレーションを行えるようにするため。

## 選択理由と設計決定
1. **対応ファイル形式**: PDF (.pdf)、テキスト (.txt)、マークダウン (.md)
   - 理由: 営業資料として最も一般的なPDFに加え、軽量かつ扱いやすいプレーンテキスト形式を網羅するため。
2. **パースおよび保存方法**:
   - 理由: バックエンド（FastAPI）で `pypdf` を用いてテキストデータを抽出し、データベース（`Program` テーブルの `materials_text` 列）へ直接保存する。セッション開始のたびにファイルを再パースするオーバーヘッドをなくすため。
3. **セキュリティ設計 (CVSS 0~3.9への準拠)**:
   - 理由: ファイルのサイズ上限を10MBに制限し、かつ拡張子の検証をサーバー側で厳密に実施することで、悪意ある大容量ファイル送信によるリソース枯渇（DoS）を防ぐ。
   - 理由: `pypdf` によるテキスト抽出のみに限定し、実行可能コードの挿入等を防ぐ。

## 変更内容

### バックエンド (FastAPI)
1. **`app/services/program_service.py`**:
   - `to_response` メソッドにおいて、返却スキーマである `ProgramResponse` に `materials_filename` をマップする処理を追加。
2. **`app/api/routes/programs.py`**:
   - 新しいエンドポイント `POST /api/programs/{program_id}/upload-material` を作成。
   - `UploadFile` を受け取り、ファイルサイズチェック（最大10MB）と拡張子チェック（pdf, txt, md）を行う。
   - ファイル種別に応じてテキストを抽出（PDFは `pypdf`、その他は `utf-8` デコード）し、該当 `Program` の `materials_text` および `materials_filename` を更新する。
3. **`app/services/audio_pipeline.py`**:
   - `build_system_prompt` に引数 `materials_text` を追加。
   - `CHAT_SYSTEM_TEMPLATE` に参考資料を注入するセクション `{materials_section}` を追加。
4. **`app/websocket/hearing.py`**:
   - websocketのターン処理で `program.materials_text` を読み込み、`build_system_prompt` に渡す。

### フロントエンド (React)
1. **`src/lib/types.ts`**:
   - `Program` 型に `materials_filename?: string | null` を追加。
2. **`src/lib/api.ts`**:
   - ファイルアップロード用のAPIクライアント関数 `uploadProgramMaterial(programId: string, file: File)` を実装。
3. **`src/pages/SettingsPage.tsx`**:
   - タイトルを「新規プログラム作成」から「新規商談作成」に変更。
   - ファイル添付用の `<input type="file">` を追加（PDF, TXT, MDを許可）。
   - 商談作成ボタン押下時、プログラム作成後にファイルが選択されていれば `uploadProgramMaterial` を呼び出す。
   - エラーハンドリングとロード表示の実装。

## 検証プラン
1. **自動検証**:
   - バックエンドの静的解析・テストによる検証。
2. **手動検証**:
   - 商談作成画面で「.pdf」「.txt」「.md」それぞれのファイルを添付し、商談を開始。
   - ロールプレイ時に、添付した資料の内容について質問し、AI顧客がその内容を反映して応答することを確認。
   - 10MB以上のファイルや許可されていない拡張子をアップロードした際に、適切にエラーが発生することを確認。
