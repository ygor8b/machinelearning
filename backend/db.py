import os
import psycopg2
import psycopg2.extras
from contextlib import contextmanager


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


@contextmanager
def db_cursor():
    conn = get_conn()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        yield cur
        conn.commit()
    finally:
        conn.close()


def query(sql, params=()):
    with db_cursor() as cur:
        cur.execute(sql, params)
        return [dict(r) for r in cur.fetchall()]


def query_one(sql, params=()):
    with db_cursor() as cur:
        cur.execute(sql, params)
        row = cur.fetchone()
        return dict(row) if row else None


def execute_returning(sql, params=()):
    with db_cursor() as cur:
        cur.execute(sql, params)
        row = cur.fetchone()
        return dict(row) if row else None


def paginate(count_sql, data_sql, params, page: int, per_page: int = 25):
    total = query_one(count_sql, params)["count"]
    offset = (page - 1) * per_page
    rows = query(data_sql + f" LIMIT {per_page} OFFSET {offset}", params)
    return {
        "items": rows,
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": max(1, (total + per_page - 1) // per_page),
    }
