"""
config.py
Manages the database connection for the Flask API.
Reads credentials from the .env file and provides a single
function that any route can call to get a database connection.
"""

import os
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

# Load credentials from .env file
load_dotenv()


def get_db_connection():
    """
    Creates and returns a new PostgreSQL connection.
    Uses RealDictCursor so query results come back as
    dictionaries (column_name: value) instead of plain tuples.
    This makes converting results to JSON much easier.
    """
    conn = psycopg2.connect(
        host     = os.getenv("DB_HOST"),
        port     = int(os.getenv("DB_PORT")),
        dbname   = os.getenv("DB_NAME"),
        user     = os.getenv("DB_USER"),
        password = os.getenv("DB_PASSWORD"),
        sslmode  = os.getenv("DB_SSLMODE", "require"),
    )

    # RealDictCursor makes each row behave like a dictionary.
    # Without this, rows come back as tuples like (1, 'Credit card')
    # and you'd have to remember which index is which column.
    # With this, rows come back as {"payment_type_id": 1, "payment_type_name": "Credit card"}
    conn.cursor_factory = psycopg2.extras.RealDictCursor

    return conn