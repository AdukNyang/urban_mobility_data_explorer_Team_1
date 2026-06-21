"""
app.py
Flask application entry point.
Creates the app, registers route blueprints, and runs the server.

Run: python api/app.py
"""

import sys
import os

# Add the backend/ directory to Python's path so that config.py
# can be found regardless of which directory you run the app from
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask
from flask_cors import CORS

from routes.trips import trips_bp
from routes.zones import zones_bp

# -------------------------------------------------------------
#  Create the Flask app
# -------------------------------------------------------------
app = Flask(__name__)

# CORS (Cross-Origin Resource Sharing) allows the frontend
# to call this API from a different port or domain.
# Without this, the browser would block frontend requests to
# the API as a security measure.
CORS(app, origins=[
    "http://localhost:5500",
    "http://localhost:5000",
    "http://127.0.0.1:5500",
    "https://urban-mobility-data-explorer-team-1.onrender.com",
    "https://urban-mobility-data-explorer-team-1-1.onrender.com"
])


# -------------------------------------------------------------
#  Register Blueprints
#  A Blueprint is a group of related routes.
#  url_prefix means all trips routes start with /api/trips
#  and all zones routes start with /api/zones.
# -------------------------------------------------------------
app.register_blueprint(trips_bp, url_prefix="/api/trips")
app.register_blueprint(zones_bp, url_prefix="/api/zones")


# -------------------------------------------------------------
#  Health check route
#  A simple endpoint to confirm the API is running.
#  Visit http://localhost:5000/api/health in your browser
#  to verify everything is working.
# -------------------------------------------------------------
@app.route("/api/health")
def health():
    return {"status": "ok", "message": "NYC Taxi API is running"}


# -------------------------------------------------------------
#  Run the server
# -------------------------------------------------------------
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=False, host="0.0.0.0", port=port)