"""
routes/trips.py
Endpoints for trip-related queries.
All routes here are prefixed with /api/trips (set in app.py)
"""

from flask import Blueprint, jsonify, request
import sys
import os

# Add parent directory to path so we can import config.py
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import get_db_connection

# Create the Blueprint
trips_bp = Blueprint("trips", __name__)


# -------------------------------------------------------------
#  GET /api/trips/summary
#  Returns high-level stats about the entire dataset.
#  This is what the frontend dashboard header cards will show —
#  total trips, average fare, average distance, average duration.
# -------------------------------------------------------------
@trips_bp.route("/summary", methods=["GET"])
def get_summary():
    conn   = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            COUNT(*)                                    AS total_trips,
            ROUND(AVG(fare_amount)::numeric, 2)         AS avg_fare,
            ROUND(AVG(trip_distance)::numeric, 2)       AS avg_distance_miles,
            ROUND(AVG(trip_duration_min)::numeric, 2)   AS avg_duration_min,
            ROUND(AVG(avg_speed_mph)::numeric, 2)       AS avg_speed_mph,
            SUM(CASE WHEN is_airport_trip THEN 1 ELSE 0 END) AS airport_trips
        FROM trips
    """)

    summary = dict(cursor.fetchone())
    cursor.close()
    conn.close()

    return jsonify({
        "status" : "success",
        "data"   : summary
    })


# -------------------------------------------------------------
#  GET /api/trips/by-hour
#  Returns trip count and average fare grouped by hour of day.
#  This powers the rush hour analysis chart on the frontend.
#  Shows which hours of the day are busiest for taxi demand.
# -------------------------------------------------------------
@trips_bp.route("/by-hour", methods=["GET"])
def get_trips_by_hour():
    conn   = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            pickup_hour                                 AS hour,
            COUNT(*)                                    AS trip_count,
            ROUND(AVG(fare_amount)::numeric, 2)         AS avg_fare,
            ROUND(AVG(trip_duration_min)::numeric, 2)   AS avg_duration_min
        FROM trips
        GROUP BY pickup_hour
        ORDER BY pickup_hour
    """)

    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    return jsonify({
        "status" : "success",
        "data"   : [dict(row) for row in rows]
    })


# -------------------------------------------------------------
#  GET /api/trips/by-day
#  Returns trip count grouped by day of week.
#  0 = Monday, 6 = Sunday.
#  Shows weekly demand patterns — are weekends busier?
# -------------------------------------------------------------
@trips_bp.route("/by-day", methods=["GET"])
def get_trips_by_day():
    conn   = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            pickup_dow                                  AS day_of_week,
            COUNT(*)                                    AS trip_count,
            ROUND(AVG(fare_amount)::numeric, 2)         AS avg_fare,
            ROUND(AVG(trip_distance)::numeric, 2)       AS avg_distance_miles
        FROM trips
        GROUP BY pickup_dow
        ORDER BY pickup_dow
    """)

    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    # Map day numbers to names for readability
    day_names = {
        0: "Monday", 1: "Tuesday", 2: "Wednesday",
        3: "Thursday", 4: "Friday", 5: "Saturday", 6: "Sunday"
    }

    result = []
    for row in rows:
        r = dict(row)
        r["day_name"] = day_names.get(r["day_of_week"], "Unknown")
        result.append(r)

    return jsonify({
        "status" : "success",
        "data"   : result
    })


# -------------------------------------------------------------
#  GET /api/trips/by-payment
#  Returns trip count and average tip percentage grouped
#  by payment type. Only shows tip_percentage for card payments
#  (where it is not NULL) — consistent with the cleaning decision.
# -------------------------------------------------------------
@trips_bp.route("/by-payment", methods=["GET"])
def get_trips_by_payment():
    conn   = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            pt.payment_type_name,
            COUNT(*)                                        AS trip_count,
            ROUND(AVG(t.fare_amount)::numeric, 2)           AS avg_fare,
            ROUND(AVG(t.tip_percentage)::numeric, 2)        AS avg_tip_percentage
        FROM trips t
        JOIN payment_types pt ON t.payment_type_id = pt.payment_type_id
        GROUP BY pt.payment_type_name
        ORDER BY trip_count DESC
    """)

    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    return jsonify({
        "status" : "success",
        "data"   : [dict(row) for row in rows]
    })


