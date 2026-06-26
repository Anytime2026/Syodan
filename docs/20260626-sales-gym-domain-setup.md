# sales-gym.org カスタムドメイン設定

## 概要

Cloudflare で購入した `sales-gym.org` を、AWS CloudFront（S3 + ALB プロキシ）のフロントエンドに接続する手順。

## 実施済み（AWS側）

| 項目 | 値 |
|------|-----|
| ACM 証明書 | **ISSUED** |
| ACM 証明書 ARN | `arn:aws:acm:us-east-1:542000445970:certificate/2570152a-fd50-4389-9724-3bd295d85b70` |
| CloudFront カスタムドメイン | `sales-gym.org`, `www.sales-gym.org`（更新中 → Deployed 待ち） |
| ECS `FRONTEND_BASE_URL` | `https://sales-gym.org`（task-def rev 19 デプロイ済み） |

## Cloudflare DNS に追加するレコード

[Cloudflare DNS 設定](https://dash.cloudflare.com/e677a2ee6ae7ae98dda7778e096cc426/sales-gym.org/dns/records) を開く。

### ステップ1: ACM 検証（証明書発行に必須）

| タイプ | 名前 | コンテンツ | プロキシ |
|--------|------|------------|----------|
| CNAME | `_498481bdd2d5ce3aa65aa56b05a4cb8a` | `_9d3d3b555f30d5c8dc21e73306894a47.jkddzztszm.acm-validations.aws.` | DNS only（灰色雲） |
| CNAME | `_98247b0647a4ea9639177bc9d947d414.www` | `_0d2882e98ff1ed7612e402717efda8d3.jkddzztszm.acm-validations.aws.` | DNS only |

### ステップ2: CloudFront 向け（証明書発行後）

| タイプ | 名前 | コンテンツ | プロキシ |
|--------|------|------------|----------|
| CNAME | `@`（apex） | `d3sqjmfezufvi4.cloudfront.net` | DNS only |
| CNAME | `www` | `d3sqjmfezufvi4.cloudfront.net` | DNS only |

**重要:** プロキシを ON（オレンジ雲）にすると CloudFront の SSL と競合し、サイトが表示されません。必ず DNS only にしてください。

## セットアップ実行

ステップ1 の DNS レコード追加後:

```powershell
cd frontend/scripts/aws
.\setup-sales-gym-domain.ps1
```

このスクリプトは以下を自動実行します:

1. ACM 証明書の発行待ち
2. CloudFront にカスタムドメイン + ACM 証明書を設定
3. ECS の `FRONTEND_BASE_URL` を `https://sales-gym.org` に更新

ステップ2 の DNS レコードは、CloudFront 更新と並行して追加して問題ありません。

## 動作確認

```bash
curl -I https://sales-gym.org/
curl https://sales-gym.org/health
```

- SPA: `https://sales-gym.org/settings`
- API / WebSocket: 同一オリジン（変更不要）

## 社内ネットワークからアクセスできない場合

社内プロキシが `sales-gym.org` の HTTPS（SNI）をブロックしている可能性がある。IT 部門への許可申請テンプレート: [`docs/20260626-corporate-network-access.md`](./20260626-corporate-network-access.md)


```
sales-gym.org (Cloudflare DNS)
    ↓ CNAME
d3sqjmfezufvi4.cloudfront.net (ACM証明書)
    ├─ /* → S3 (静的ファイル)
    └─ /api/*, /ws/*, /health → ALB → ECS
```
