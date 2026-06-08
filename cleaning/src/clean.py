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

#STEP 5
# Three checks: drop rows with categorical values outside their documented ranges, and drop rows whose pickup/dropoff zone IDs don't exist in the lookup table or refer to placeholder zones.
    log("─── STEP 5: Domain + FK validation (Issues H, I) ───")  
    #Issue H TLC documents only RatecodeIDs 1-6. Profiling found 252 rows with RatecodeID = 99 — an undocumented value. Drop to keep downstream rate-code logic interpretable.
    before = len(df)
    df = df[df["RatecodeID"].between(1, 6)]
    log(f"Issue H: dropped {before - len(df):,} rows with RatecodeID outside [1, 6]")

    # TLC documents only payment_types 1-6. No specific issue surfaced during profiling, but worth validating — rogue values would skew tip/payment analytics.
    before = len(df)
    df = df[df["payment_type"].between(1, 6)]
    log(f"Dropped {before - len(df):,} rows with payment_type outside [1, 6]")

    # PU/DO LocationID must be in lookup AND not 264 or 265 Issue I also catches any data corruption (LocationID > 265 or < 1).
    zone_lookup = pd.read_csv(RAW_LOOKUP)
    valid_zones = set(zone_lookup["LocationID"]) - {264, 265}

    before = len(df)
    df = df[
        df["PULocationID"].isin(valid_zones) &
        df["DOLocationID"].isin(valid_zones)
    ]
    log(f"Issue I: dropped {before - len(df):,} rows with PU/DO LocationID not in valid set")

    log(f"Step 5 complete. Rows: {len(df):,}")  

    log()
#STEP 6
# Deduplicate exact duplicate rows

    log("─── STEP 6: Deduplicate ───")

    before = len(df)
    df = df.drop_duplicates()
    dropped = before - len(df)

    log(f"Dropped {dropped:,} exact duplicate rows")
    log(f"Step 6 complete. Rows: {len(df):,}")

    log()

#STEP 7
# Derive analytical features from the cleaned base columns. Each feature unlocks an insight the raw columns can't directly answer.    

    log("─── STEP 7: Feature engineering (Issue J) ───")

    # trip_duration_min  convenient display unit (minutes vs seconds)
    df["trip_duration_min"] = df["trip_duration_seconds"] / 60

    # pickup_hour  hour of day (0-23) for rush-hour / late-night patterns
    df["pickup_hour"] = df["tpep_pickup_datetime"].dt.hour

    # pickup_dow  day of week (0=Mon, 6=Sun) for weekly demand patterns
    df["pickup_dow"] = df["tpep_pickup_datetime"].dt.dayofweek
    
    #fare per mile
    df["fare_per_mile"] = df["fare_amount"] / df["trip_distance"]

    # is_airport_trip — boolean if either endpoint is JFK / LGA / EWR. flagging them enables segmented analysis.
    AIRPORT_ZONES = {1, 132, 138}  # EWR, JFK, LGA per taxi_zone_lookup
    df["is_airport_trip"] = (
        df["PULocationID"].isin(AIRPORT_ZONES) |
        df["DOLocationID"].isin(AIRPORT_ZONES)
    )

    # tip_percentage — only meaningful for card payments (payment_type=1). Cash tips aren't recorded by the meter, so computing tip% on cash trips would falsely show 0% across the board.
    df["tip_percentage"] = (
        df["tip_amount"] / df["fare_amount"] * 100
    ).where(df["payment_type"] == 1)

    # In theory: total = fare + extra + mta + tip + tolls + improvement + congestion. In practice: rounding artifacts and unrecorded cash tips cause mismatches.
    component_sum = (
        df["fare_amount"] + df["extra"] + df["mta_tax"] +
        df["tip_amount"] + df["tolls_amount"] +
        df["improvement_surcharge"] + df["congestion_surcharge"]
    )
    df["total_reconciles"] = (component_sum - df["total_amount"]).abs() < 0.10

    log("Added 7 features: trip_duration_min, pickup_hour, pickup_dow,")
    log("  fare_per_mile, is_airport_trip, tip_percentage, total_reconciles")
    log(f"Step 7 complete. Rows: {len(df):,}, Columns: {len(df.columns)}")

    log()

#end of the pipeline
    log("─── Writing cleaned data to disk ───")
    df.to_csv(CLEAN_OUT, index=False)
    log(f"Wrote {len(df):,} rows × {len(df.columns)} columns to {CLEAN_OUT.name}")

    log()
    log("=" * 50)
    log("        Cleaning pipeline complete")
    log("=" * 50)    

#Entry point of the script
if __name__ == "__main__":
    main()