# -------------------------------------------------------------
#  GET /api/trips/airport-vs-city
#  Compares airport trips vs non-airport trips across
#  key metrics: fare, distance, duration, tip percentage.
#  This is one of the meaningful insights the frontend can show.
# -------------------------------------------------------------
@trips_bp.route("/airport-vs-city", methods=["GET"])
def get_airport_vs_city():
    conn   = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            is_airport_trip,
            COUNT(*)                                        AS trip_count,
            ROUND(AVG(fare_amount)::numeric, 2)             AS avg_fare,
            ROUND(AVG(trip_distance)::numeric, 2)           AS avg_distance_miles,
            ROUND(AVG(trip_duration_min)::numeric, 2)       AS avg_duration_min,
            ROUND(AVG(tip_percentage)::numeric, 2)          AS avg_tip_percentage
        FROM trips
        GROUP BY is_airport_trip
        ORDER BY is_airport_trip DESC
    """)

    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    # Make the boolean more readable
    result = []
    for row in rows:
        r = dict(row)
        r["trip_type"] = "Airport" if r["is_airport_trip"] else "City"
        result.append(r)

    return jsonify({
        "status" : "success",
        "data"   : result
    })


# -------------------------------------------------------------
#  GET /api/trips/fare-distribution
#  Returns fare amount bucketed into ranges for a histogram.
#  Shows the distribution of fares across all trips.
# -------------------------------------------------------------
@trips_bp.route("/fare-distribution", methods=["GET"])
def get_fare_distribution():
    conn   = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            CASE
                WHEN fare_amount < 5   THEN '$0-5'
                WHEN fare_amount < 10  THEN '$5-10'
                WHEN fare_amount < 15  THEN '$10-15'
                WHEN fare_amount < 20  THEN '$15-20'
                WHEN fare_amount < 30  THEN '$20-30'
                WHEN fare_amount < 50  THEN '$30-50'
                ELSE '$50+'
            END                         AS fare_range,
            COUNT(*)                    AS trip_count
        FROM trips
        GROUP BY fare_range
        ORDER BY MIN(fare_amount)
    """)

    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    return jsonify({
        "status" : "success",
        "data"   : [dict(row) for row in rows]
    })


# -------------------------------------------------------------
#  GET /api/trips/by-borough?borough=Manhattan
#  Returns trip stats filtered by pickup borough.
#  The borough query parameter is optional — if not provided,
#  returns stats for all boroughs.
# -------------------------------------------------------------
@trips_bp.route("/by-borough", methods=["GET"])
def get_trips_by_borough():
    borough = request.args.get("borough")  # e.g. ?borough=Manhattan

    conn   = get_db_connection()
    cursor = conn.cursor()

    if borough:
        cursor.execute("""
            SELECT
                z.borough,
                COUNT(*)                                    AS trip_count,
                ROUND(AVG(t.fare_amount)::numeric, 2)       AS avg_fare,
                ROUND(AVG(t.trip_distance)::numeric, 2)     AS avg_distance_miles,
                ROUND(AVG(t.trip_duration_min)::numeric, 2) AS avg_duration_min
            FROM trips t
            JOIN zones z ON t.pu_location_id = z.location_id
            WHERE z.borough = %s
            GROUP BY z.borough
        """, (borough,))
    else:
        cursor.execute("""
            SELECT
                z.borough,
                COUNT(*)                                    AS trip_count,
                ROUND(AVG(t.fare_amount)::numeric, 2)       AS avg_fare,
                ROUND(AVG(t.trip_distance)::numeric, 2)     AS avg_distance_miles,
                ROUND(AVG(t.trip_duration_min)::numeric, 2) AS avg_duration_min
            FROM trips t
            JOIN zones z ON t.pu_location_id = z.location_id
            GROUP BY z.borough
            ORDER BY trip_count DESC
        """)

    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    return jsonify({
        "status" : "success",
        "data"   : [dict(row) for row in rows]
    })