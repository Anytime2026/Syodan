"""Register ECS task definition revision with container port 8000."""
import json
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


def main() -> int:
    src = Path(__file__).resolve().parent.parent / "tmp-task-def.json"
    task_def = json.loads(src.read_text(encoding="utf-8-sig"))
    for key in REMOVE_KEYS:
        task_def.pop(key, None)

    container = task_def["containerDefinitions"][0]
    container["portMappings"] = [
        {
            "containerPort": 8000,
            "hostPort": 8000,
            "protocol": "tcp",
            "name": "syodan-backend-8000-tcp",
            "appProtocol": "http",
        }
    ]

    payload = Path(__file__).resolve().parent / "task-def-register.json"
    payload.write_text(json.dumps(task_def), encoding="utf-8")

    reg = aws(
        "ecs",
        "register-task-definition",
        "--cli-input-json",
        f"file://{payload.as_posix()}",
    )
    new_arn = json.loads(reg.stdout)["taskDefinition"]["taskDefinitionArn"]
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
    print("service updated with containerPort=8000")
    return 0


if __name__ == "__main__":
    sys.exit(main())
