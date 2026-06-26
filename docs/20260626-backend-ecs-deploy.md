# バックエンド ECS デプロイ (2026-06-26)

## 実施内容
- Docker イメージを ECR (`542000445970.dkr.ecr.ap-northeast-1.amazonaws.com/syodan-backend:latest`) にプッシュ
- ECS タスク定義 `syodan-backend:20` を登録
- クラスタ `syodan` / サービス `syodan-backend` を強制新規デプロイ
- デプロイ完了まで `services-stable` を待機

## デプロイスクリプト
```powershell
powershell -ExecutionPolicy Bypass -File backend/scripts/aws/deploy.ps1
```

## 確認 URL
- ヘルスチェック: http://syodan-alb-520683133.ap-northeast-1.elb.amazonaws.com/health
- フロント経由: https://d3sqjmfezufvi4.cloudfront.net/health

## 含まれる修正
- 会話なし終了時のセッション finalize 修正 (`session_finalize.py`)

## タスク定義
- リビジョン: `syodan-backend:20`
- CPU / Memory: 1024 / 2048
- `FRONTEND_BASE_URL`: `https://d3sqjmfezufvi4.cloudfront.net`
