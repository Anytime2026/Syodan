# Syodan backend — ECR push + ECS force new deployment
# Usage (from repo root or backend):
#   powershell -ExecutionPolicy Bypass -File backend/scripts/aws/deploy.ps1

$ErrorActionPreference = "Stop"

$ACCOUNT_ID = "542000445970"
$REGION = "ap-northeast-1"
$ECR = "$ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com"
$REPO = "syodan-backend"
$IMAGE = "${ECR}/${REPO}:latest"
$CLUSTER = "syodan"
$SERVICE = "syodan-backend"
$TG_ARN = "arn:aws:elasticloadbalancing:ap-northeast-1:542000445970:targetgroup/syodan-backend-tg/3379c92f1c3b7608"
$BACKEND_ROOT = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
$TASK_DEF_FILE = Join-Path $PSScriptRoot "../task-def-register.json"

function Invoke-EcrLogin {
    # Windows Docker Desktop の credsStore 不具合回避: config.json に auth を直接書き込む
    $dockerConfig = Join-Path $env:TEMP "syodan-docker-ecr"
    New-Item -ItemType Directory -Force -Path $dockerConfig | Out-Null
    $pass = aws ecr get-login-password --region $REGION
    if (-not $pass) { throw "Failed to get ECR login password" }
    $auth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("AWS:$pass"))
    $cfg = @{
        auths = @{
            $ECR = @{ auth = $auth }
        }
    } | ConvertTo-Json -Compress
    Set-Content -Path (Join-Path $dockerConfig "config.json") -Value $cfg -Encoding ascii -NoNewline
    $env:DOCKER_CONFIG = $dockerConfig
}

Write-Host "Building Docker image..."
Push-Location $BACKEND_ROOT
docker build -t "${REPO}:latest" .
docker tag "${REPO}:latest" $IMAGE

Write-Host "Logging in to ECR..."
Invoke-EcrLogin

Write-Host "Pushing $IMAGE ..."
docker push $IMAGE
Pop-Location

Write-Host "Registering ECS task definition..."
$reg = aws ecs register-task-definition `
    --cli-input-json "file://$TASK_DEF_FILE" `
    --region $REGION `
    --output json | ConvertFrom-Json
$newArn = $reg.taskDefinition.taskDefinitionArn
Write-Host "Registered: $newArn"

Write-Host "Updating ECS service $SERVICE (force new deployment)..."
aws ecs update-service `
    --cluster $CLUSTER `
    --service $SERVICE `
    --task-definition $newArn `
    --load-balancers "targetGroupArn=$TG_ARN,containerName=syodan-backend,containerPort=8000" `
    --force-new-deployment `
    --region $REGION `
    --output json | Out-Null

Write-Host "Waiting for service stability..."
aws ecs wait services-stable --cluster $CLUSTER --services $SERVICE --region $REGION

$alb = aws elbv2 describe-load-balancers `
    --names syodan-alb `
    --region $REGION `
    --query "LoadBalancers[0].DNSName" `
    --output text

Write-Host "Done."
Write-Host "Health: http://${alb}/health"
Write-Host "Task definition: $newArn"
