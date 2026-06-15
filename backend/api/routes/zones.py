"""
routes/zones.py
Endpoints for zone-related queries.
All routes here are prefixed with /api/zones (set in app.py)
"""

from flask import Blueprint, jsonify
import sys
import os

# Add parent directory to path so we can import config.py
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import get_db_connection

# Create the Blueprint
zones_bp = Blueprint("zones", __name__)


# -------------------------------------------------------------
#  GET /api/zones
#  Returns all 263 valid NYC taxi zones.
#  The frontend uses this to populate dropdown filters.
# -------------------------------------------------------------
@zones_bp.route("/", methods=["GET"])
def get_all_zones():
    conn   = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT location_id, borough, zone, service_zone
        FROM zones
        ORDER BY borough, zone
    """)

    zones = cursor.fetchall()
    cursor.close()
    conn.close()

    return jsonify({
        "status"  : "success",
        "count"   : len(zones),
        "data"    : [dict(row) for row in zones]
    })


# -------------------------------------------------------------
#  GET /api/zones/boroughs
#  Returns a list of unique boroughs.
#  Useful for the frontend borough filter dropdown.
# -------------------------------------------------------------
@zones_bp.route("/boroughs", methods=["GET"])
def get_boroughs():
    conn   = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT DISTINCT borough
        FROM zones
        ORDER BY borough
    """)

    boroughs = [row["borough"] for row in cursor.fetchall()]
    cursor.close()
    conn.close()

    return jsonify({
        "status" : "success",
        "data"   : boroughs
    })


# -------------------------------------------------------------
#  GET /api/zones/top-pickup
#  Returns the top 10 busiest pickup zones by trip count.
#  This is the database-powered version of your teammate's
#  MinHeap algorithm — the same insight, served via the API.
# -------------------------------------------------------------
@zones_bp.route("/top-pickup", methods=["GET"])
def get_top_pickup_zones():
    conn   = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            z.location_id,
            z.zone,
            z.borough,
            COUNT(*) AS trip_count
        FROM trips t
        JOIN zones z ON t.pu_location_id = z.location_id
        GROUP BY z.location_id, z.zone, z.borough
        ORDER BY trip_count DESC
        LIMIT 10
    """)

    zones = cursor.fetchall()
    cursor.close()
    conn.close()

    return jsonify({
        "status" : "success",
        "data"   : [dict(row) for row in zones]
    })


# -------------------------------------------------------------
#  GET /api/zones/top-dropoff
#  Returns the top 10 busiest dropoff zones by trip count.
# -------------------------------------------------------------
@zones_bp.route("/top-dropoff", methods=["GET"])
def get_top_dropoff_zones():
    conn   = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            z.location_id,
            z.zone,
            z.borough,
            COUNT(*) AS trip_count
        FROM trips t
        JOIN zones z ON t.do_location_id = z.location_id
        GROUP BY z.location_id, z.zone, z.borough
        ORDER BY trip_count DESC
        LIMIT 10
    """)

    zones = cursor.fetchall()
    cursor.close()
    conn.close()

    return jsonify({
        "status" : "success",
        "data"   : [dict(row) for row in zones]
    })