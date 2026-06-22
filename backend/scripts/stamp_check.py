"""Exit 2 if DB has schema tables but no alembic_version (needs stamp 001)."""
import sys

import psycopg2

from app.config import get_settings

SCHEMA_TABLES = {
    "programs",
    "customer_profiles",
    "customer_states",
    "hearing_sessions",
    "evaluations",
    "overall_reviews",
}


def main() -> int:
    settings = get_settings()
    url = settings.database_url.replace("+asyncpg", "")
    conn = psycopg2.connect(url)
    cur = conn.cursor()
    cur.execute(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='alembic_version')"
    )
    has_version = cur.fetchone()[0]
    cur.execute(
        "SELECT table_name FROM information_schema.tables WHERE table_schema='public'"
    )
    tables = {r[0] for r in cur.fetchall()}
    conn.close()

    if has_version:
        return 0
    if SCHEMA_TABLES.issubset(tables):
        return 2
    return 1


if __name__ == "__main__":
    sys.exit(main())
