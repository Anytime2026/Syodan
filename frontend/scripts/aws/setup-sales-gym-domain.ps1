# sales-gym.org を CloudFront に接続するセットアップスクリプト
# 前提: Cloudflare DNS に手動でレコードを追加済みであること

$ErrorActionPreference = "Stop"

$DOMAIN = "sales-gym.org"
$WWW_DOMAIN = "www.sales-gym.org"
$DISTRIBUTION_ID = "E2TK0UGVYW3AWD"
$CLOUDFRONT_DOMAIN = "d3sqjmfezufvi4.cloudfront.net"
$CERT_ARN = "arn:aws:acm:us-east-1:542000445970:certificate/2570152a-fd50-4389-9724-3bd295d85b70"
$ECS_CLUSTER = "syodan"
$ECS_SERVICE = "syodan-backend"
$TASK_DEF_FILE = Join-Path $PSScriptRoot "../../../backend/scripts/task-def-register.json"

function Wait-AcmCertificate {
    param([string]$Arn, [int]$MaxMinutes = 30)
    $deadline = (Get-Date).AddMinutes($MaxMinutes)
    while ((Get-Date) -lt $deadline) {
        $status = aws acm describe-certificate --certificate-arn $Arn --region us-east-1 --query "Certificate.Status" --output text
        Write-Host "ACM status: $status"
        if ($status -eq "ISSUED") { return }
        if ($status -eq "FAILED") { throw "ACM certificate validation failed" }
        Start-Sleep -Seconds 30
    }
    throw "ACM certificate not issued within $MaxMinutes minutes"
}

function Update-CloudFrontDomain {
    $raw = aws cloudfront get-distribution-config --id $DISTRIBUTION_ID --output json | ConvertFrom-Json
    $etag = $raw.ETag
    $config = $raw.DistributionConfig

    $config.Aliases = @{
        Quantity = 2
        Items = @($DOMAIN, $WWW_DOMAIN)
    }
    $config.ViewerCertificate = @{
        ACMCertificateArn = $CERT_ARN
        SSLSupportMethod = "sni-only"
        MinimumProtocolVersion = "TLSv1.2_2021"
        CertificateSource = "acm"
    }

    $tmp = Join-Path $PSScriptRoot "cf-dist-update.json"
    $utf8 = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($tmp, ($config | ConvertTo-Json -Depth 30), $utf8)

    Write-Host "Updating CloudFront distribution $DISTRIBUTION_ID ..."
    aws cloudfront update-distribution --id $DISTRIBUTION_ID --if-match $etag --distribution-config "file://$tmp" | Out-Null
    Write-Host "CloudFront update submitted. Wait until status is Deployed."
}

function Update-EcsFrontendUrl {
    param([string]$Url)
    $taskDef = Get-Content $TASK_DEF_FILE -Raw | ConvertFrom-Json
    $envVar = $taskDef.containerDefinitions[0].environment | Where-Object { $_.name -eq "FRONTEND_BASE_URL" }
    $envVar.value = $Url
    $utf8 = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($TASK_DEF_FILE, ($taskDef | ConvertTo-Json -Depth 30), $utf8)

    Write-Host "Registering new ECS task definition..."
    $arn = aws ecs register-task-definition --cli-input-json "file://$TASK_DEF_FILE" --query "taskDefinition.taskDefinitionArn" --output text

    Write-Host "Updating ECS service $ECS_SERVICE ..."
    aws ecs update-service --cluster $ECS_CLUSTER --service $ECS_SERVICE --task-definition $arn --force-new-deployment | Out-Null
    Write-Host "ECS deployment started with FRONTEND_BASE_URL=$Url"
}

Write-Host @"

=== Cloudflare DNS に追加するレコード ===

[1] ACM 検証（証明書発行前に追加）
  CNAME  _498481bdd2d5ce3aa65aa56b05a4cb8a  ->  _9d3d3b555f30d5c8dc21e73306894a47.jkddzztszm.acm-validations.aws.
  CNAME  _98247b0647a4ea9639177bc9d947d414.www  ->  _0d2882e98ff1ed7612e402717efda8d3.jkddzztszm.acm-validations.aws.

[2] CloudFront 向け（証明書発行 + CloudFront 更新後に追加）
  CNAME  @ (sales-gym.org)  ->  $CLOUDFRONT_DOMAIN  （プロキシ: DNS only）
  CNAME  www  ->  $CLOUDFRONT_DOMAIN  （プロキシ: DNS only）

"@

if ($args -contains "-SkipWait") {
    Write-Host "Skipping ACM wait (-SkipWait)"
} else {
    Write-Host "Waiting for ACM certificate to be issued..."
    Wait-AcmCertificate -Arn $CERT_ARN
}

Update-CloudFrontDomain
Update-EcsFrontendUrl -Url "https://$DOMAIN"

Write-Host @"

Done.
- https://$DOMAIN/
- https://$WWW_DOMAIN/

CloudFront が Deployed になるまで数分かかります。
[2] の DNS レコードをまだ追加していなければ、今すぐ Cloudflare に追加してください。

"@
