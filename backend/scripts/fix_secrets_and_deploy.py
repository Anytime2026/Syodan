"""Fix malformed Secrets Manager entries and redeploy ECS."""
import json
import re
import subprocess
import sys
from pathlib import Path

REGION = "ap-northeast-1"
CLUSTER = "syodan"
SERVICE = "syodan-backend"
TG_ARN = (
    "arn:aws:elasticloadbalancing:ap-northeast-1:542000445970:"
    "targetgroup/syodan-backend-tg/3379c92f1c3b7608"
)
REMOVE_KEYS = {
    "taskDefinitionArn",
    "revision",
    "status",
    "requiresAttributes",
    "compatibilities",
    "registeredAt",
    "registeredBy",
}


def aws(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["aws", *args, "--region", REGION],
        capture_output=True,
        text=True,
        check=True,
    )


def get_secret(secret_id: str) -> str:
    proc = aws(
        "secretsmanager",
        "get-secret-value",
        "--secret-id",
        secret_id,
        "--query",
        "SecretString",
        "--output",
        "text",
    )
    return proc.stdout.rstrip("\r\n")


def put_secret(secret_id: str, value: str) -> None:
    aws(
        "secretsmanager",
        "put-secret-value",
        "--secret-id",
        secret_id,
        "--secret-string",
        value,
    )


def fix_hulft_secret() -> None:
    raw = get_secret("syodan/hulft")
    url = ""
    try:
        data = json.loads(raw)
        if isinstance(data, dict):
            url = str(data.get("webhook_url", ""))
    except json.JSONDecodeError:
        match = re.search(r"https?://[^\s}\"]+", raw)
        if match:
            url = match.group(0)
    put_secret("syodan/hulft", json.dumps({"webhook_url": url}))
    print("hulft: fixed JSON")


def register_and_deploy() -> str:
    raw = json.loads(
        aws("ecs", "describe-task-definition", "--task-definition", "syodan-backend:7").stdout
    )["taskDefinition"]
    for key in REMOVE_KEYS:
        raw.pop(key, None)

    container = raw["containerDefinitions"][0]
    env = container["environment"]
    env_names = {item["name"] for item in env}
    for item in [
        {"name": "SLACK_STUB_MODE", "value": "false"},
        {"name": "FRONTEND_BASE_URL", "value": "https://syodan-frontend.pages.dev"},
    ]:
        if item["name"] not in env_names:
            env.append(item)

    slack_ref = "arn:aws:secretsmanager:ap-northeast-1:542000445970:secret:syodan/slack-Sd8NXl::"
    secrets = container.setdefault("secrets", [])
    updated = False
    for secret in secrets:
        if secret["name"] == "SLACK_BOT_TOKEN":
            secret["valueFrom"] = slack_ref
            updated = True
            break
    if not updated:
        secrets.append({"name": "SLACK_BOT_TOKEN", "valueFrom": slack_ref})

    payload = Path(__file__).resolve().parent / "task-def-register.json"
    payload.write_text(json.dumps(raw), encoding="utf-8")

    reg = json.loads(
        aws(
            "ecs",
            "register-task-definition",
            "--cli-input-json",
            f"file://{payload.as_posix()}",
        ).stdout
    )
    new_arn = reg["taskDefinition"]["taskDefinitionArn"]
    print("registered:", new_arn)

    aws(
        "ecs",
        "update-service",
        "--cluster",
        CLUSTER,
        "--service",
        SERVICE,
        "--task-definition",
        new_arn,
        "--load-balancers",
        f"targetGroupArn={TG_ARN},containerName=syodan-backend,containerPort=8000",
        "--force-new-deployment",
    )
    print("service updated")
    return new_arn


def main() -> int:
    fix_hulft_secret()
    register_and_deploy()
    return 0


if __name__ == "__main__":
    sys.exit(main())
