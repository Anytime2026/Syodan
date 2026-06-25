# Syodan frontend — AWS deploy constants (S3 + CloudFront)
# 再デプロイ時は deploy.ps1 を実行

$ErrorActionPreference = "Stop"

$ACCOUNT_ID = "542000445970"
$REGION = "ap-northeast-1"
$BUCKET = "syodan-frontend-$ACCOUNT_ID"
$DISTRIBUTION_ID = "E2TK0UGVYW3AWD"
$CLOUDFRONT_URL = "https://d3sqjmfezufvi4.cloudfront.net"

Write-Host "Building frontend..."
Push-Location (Join-Path $PSScriptRoot "../..")
npm run build

Write-Host "Uploading to s3://$BUCKET/ ..."
aws s3 sync dist/ "s3://$BUCKET/" --delete --region $REGION

Write-Host "Invalidating CloudFront cache ($DISTRIBUTION_ID)..."
aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths "/*"

Pop-Location
Write-Host "Done. URL: $CLOUDFRONT_URL"
