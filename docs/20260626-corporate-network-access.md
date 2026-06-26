# 社内ネットワークから sales-gym.org へアクセスする

## 原因

社内ネットワーク（DNS: `10.40.0.1` 経由のプロキシ）では、TLS の SNI が `sales-gym.org` の HTTPS 接続がファイアウォールで遮断される。

| 接続先 | 社内 | 社外 |
|--------|------|------|
| `https://sales-gym.org` | 接続リセット | OK |
| `https://d3sqjmfezufvi4.cloudfront.net` | OK | OK |

同一 CloudFront IP でも **ホスト名（SNI）によって許可/拒否が分かれる**ため、AWS / Cloudflare の設定不備ではなく、社内セキュリティポリシーによるブロック。

## 対策（推奨）: IT 部門への通信許可申請

以下をそのままチケットに貼り付けて申請する。

---

### 申請件名

`sales-gym.org` への HTTPS 通信許可（社内業務用 Web アプリ）

### 申請内容

社内から以下の URL へのアクセスを許可してください。

- `https://sales-gym.org`
- `https://www.sales-gym.org`

**用途:** 社内開発・検証用の営業ロープレ AI Web アプリ（本番環境）

**インフラ:** AWS CloudFront（CDN）+ バックエンド API

**必要な通信:**

| 項目 | 値 |
|------|-----|
| プロトコル | HTTPS（TCP 443） |
| ホスト名 | `sales-gym.org`, `www.sales-gym.org` |
| HTTP（80） | CloudFront が 443 へリダイレクトするため、443 の許可が必須 |

**SSL インスペクションについて:**

- 接続リセット（`ERR_CONNECTION_RESET`）が発生している
- カテゴリ未登録ドメインのブロック、または SSL インスペクション対象外ドメインの切断の可能性がある
- **上記ドメインを SSL インスペクションのバイパスリストに追加**、または **ファイアウォール許可リストに登録** をお願いしたい

**参考（社外では正常動作）:**

- `https://sales-gym.org/health` → `{"status":"ok"}`
- オリジン CDN: `d3sqjmfezufvi4.cloudfront.net`（カスタムドメイン経由で同一オリジン）

---

## 代替案

### A. 社内で許可済みドメインのサブドメインを使う

例: `syodan.saison-technology.com` が社内から到達可能なら、そちらに CNAME を向けて ACM 証明書を追加する。

- メリット: 社内ポリシーに沿いやすい
- デメリット: DNS 管理権限が必要、証明書・CloudFront の再設定が必要

### B. 社外ネットワークのみで利用

- スマホテザリング、自宅回線など
- デモ・検証用途なら現実的

### C. Cloudflare プロキシ ON

- 今回のブロックは **SNI ベース**のため、Cloudflare プロキシを ON にしても改善しない可能性が高い（検証済み: 同一 IP で `cloudfront.net` は通り `sales-gym.org` は不通）

## 社内 IT 向け技術メモ

```
# 社内での再現確認（接続リセットが出る）
curl -v https://sales-gym.org/health

# 同一 CDN への接続は通る（SNI のみ異なる）
curl -v https://d3sqjmfezufvi4.cloudfront.net/health
```

許可後の確認:

```bash
curl https://sales-gym.org/health
# {"status":"ok"}
```
