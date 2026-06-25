# GitHub Actions によるフロント自動デプロイ

`main` ブランチへ `frontend/**` に変更がある push（マージ含む）で、S3 + CloudFront へ自動デプロイします。

## ワークフロー

- ファイル: [`.github/workflows/frontend-deploy.yml`](../.github/workflows/frontend-deploy.yml)
- トリガー: `push` → `main`（`frontend/**` またはワークフロー自体の変更時）
- 認証: **GitHub OIDC** → IAM ロール `syodan-github-frontend-deploy`（長期アクセスキー不要）

## デプロイ先

| 項目 | 値 |
|------|-----|
| URL | https://d3sqjmfezufvi4.cloudfront.net |
| S3 | `syodan-frontend-542000445970` |
| CloudFront ID | `E2TK0UGVYW3AWD` |

## 手動デプロイ（ローカル）

```powershell
cd frontend
npm run aws:deploy
```

## IAM（初回セットアップ済み）

| リソース | 名前 |
|----------|------|
| ポリシー | `syodan-github-frontend-deploy` |
| ロール | `syodan-github-frontend-deploy` |
| 信頼 | `Anytime2026/Syodan` の `refs/heads/main` のみ |

定義 JSON: `backend/scripts/syodan-github-frontend-deploy-*.json`

詳細なインフラ手順: [`20260625-aws-frontend-s3-cloudfront-deploy.md`](./20260625-aws-frontend-s3-cloudfront-deploy.md)（feat ブランチで作成済みの場合は main マージ後に参照）
