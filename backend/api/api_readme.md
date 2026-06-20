# NYC Taxi API Documentation

## Base URL
```
http://localhost:5000
```

## General Notes
- All endpoints use the **GET** method
- No authentication required
- No request body or payload needed for any endpoint
- All responses are in **JSON** format
- All endpoints return a `status` field — check for `"success"` before reading `data`

---

## Response Structure
Every endpoint returns a consistent structure:
```json
{
  "status": "success",
  "data": [ ... ]
}
```

---

## Endpoints

---

### 1. Health Check
Confirms the API is running. Call this first to verify the server is up.

```
GET /api/health
```

**Example Response:**
```js/api/healthon
{
  "status": "ok",
  "message": "NYC Taxi API is running"
}
```

---

### 2. Dataset Summary
Returns high-level statistics about the entire dataset. Use this for the dashboard header/summary cards.

```
GET /api/trips/summary
```

**Example Response:**
```json
{
  "status": "success",
  "data": {
    "total_trips": 1400000,
    "avg_fare": 12.85,
    "avg_distance_miles": 2.94,
    "avg_duration_min": 15.32,
    "avg_speed_mph": 12.47,
    "airport_trips": 87423
  }
}
```

| Field | Type | Description |
|---|---|---|
| `total_trips` | integer | Total number of trips in the dataset |
| `avg_fare` | float | Average fare amount in USD |
| `avg_distance_miles` | float | Average trip distance in miles |
| `avg_duration_min` | float | Average trip duration in minutes |
| `avg_speed_mph` | float | Average speed in miles per hour |
| `airport_trips` | integer | Number of trips involving an airport |

---

### 3. Trips by Hour of Day
Returns trip count and average fare for each hour of the day (0–23). Use this for a rush hour bar or line chart.

```
GET /api/trips/by-hour
```

**Example Response:**
```json
{
  "status": "success",
  "data": [
    { "hour": 0,  "trip_count": 28432, "avg_fare": 13.20, "avg_duration_min": 14.5 },
    { "hour": 1,  "trip_count": 19871, "avg_fare": 13.05, "avg_duration_min": 13.8 },
    { "hour": 8,  "trip_count": 54320, "avg_fare": 11.90, "avg_duration_min": 18.2 },
    { "hour": 18, "trip_count": 72341, "avg_fare": 12.50, "avg_duration_min": 19.1 }
  ]
}
```

| Field | Type | Description |
|---|---|---|
| `hour` | integer | Hour of day (0 = midnight, 23 = 11pm) |
| `trip_count` | integer | Number of trips that started in this hour |
| `avg_fare` | float | Average fare amount in USD |
| `avg_duration_min` | float | Average trip duration in minutes |

---

### 4. Trips by Day of Week
Returns trip count and averages grouped by day of the week. Use this for a weekly demand bar chart.

```
GET /api/trips/by-day
```

**Example Response:**
```json
{
  "status": "success",
  "data": [
    { "day_of_week": 0, "day_name": "Monday",    "trip_count": 198432, "avg_fare": 12.10, "avg_distance_miles": 2.80 },
    { "day_of_week": 4, "day_name": "Friday",    "trip_count": 241873, "avg_fare": 12.75, "avg_distance_miles": 2.95 },
    { "day_of_week": 5, "day_name": "Saturday",  "trip_count": 265341, "avg_fare": 13.40, "avg_distance_miles": 3.20 },
    { "day_of_week": 6, "day_name": "Sunday",    "trip_count": 231004, "avg_fare": 13.10, "avg_distance_miles": 3.10 }
  ]
}
```

| Field | Type | Description |
|---|---|---|
| `day_of_week` | integer | Day number (0 = Monday, 6 = Sunday) |
| `day_name` | string | Human-readable day name |
| `trip_count` | integer | Number of trips on this day |
| `avg_fare` | float | Average fare amount in USD |
| `avg_distance_miles` | float | Average trip distance in miles |

---

### 5. Trips by Payment Type
Returns trip count and average tip percentage grouped by how passengers paid. Note: `avg_tip_percentage` is only meaningful for Credit card — it will be `null` for all other payment types because cash tips are not recorded by the meter.

```
GET /api/trips/by-payment
```

