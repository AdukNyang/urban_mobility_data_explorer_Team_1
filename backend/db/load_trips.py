"""
load_trips.py
Reads trips_clean.csv in chunks and bulk-inserts into the
PostgreSQL trips table on Aiven.

Supports resuming from a row offset so if the connection drops
mid-load, you can restart from where it left off.

Must be run AFTER schema.sql and seed_lookups.sql.

Run:                python db/load_trips.py
Resume from row N:  python db/load_trips.py 690000
"""

import os
import sys
import time
from pathlib import Path

import pandas as pd
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

# -------------------------------------------------------------
#  Config
# -------------------------------------------------------------

load_dotenv()

CLEAN_CSV  = Path(__file__).resolve().parent.parent.parent / \
             "cleaning" / "data" / "clean" / "trips_clean.csv"

CHUNK_SIZE = 10_000   # increased from 5,000 to reduce round trips

# Read resume offset from command line argument (default 0)
SKIP_ROWS  = int(sys.argv[1]) if len(sys.argv) > 1 else 0


# -------------------------------------------------------------
#  Database connection
# -------------------------------------------------------------

def get_connection():
    """Create and return a fresh psycopg2 connection."""
    return psycopg2.connect(
        host            = os.getenv("DB_HOST"),
        port            = int(os.getenv("DB_PORT")),
        dbname          = os.getenv("DB_NAME"),
        user            = os.getenv("DB_USER"),
        password        = os.getenv("DB_PASSWORD"),
        sslmode         = os.getenv("DB_SSLMODE", "require"),
        connect_timeout = 30,
        keepalives      = 1,       # enable TCP keepalives
        keepalives_idle = 30,      # send keepalive after 30s idle
        keepalives_interval = 10,  # retry every 10s
        keepalives_count = 5,      # drop after 5 failed retries
    )


# -------------------------------------------------------------
#  Row mapping
# -------------------------------------------------------------

def nullable(val):
    """Return None if val is NaN, otherwise return val."""
    try:
        import math
        return None if math.isnan(float(val)) else val
    except (TypeError, ValueError):
        return val


def row_to_tuple(row):
    """Convert a DataFrame row to an INSERT-ready tuple."""
    return (
        int(row["VendorID"]),
        int(row["RatecodeID"]),
        int(row["PULocationID"]),
        int(row["DOLocationID"]),
        int(row["payment_type"]),
        row["tpep_pickup_datetime"],
        row["tpep_dropoff_datetime"],
        int(row["passenger_count"]),
        float(row["trip_distance"]),
        float(row["fare_amount"]),
        float(row["extra"]),
        float(row["mta_tax"]),
        float(row["tip_amount"]),
        float(row["tolls_amount"]),
        float(row["improvement_surcharge"]),
        float(row["congestion_surcharge"]),
        float(row["total_amount"]),
        bool(row["store_and_fwd_flag"]),
        int(row["trip_duration_seconds"]),
        float(row["trip_duration_min"]),
        float(row["avg_speed_mph"]),
        int(row["pickup_hour"]),
        int(row["pickup_dow"]),
        nullable(row["fare_per_mile"]),
        bool(row["is_airport_trip"]),
        nullable(row["tip_percentage"]),
        bool(row["total_reconciles"]),
    )


# -------------------------------------------------------------
#  INSERT statement
# -------------------------------------------------------------

INSERT_SQL = """
    INSERT INTO trips (
        vendor_id, rate_code_id, pu_location_id, do_location_id,
        payment_type_id, pickup_datetime, dropoff_datetime,
        passenger_count, trip_distance,
        fare_amount, extra, mta_tax, tip_amount, tolls_amount,
        improvement_surcharge, congestion_surcharge, total_amount,
        store_and_fwd_flag,
        trip_duration_seconds, trip_duration_min, avg_speed_mph,
        pickup_hour, pickup_dow, fare_per_mile,
        is_airport_trip, tip_percentage, total_reconciles
    ) VALUES %s
"""


# -------------------------------------------------------------
#  Insert one chunk with auto-reconnect on failure
# -------------------------------------------------------------

def insert_chunk(conn, rows):
    """Insert a batch of rows. Reconnects once if connection dropped."""
    for attempt in range(2):
        try:
            cursor = conn.cursor()
            psycopg2.extras.execute_values(
                cursor, INSERT_SQL, rows, page_size=CHUNK_SIZE
            )
            conn.commit()
            cursor.close()
            return conn   # success
        except (psycopg2.OperationalError, psycopg2.InterfaceError) as e:
            if attempt == 0:
                print(f"\n  Connection lost ({e}). Reconnecting ...")
                try:
                    conn.close()
                except Exception:
                    pass
                conn = get_connection()
                print("  Reconnected. Retrying chunk ...")
            else:
                raise   # second attempt also failed — give up
    return conn


# -------------------------------------------------------------
#  Main loader
# -------------------------------------------------------------

def main():
    print(f"Connecting to PostgreSQL on Aiven ...")
    conn = get_connection()
    print("Connected.")

    if SKIP_ROWS > 0:
        print(f"Resuming from row {SKIP_ROWS:,} (skipping already-inserted rows).\n")
    else:
        print()

    print(f"Reading {CLEAN_CSV.name} in chunks of {CHUNK_SIZE:,} rows ...")
    print("Progress reported every 10 chunks (every 100,000 rows).\n")

    total_inserted = 0
    chunk_number   = 0
    start_time     = time.time()
    total_rows     = 7_280_912

    reader = pd.read_csv(
        CLEAN_CSV,
        chunksize=CHUNK_SIZE,
        parse_dates=["tpep_pickup_datetime", "tpep_dropoff_datetime"],
        skiprows=range(1, SKIP_ROWS + 1),   # skip header=0, data rows 1..SKIP_ROWS
    )

    for chunk in reader:
        chunk_number += 1

        rows = [row_to_tuple(row) for _, row in chunk.iterrows()]
        conn = insert_chunk(conn, rows)

        total_inserted += len(rows)
        rows_done = SKIP_ROWS + total_inserted

        if chunk_number % 10 == 0:
            elapsed   = time.time() - start_time
            rate      = total_inserted / elapsed if elapsed > 0 else 0
            remaining = (total_rows - rows_done) / rate if rate > 0 else 0
            print(
                f"  Chunk {chunk_number:>5} | "
                f"{rows_done:>9,} / {total_rows:,} rows | "
                f"{rate:,.0f} rows/sec | "
                f"~{remaining/60:.1f} min remaining"
            )

    elapsed = time.time() - start_time
    print(f"\nDone. Inserted {total_inserted:,} new rows in {elapsed/60:.1f} minutes.")
    print(f"Total rows in DB should now be ~{SKIP_ROWS + total_inserted:,}.")

    conn.close()
    print("Connection closed.")


if __name__ == "__main__":
    main()