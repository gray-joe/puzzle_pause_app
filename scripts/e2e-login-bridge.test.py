"""Run with: python3 scripts/e2e-login-bridge.test.py"""

import importlib.util
import sqlite3
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "bridge", Path(__file__).with_name("e2e-login-bridge.py")
)
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)


class LoginBridgeTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.database = Path(self.directory.name) / "test.db"
        with sqlite3.connect(self.database) as connection:
            connection.execute(
                "CREATE TABLE auth_tokens "
                "(id INTEGER PRIMARY KEY, email TEXT, used INTEGER, short_code TEXT)"
            )
            connection.executemany(
                "INSERT INTO auth_tokens VALUES (?, ?, ?, ?)",
                [
                    (1, "mobile@example.com", 0, "OLD123"),
                    (2, "other@example.com", 0, "OTHER1"),
                    (3, "mobile@example.com", 1, "USED12"),
                    (4, "mobile@example.com", 0, None),
                    (5, "mobile@example.com", 0, "NEW123"),
                ],
            )

    def test_watermark_is_scoped_to_email(self):
        self.assertEqual(bridge.read_token(self.database, "mobile@example.com"), {"id": 5})
        self.assertEqual(bridge.read_token(self.database, "absent@example.com"), {"id": 0})

    def test_only_new_unused_code_is_returned(self):
        self.assertEqual(
            bridge.read_token(self.database, "mobile@example.com", 1), {"code": "NEW123"}
        )
        self.assertIsNone(bridge.read_token(self.database, "mobile@example.com", 5))

    def test_missing_database_is_not_created(self):
        missing = self.database.with_name("missing.db")
        with self.assertRaises(sqlite3.OperationalError):
            bridge.read_token(missing, "mobile@example.com")
        self.assertFalse(missing.exists())


if __name__ == "__main__":
    unittest.main()
