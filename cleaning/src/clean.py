"""
in this script i am goinng to load clean the yellow_tripdata_2019-01.csv file and writes and saves it as a clean csv file
to run it python cleaning/src/clean.py
"""
from datetime import datetime
from pathlib import Path

import pandas as pd

# configuring the path
CLEANING_DIR = Path(__file__).resolve().parent.parent
RAW_TRIPS    = CLEANING_DIR / "data" / "raw"   / "yellow_tripdata_2019-01.csv"
RAW_LOOKUP   = CLEANING_DIR / "data" / "raw"   / "taxi_zone_lookup.csv"
CLEAN_OUT    = CLEANING_DIR / "data" / "clean" / "trips_clean.csv"
LOG_FILE     = CLEANING_DIR / "logs" / "cleaning_log.txt"

#writes timestamp lines to cleaning_log.txt
def log(msg: str = "", reset: bool = False) -> None:
    if reset:
        mode = "w"
    else:
        mode = "a"

    with open(LOG_FILE, mode, encoding="utf-8") as f:
        if msg == "":
            f.write("\n")
        else:
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            f.write(f"[{timestamp}] {msg}\n")

# the main pipeline
def main() -> None:
    log("="*50, reset=True)
    log("        Starting cleaning pipeline process")
    log("="*50)

    log()

#STEP 1
    log("─── STEP 1: Load + fixups (Issues A, B) ───")

    #load csv with the explicit data types for the columns
    #Explicit dtype map. We tell pandas EXACTLY what each column is, so that it doesn't waste memory Int8=1 byte or turn silently integer columns into floats and so that bugs are seen earlier
    dtype_map = {
            "VendorID":              "Int8",     # we only have 2 providers CMT and Verifone so values=(1, 2)
            "passenger_count":       "Int8",     # we expect 0 to 6 passengers
            "trip_distance":         "float32",
            "RatecodeID":            "Int8",     # 1..6 documented (+ stray 99)
            "store_and_fwd_flag":    "string",   # Y/N — converted to bool in Chunk 6
            "PULocationID":          "Int16",    # max value 265, Int8 too small
            "DOLocationID":          "Int16",
            "payment_type":          "Int8",    
            "fare_amount":           "float32",
            "extra":                 "float32",
            "mta_tax":               "float32",
            "tip_amount":            "float32",
            "tolls_amount":          "float32",
            "improvement_surcharge": "float32",
            "total_amount":          "float32",
            "congestion_surcharge":  "float32",
        }
        
    log(f"Loading {RAW_TRIPS.name} ...")

    df = pd.read_csv(
        RAW_TRIPS,
        dtype=dtype_map,
        # parse_dates tells pandas to convert these columns from strings to
        # real datetime objects. Comparisons and arithmetic become possible.
        parse_dates=["tpep_pickup_datetime", "tpep_dropoff_datetime"],
    )

    rows_loaded = len(df)
    log(f"Loaded {rows_loaded:,} raw rows from {RAW_TRIPS.name}")

    #issue A: Here we resolve issue A where empty congestion_surcharge are turned to 0.0 and this is a documented assumption and downstream math needs a numeric value
    null_congestion = int(df["congestion_surcharge"].isna().sum())
    df["congestion_surcharge"] = df["congestion_surcharge"].fillna(0.0)
    log(
        f"Issue A: filled {null_congestion:,} null congestion_surcharge values with 0.0"
    )

    #issue B: Here we resolve issue B where we store and flag Y/N values as boolean True/False we also standardize the type now so downstream code and SQlite schema later can treat it as a eral boolean
    df["store_and_fwd_flag"] = (
        df["store_and_fwd_flag"]
        .map({"Y": True, "N": False})
        .astype("boolean")
    )
    log("Issue B: converted store_and_fwd_flag (Y/N) → bool")
    log(f"Step 1 complete. Current row count: {len(df):,}")

    log()

#STEP 2
#drop trips outside january 2019 this does not include rides that started in january but ended in february and we are only looking at pickup dates

    log("─── STEP 2: Date range filter (Issue C) ───")

    JAN_START = pd.Timestamp("2019-01-01")
    FEB_START = pd.Timestamp("2019-02-01")

    before = len(df)
    df = df[
        (df["tpep_pickup_datetime"] >= JAN_START) &
        (df["tpep_pickup_datetime"] <  FEB_START)
    ]
    dropped = before - len(df)

    log(f"Dropped {dropped:,} rows with pickup outside Jan 2019")
    log(f"Step 2 complete. Rows: {len(df):,}")

    log()

#STEP 3
#trips where the dropoff happens at the same time as or before the pickup. We compute the duration column here because Steps 4 and 7 will both reuse it.

    log("─── STEP 3: Logical consistency (Issue D) ───")

    df["trip_duration_seconds"] = (
        df["tpep_dropoff_datetime"] - df["tpep_pickup_datetime"]
    ).dt.total_seconds()

    before = len(df)
    df = df[df["trip_duration_seconds"] > 0]
    dropped = before - len(df)

    log(f"Dropped {dropped:,} rows with non-positive trip duration")
    log(f"Step 3 complete. Rows: {len(df):,}")

    log()
    
#STEP 4
#Applies lower and upper bounds to four numeric columns and one derived metric. Each threshold is a judgment call: lower bounds are regulatory or physical (NYC minimum fare, max 6 passengers, positive distance), upper bounds are conservatively generous to preserve legitimate edge cases while removing clear data corruption.
    log("─── STEP 4: Numeric outlier bounds (Issues E, F, G) ───")


    # maximum for a yellow cab (6 passengers).
    before = len(df)
    df = df[(df["passenger_count"] >= 1) & (df["passenger_count"] <= 6)]
    log(f"Issue F: dropped {before - len(df):,} rows with passenger_count outside [1, 6]")
    
    # legitimate metro ride is well under 100.
    before = len(df)
    df = df[(df["trip_distance"] > 0) & (df["trip_distance"] <= 100)]
    log(f"Issue G: dropped {before - len(df):,} rows with trip_distance outside (0, 100] miles")
    
    #fare_amount in [2.5, 500]
    before = len(df)
    df = df[(df["fare_amount"] >= 2.5) & (df["fare_amount"] <= 500)]
    log(f"Issue E: dropped {before - len(df):,} rows with fare_amount outside [2.5, 500]")
    
    #trip_duration_seconds in [60, 21600]
    before = len(df)
    df = df[
        (df["trip_duration_seconds"] >= 60) &
        (df["trip_duration_seconds"] <= 21600)
    ]
    log(f"Dropped {before - len(df):,} rows with trip_duration outside [1 min, 6 hours]")
    
    # Distance / duration sanity check. NYC speed limits cap at 50 mph; any implied speed ≥100 mph means distance or duration is corrupted. We store this as a column — Step 7 will reuse it as the avg_speed_mph feature.
    df["avg_speed_mph"] = df["trip_distance"] / (df["trip_duration_seconds"] / 3600)
    before = len(df)
    df = df[df["avg_speed_mph"] < 100]
    log(f"Dropped {before - len(df):,} rows with avg_speed_mph >= 100 mph")

    log(f"Step 4 complete. Rows: {len(df):,}")

    log()
    
#Entry point of the script
if __name__ == "__main__":
    main()