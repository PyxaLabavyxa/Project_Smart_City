"""Psycopg requires SelectorEventLoop on Windows."""

from app.database.runtime import loop_factory as loop_factory