**Example Response:**
```json
{
  "status": "success",
  "data": [
    { "payment_type_name": "Credit card", "trip_count": 980432, "avg_fare": 12.90, "avg_tip_percentage": 18.5 },
    { "payment_type_name": "Cash",        "trip_count": 398234, "avg_fare": 11.20, "avg_tip_percentage": null },
    { "payment_type_name": "No charge",   "trip_count": 12043,  "avg_fare": 0.00,  "avg_tip_percentage": null },
    { "payment_type_name": "Dispute",     "trip_count": 9291,   "avg_fare": 11.50, "avg_tip_percentage": null }
  ]
}
```

| Field | Type | Description |
|---|---|---|
| `payment_type_name` | string | Payment method used |
| `trip_count` | integer | Number of trips using this payment type |
| `avg_fare` | float | Average fare amount in USD |
| `avg_tip_percentage` | float or null | Average tip as % of fare — null for non-card payments |

---

### 6. Airport vs City Trips
Compares trips that involved an airport (JFK, LaGuardia, or Newark) against all other city trips. Use this for a side-by-side comparison card or chart.

```
GET /api/trips/airport-vs-city
```

**Example Response:**
```json
{
  "status": "success",
  "data": [
    {
      "is_airport_trip": true,
      "trip_type": "Airport",
      "trip_count": 87423,
      "avg_fare": 38.50,
      "avg_distance_miles": 12.40,
      "avg_duration_min": 38.20,
      "avg_tip_percentage": 20.1
    },
    {
      "is_airport_trip": false,
      "trip_type": "City",
      "trip_count": 1312577,
      "avg_fare": 11.20,
      "avg_distance_miles": 2.50,
      "avg_duration_min": 13.80,
      "avg_tip_percentage": 17.8
    }
  ]
}
```

| Field | Type | Description |
|---|---|---|
| `is_airport_trip` | boolean | True if pickup or dropoff was at JFK, LGA, or EWR |
| `trip_type` | string | "Airport" or "City" — readable label |
| `trip_count` | integer | Number of trips in this category |
| `avg_fare` | float | Average fare in USD |
| `avg_distance_miles` | float | Average distance in miles |
| `avg_duration_min` | float | Average duration in minutes |
| `avg_tip_percentage` | float | Average tip as % of fare (card payments only) |

---

### 7. Fare Distribution
Returns trip counts bucketed into fare ranges. Use this for a histogram or bar chart showing fare spread.

```
GET /api/trips/fare-distribution
```

**Example Response:**
```json
{
  "status": "success",
  "data": [
    { "fare_range": "$0-5",   "trip_count": 45231  },
    { "fare_range": "$5-10",  "trip_count": 389432 },
    { "fare_range": "$10-15", "trip_count": 412043 },
    { "fare_range": "$15-20", "trip_count": 198234 },
    { "fare_range": "$20-30", "trip_count": 143021 },
    { "fare_range": "$30-50", "trip_count": 87432  },
    { "fare_range": "$50+",   "trip_count": 24539  }
  ]
}
```

| Field | Type | Description |
|---|---|---|
| `fare_range` | string | Fare bucket label |
| `trip_count` | integer | Number of trips in this fare range |

---

### 8. Trips by Borough
Returns trip stats grouped by pickup borough. Can be filtered to a specific borough using a query parameter.

```
GET /api/trips/by-borough
GET /api/trips/by-borough?borough=Manhattan
```

**Query Parameters:**

| Parameter | Required | Description |
|---|---|---|
| `borough` | No | Filter by a specific borough name. If omitted, returns all boroughs. Valid values: `Manhattan`, `Brooklyn`, `Queens`, `Bronx`, `Staten Island`, `EWR` |

**Example Response (all boroughs):**
```json
{
  "status": "success",
  "data": [
    { "borough": "Manhattan",     "trip_count": 1102341, "avg_fare": 11.80, "avg_distance_miles": 2.30, "avg_duration_min": 13.20 },
    { "borough": "Queens",        "trip_count": 198432,  "avg_fare": 18.40, "avg_distance_miles": 5.80, "avg_duration_min": 22.10 },
    { "borough": "Brooklyn",      "trip_count": 67234,   "avg_fare": 15.20, "avg_distance_miles": 4.10, "avg_duration_min": 19.40 },
    { "borough": "Bronx",         "trip_count": 21043,   "avg_fare": 14.30, "avg_distance_miles": 3.90, "avg_duration_min": 18.70 },
    { "borough": "Staten Island", "trip_count": 8932,    "avg_fare": 22.10, "avg_distance_miles": 7.20, "avg_duration_min": 28.50 },
    { "borough": "EWR",           "trip_count": 2930,    "avg_fare": 42.00, "avg_distance_miles": 14.10, "avg_duration_min": 41.20 }
  ]
}
```

