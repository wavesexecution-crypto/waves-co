"""TEMP verify grant as both roles. Deleted after the run."""
import os
import sys
import psycopg

url = os.environ.get("PROD_URL")
if not url:
    print("NO-URL", file=sys.stderr)
    sys.exit(2)
with psycopg.connect(url, connect_timeout=15) as conn:
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute("SELECT current_user")
        print("connected-as=" + cur.fetchone()[0])
        cur.execute("SELECT has_table_privilege('wavesco_app', '\"AuditLog\"', 'INSERT')")
        print("app-can-insert=" + str(cur.fetchone()[0]))
print("VERIFY-DONE")
