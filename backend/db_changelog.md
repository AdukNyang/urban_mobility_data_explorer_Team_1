# Database Changelog — For Team Awareness

This document records every decision made during database design and data
loading that deviates from the raw dataset or that the rest of the team
should be aware of when building on top of the database.

---

## 1. Column Naming Convention Changed

The raw CSV uses mixed naming styles (`VendorID`, `PULocationID`,
`tpep_pickup_datetime`). The database uses consistent `snake_case`
throughout for SQL convention compliance:

| Raw CSV Column | Database Column |
|---|---|
| `VendorID` | `vendor_id` |
| `RatecodeID` | `rate_code_id` |
| `PULocationID` | `pu_location_id` |
| `DOLocationID` | `do_location_id` |
| `payment_type` | `payment_type_id` |
| `tpep_pickup_datetime` | `pickup_datetime` |
| `tpep_dropoff_datetime` | `dropoff_datetime` |

**Impact on team:** Anyone querying the database directly (not through the
API) needs to use these new column names, not the original CSV names.

---

## 2. Four Lookup Tables Created (Not in Raw Data)

The raw data only contains numeric codes for vendor, rate code, payment
type, and location. Four reference tables were created to give these
codes meaning: `vendors`, `rate_codes`, `payment_types`, `zones`.

**Impact on team:** Any query needing a human-readable label (vendor name,
borough, payment method) must `JOIN` against these tables — the `trips`
table only stores the numeric foreign key.

---

## 3. `VendorID = 4` Added as "Unknown Vendor"

The official TLC documentation only describes VendorID 1 (CMT) and 2
(VeriFone). During loading, the cleaned CSV contained 1,847 rows with
`VendorID = 4`, which is undocumented. Rather than dropping these rows
(which would mean discarding real trips over an unexplained code), it was
added to the `vendors` lookup table as `"Unknown Vendor"`.

**Impact on team:** If anyone reports vendor breakdowns, expect a small
"Unknown Vendor" category alongside CMT and VeriFone — this is expected
and explainable, not a bug.

---

## 4. Zones 264 and 265 Excluded

`LocationID` 264 ("Unknown") and 265 ("Outside of NYC") were excluded from
the `zones` table. This decision was made upstream during data cleaning
(Step 5 of `clean.py`) and the database schema reflects it — `zones`
contains only the 263 geographically valid NYC taxi zones.

**Impact on team:** Any trip referencing zone 264 or 265 was already
removed before reaching the database. Do not expect to find these IDs
anywhere in `trips`, `pu_location_id`, or `do_location_id`.

---

## 5. Eight Derived Feature Columns Added to `trips`

The `trips` table stores eight columns that do not exist in the raw TLC
data — they were engineered during cleaning and persisted directly into
the schema so the API never has to recompute them per request:

`trip_duration_seconds`, `trip_duration_min`, `avg_speed_mph`,
`pickup_hour`, `pickup_dow`, `fare_per_mile`, `is_airport_trip`,
`tip_percentage`, `total_reconciles`.

**Impact on team:** These are available for any analysis or frontend
chart without needing to recalculate them from raw columns.

---

## 6. `tip_percentage` and `fare_per_mile` Are Nullable — By Design

Every other column in `trips` is `NOT NULL`. These two are intentionally
allowed to be `NULL`:

- `tip_percentage` is `NULL` for any payment type other than credit card
  (type 1), because cash tips are never electronically recorded.
- `fare_per_mile` can be `NULL` in edge cases where `trip_distance` is
  effectively zero after rounding.

**Impact on team:** Always handle possible `NULL` values for these two
fields in frontend code and any aggregate queries (e.g. use
`WHERE tip_percentage IS NOT NULL` before averaging).

---

## 7. Dataset Trimmed from 1.4M to ~930,000 Rows

**Date of change:** [fill in date when you run this]

Aiven's free tier PostgreSQL plan has a 5GB storage limit. After loading
1.4 million cleaned trip rows, the database approached this limit and
Aiven automatically switched the instance to read-only mode, blocking
further inserts.

To resolve this, approximately 470,000 rows were removed using a random
sample (not a biased slice such as "all trips after January 15th") so
that the remaining dataset preserves the same statistical distribution
across hours, days, zones, and fare ranges as the original 1.4M rows.

**Impact on team:** Any totals or counts referenced in earlier
conversations, screenshots, or draft documentation based on the 1.4M row
figure are now outdated. The current row count is approximately 930,000.
All percentages, averages, and proportions (e.g. "X% of trips are
airport trips") remain valid since the sample was random and
unbiased — only absolute totals changed.

**Why this is documented as a deliberate decision, not a failure:** the
schema, indexing, and API were all designed to handle the full 7.28M row
dataset. The row count is a storage infrastructure constraint specific to
the free-tier hosting choice, not a flaw in the database design.

---

## Summary Table

| # | Change | Type | Reversible? |
|---|---|---|---|
| 1 | Column names converted to snake_case | Convention | N/A |
| 2 | 4 lookup tables added | Schema addition | N/A |
| 3 | VendorID 4 labeled "Unknown Vendor" | Data decision | Yes, if TLC clarifies |
| 4 | Zones 264/265 excluded | Inherited from cleaning | No (upstream decision) |
| 5 | 8 derived columns added | Schema addition | N/A |
| 6 | 2 columns made nullable | Schema design | N/A |
| 7 | ~470,000 rows randomly removed | Storage constraint | Yes, if upgraded plan |