| Field | Type | Description |
|---|---|---|
| `borough` | string | Borough name |
| `trip_count` | integer | Number of pickups in this borough |
| `avg_fare` | float | Average fare in USD |
| `avg_distance_miles` | float | Average trip distance in miles |
| `avg_duration_min` | float | Average trip duration in minutes |

---

### 9. All Zones
Returns all 263 valid NYC taxi zones. Use this to populate dropdown filters on the frontend.

```
GET /api/zones/
```

**Example Response:**
```json
{
  "status": "success",
  "count": 263,
  "data": [
    { "location_id": 1,   "borough": "EWR",       "zone": "Newark Airport",    "service_zone": "EWR" },
    { "location_id": 4,   "borough": "Manhattan",  "zone": "Alphabet City",     "service_zone": "Yellow Zone" },
    { "location_id": 132, "borough": "Queens",     "zone": "LaGuardia Airport", "service_zone": "Airports" }
  ]
}
```

| Field | Type | Description |
|---|---|---|
| `location_id` | integer | Unique zone ID (1–263) |
| `borough` | string | Borough the zone belongs to |
| `zone` | string | Zone name |
| `service_zone` | string | Service type — "Yellow Zone", "Boro Zone", "Airports", or "EWR" |

---

### 10. All Boroughs
Returns a simple list of unique borough names. Use this to populate a borough filter dropdown.

```
GET /api/zones/boroughs
```

**Example Response:**
```json
{
  "status": "success",
  "data": ["Bronx", "Brooklyn", "EWR", "Manhattan", "Queens", "Staten Island"]
}
```

---

### 11. Top 10 Pickup Zones
Returns the 10 zones with the highest number of trip pickups. Use this for a leaderboard or bar chart.

```
GET /api/zones/top-pickup
```

**Example Response:**
```json
{
  "status": "success",
  "data": [
    { "location_id": 161, "zone": "Midtown Center",      "borough": "Manhattan", "trip_count": 54321 },
    { "location_id": 237, "zone": "Upper East Side South","borough": "Manhattan", "trip_count": 48932 },
    { "location_id": 132, "zone": "LaGuardia Airport",   "borough": "Queens",    "trip_count": 43210 }
  ]
}
```

| Field | Type | Description |
|---|---|---|
| `location_id` | integer | Zone ID |
| `zone` | string | Zone name |
| `borough` | string | Borough name |
| `trip_count` | integer | Number of pickups in this zone |

---

### 12. Top 10 Dropoff Zones
Returns the 10 zones with the highest number of trip dropoffs. Same structure as top-pickup.

```
GET /api/zones/top-dropoff
```

**Example Response:**
```json
{
  "status": "success",
  "data": [
    { "location_id": 161, "zone": "Midtown Center",      "borough": "Manhattan", "trip_count": 51234 },
    { "location_id": 237, "zone": "Upper East Side South","borough": "Manhattan", "trip_count": 46871 },
    { "location_id": 132, "zone": "LaGuardia Airport",   "borough": "Queens",    "trip_count": 41023 }
  ]
}
```

---

## Quick Reference

| Endpoint | Description |
|---|---|
| `GET /api/health` | Check if API is running |
| `GET /api/trips/summary` | Overall dataset statistics |
| `GET /api/trips/by-hour` | Trip counts by hour of day |
| `GET /api/trips/by-day` | Trip counts by day of week |
| `GET /api/trips/by-payment` | Trip counts by payment type |
| `GET /api/trips/airport-vs-city` | Airport vs city trip comparison |
| `GET /api/trips/fare-distribution` | Fare amount histogram data |
| `GET /api/trips/by-borough` | Trip stats per borough |
| `GET /api/trips/by-borough?borough=Manhattan` | Trip stats for one borough |
| `GET /api/zones/` | All 263 taxi zones |
| `GET /api/zones/boroughs` | List of borough names |
| `GET /api/zones/top-pickup` | Top 10 busiest pickup zones |
| `GET /api/zones/top-dropoff` | Top 10 busiest dropoff zones |