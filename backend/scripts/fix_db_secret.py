"""Fix invalid JSON in syodan/db Secrets Manager secret."""
import json
import re
import subprocess
import sys

REGION = "ap-northeast-1"
SECRET_ID = "syodan/db"
RDS_HOST = "syodan-db.cmxo14mvroum.ap-northeast-1.rds.amazonaws.com"


def aws(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["aws", *args, "--region", REGION],
        capture_output=True,
        text=True,
        check=True,
    )


def main() -> int:
    raw = aws(
        "secretsmanager",
        "get-secret-value",
        "--secret-id",
        SECRET_ID,
        "--query",
        "SecretString",
        "--output",
        "text",
    ).stdout.strip()

    fixed = raw
    fixed = re.sub(r'("\s*)\n(\s*")', r"\1,\n\2", fixed)
    fixed = re.sub(r"(\d)\n(\s*\")", r"\1,\n\2", fixed)
    data = json.loads(fixed)

    user = data["username"]
    pwd = data["password"]
    dbname = data.get("dbname", "syodan")
    port = int(data.get("port", 5432))
    data["host"] = data.get("host") or RDS_HOST
    data["port"] = port
    data["dbname"] = dbname
    data["database_url"] = (
        f"postgresql+asyncpg://{user}:{pwd}@{data['host']}:{port}/{dbname}"
    )

    secret_str = json.dumps(data, ensure_ascii=False)
    aws(
        "secretsmanager",
        "put-secret-value",
        "--secret-id",
        SECRET_ID,
        "--secret-string",
        secret_str,
    )
    print("syodan/db secret fixed")
    print("keys:", ", ".join(data.keys()))
    return 0


if __name__ == "__main__":
    sys.exit(main())
