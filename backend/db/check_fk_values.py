"""
check_fk_values.py
Scans trips_clean.csv and prints all unique values for the four
foreign key columns so we know exactly what needs to be in the
lookup tables before loading.

Run: python db/check_fk_values.py
"""

from pathlib import Path
import pandas as pd

# Adjust this path to match where your trips_clean.csv lives
CLEAN_CSV = Path(__file__).resolve().parent.parent.parent / \
            "cleaning" / "data" / "clean" / "trips_clean.csv"

print(f"Reading {CLEAN_CSV.name} ...")

df = pd.read_csv(
    CLEAN_CSV,
    usecols=["VendorID", "RatecodeID", "payment_type", "PULocationID", "DOLocationID"]
)

print(f"Loaded {len(df):,} rows.\n")

print("Unique VendorID values:")
print(sorted(df["VendorID"].dropna().unique().tolist()))

print("\nUnique RatecodeID values:")
print(sorted(df["RatecodeID"].dropna().unique().tolist()))

print("\nUnique payment_type values:")
print(sorted(df["payment_type"].dropna().unique().tolist()))

print("\nPULocationID range:")
print(f"  min={df['PULocationID'].min()}, max={df['PULocationID'].max()}")

print("\nDOLocationID range:")
print(f"  min={df['DOLocationID'].min()}, max={df['DOLocationID'].max()}")

print("\nAny PULocationID not in 1–263?")
invalid_pu = df[~df["PULocationID"].between(1, 263)]["PULocationID"].unique()
print(f"  {sorted(invalid_pu.tolist())}")

print("\nAny DOLocationID not in 1–263?")
invalid_do = df[~df["DOLocationID"].between(1, 263)]["DOLocationID"].unique()
print(f"  {sorted(invalid_do.tolist())}")