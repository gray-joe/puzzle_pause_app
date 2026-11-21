#!/usr/bin/env python3
"""Loopback-only, read-only OTAC bridge for Maestro's host-side JavaScript.

Uses the same auth_tokens query as daily_puzzle_app/web/e2e/helpers/db.ts.
Never run against a production database or expose this server to the network.
"""

import argparse
import json
import sqlite3
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse


def read_token(database, email, after_id=None):
    connection = sqlite3.connect(Path(database).resolve().as_uri() + "?mode=ro", uri=True)
    try:
        if after_id is None:
            row = connection.execute(
                "SELECT COALESCE(MAX(id), 0) FROM auth_tokens WHERE email = ?", (email,)
            ).fetchone()
            return {"id": row[0]}
        row = connection.execute(
            "SELECT short_code FROM auth_tokens "
            "WHERE email = ? AND used = 0 AND short_code IS NOT NULL AND id > ? "
            "ORDER BY id DESC LIMIT 1",
            (email, after_id),
        ).fetchone()
        return {"code": row[0]} if row else None
    finally:
        connection.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", required=True)
    parser.add_argument("--email", required=True)
    parser.add_argument("--port", type=int, default=8766)
    args = parser.parse_args()
    # Fail at startup if the path/schema is wrong; never create an empty database.
    read_token(args.db, args.email)

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            request = urlparse(self.path)
            try:
                if request.path == "/health":
                    payload = {"ok": True}
                elif request.path == "/watermark":
                    payload = read_token(args.db, args.email)
                elif request.path == "/code":
                    after_id = int(parse_qs(request.query)["afterId"][0])
                    payload = read_token(args.db, args.email, after_id)
                else:
                    self.reply(404, {"error": "Not found"})
                    return
                self.reply(200 if payload else 404, payload or {"error": "No new unused code"})
            except (KeyError, ValueError, sqlite3.Error) as error:
                self.reply(400, {"error": str(error)})

        def reply(self, status, payload):
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(payload).encode())

        def log_message(self, *_args):
            pass  # Do not log authentication codes.

    HTTPServer(("127.0.0.1", args.port), Handler).serve_forever()


if __name__ == "__main__":
    main()
