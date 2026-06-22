## 2. Data Processing and Cleaning

### 2.1 Dataset overview

We worked with three NYC TLC inputs: the **yellow_tripdata_2019-01.csv** 
fact table (7,667,792 raw rows, ~687 MB), the **taxi_zone_lookup.csv** 
dimension table (265 rows, mapping LocationID to borough and zone), and 
the **taxi_zones** shapefile providing the spatial polygon for each zone. 
The cleaning pipeline operates on the trip data and validates it against 
the lookup; the shapefile is reserved for spatial visualization in the 
frontend.

### 2.2 Data quality issues identified

Profiling revealed ten distinct data quality issues, labeled A–J:

| Label | Issue | Initial count |
|---|---|---|
| A | Empty `congestion_surcharge` values | ~4.0M |
| B | `store_and_fwd_flag` stored as Y/N strings, not booleans | all 7.67M |
| C | Pickup dates outside January 2019 | 438 |
| D | Trips with non-positive duration | TODO |
| E | Negative fare amounts | 7,131 |
| F | `passenger_count = 0` | 117,381 |
| G | Zero trip distance | 52,560 |
| H | Undocumented `RatecodeID = 99` | 252 |
| I | LocationID 264 or 265 (Unknown / Outside NYC) | 161,951 |
| J | `total_amount` not matching sum of components | Flagged via `total_reconciles` column (no rows dropped) |

### 2.3 Cleaning decisions

The pipeline executes seven sequential steps. Type coercion (Issues A, B) 
runs first as a load-time fixup. Row filtering then proceeds from cheapest 
checks (date filter, ~438 rows) to most expensive (deduplication, full-row 
hashing) — running cheaper filters first shrinks the dataset for later 
operations. Feature engineering runs last so derived metrics reflect only 
clean data.

| Step | Purpose | Rows after |
|---|---|---|
| 1 | Load + type coercion (Issues A, B) | 7,667,792 |
| 2 | Drop pickups outside Jan 2019 (Issue C) | 7,667,354 |
| 3 | Drop non-positive durations (Issue D) | 7,660,964 |
| 4 | Numeric outlier bounds (Issues E, F, G) | 7,440,841 |
| 5 | Domain + FK validation (Issues H, I) | 7,280,912 |
| 6 | Drop exact duplicates | 7,280,912 |
| 7 | Feature engineering (Issue J) | 7,280,912 |

Final cleaned dataset: **7,280,912** rows.

### 2.4 An unexpected observation

Some of the steps that i thought would clean more the data like step 6 deduplication didn't actually clean any rows

### 2.5 Feature engineering

Seven features were derived to support analytical queries the raw columns 
can't directly answer: `trip_duration_min`, `pickup_hour`, `pickup_dow`, 
`fare_per_mile`, `is_airport_trip`, `tip_percentage`, and `total_reconciles`. 
The `avg_speed_mph` column also persists from Step 4's filter and acts as 
an additional feature. Two features carry deliberate semantic nuance: 
`tip_percentage` is NaN for non-card payments (cash tips are not recorded, 
so including them would bias the average toward zero), and `total_reconciles` 
is a boolean QA flag rather than a filter — flagging fare-component 
mismatches without dropping the rows.

### 2.6 Assumptions and trade-offs

The outlier thresholds in Step 4 are judgment calls and exposed as constants 
in one block for easy retuning. We dropped LocationID 264 ("Unknown") and 
265 ("Outside of NYC") rather than keeping them with flags, prioritizing 
clean zone-level aggregations over the ~2% of data preserved by keeping 
them. The `congestion_surcharge` zero-fill is a documented assumption — 
empty values likely reflect either a non-applicable trip or a vendor 
reporting gap, not a known surcharge value. Cash tips are unrecorded by 
design; downstream tip analytics are explicitly card-only.

## 3. Algorithmic Logic and Data Structures

### Problem
Identify the ten pickup zones with the highest trip count from the cleaned 
dataset (~7.3M rows). This powers the dashboard's "busiest pickup zones" 
panel, which is a key analytical insight for urban mobility.

### Approach: Top-K via a manually-implemented MinHeap
A built-in approach would be `df["PULocationID"].value_counts().head(10)`. 
To satisfy the manual-implementation requirement, we implement:

1. A single-pass hash count of pickup zone IDs (O(n))
2. A binary MinHeap from scratch (push, pop, sift up/down — no heapq)
3. A top-K selection algorithm that maintains a heap of size k, evicting 
   the smallest when a larger element appears (O(m log k) where m = 
   unique zones)

### Pseudo-code

ALGORITHM TopK_Zones(trips, k)
INPUT:  trips — array of (PULocationID, ...) records
        k     — desired number of top zones

STEP 1: Count occurrences per zone in a single pass
    counts ← empty hash map
    FOR each trip IN trips:
        counts[trip.PULocationID] += 1

STEP 2: Maintain a MinHeap of size k while iterating zone counts
    heap ← empty MinHeap
    FOR each (zone, count) IN counts:
        IF size(heap) < k:
            heap.push((count, zone))
        ELSE IF count > heap.peek().count:
            heap.pop()                  // evict smallest
            heap.push((count, zone))    // insert new

STEP 3: Drain heap, reverse for descending order
    result ← empty list
    WHILE heap is not empty:
        result.append(heap.pop())
    REVERSE result
    RETURN result

COMPLEXITY:
    Time:  O(n + m log k)
           - Step 1: O(n) — one pass through trips
           - Step 2: O(m log k) — each heap push/pop is O(log k)
           - Step 3: O(k log k) — drain k elements
    Space: O(m + k)
           - Counts map: O(m) unique zones
           - Heap: O(k)


### Complexity analysis
- **Time**: O(n + m log k)
  - O(n) for the initial count
  - O(m log k) for the heap-based selection (m heap operations, each O(log k))
- **Space**: O(m + k)
  - O(m) for the counts hash map
  - O(k) for the heap

### Why a MinHeap (not a MaxHeap)
A MinHeap's root holds the smallest element. To keep the largest k 
elements seen so far, we check incoming elements against the root: if 
larger, evict the root. The heap always contains "the largest k so far."

### Code location
`cleaning/src/top_k_zones.py` — implementation
Run: `python cleaning/src/top_k_zones.py`

