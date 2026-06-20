# Urban Mobility Data Explorer — Team 1

## Table of Contents

- [Project Overview](#project-overview)
- [Features](#features)
  - [Data Cleaning Pipeline](#data-cleaning-pipeline)
  - [Feature Engineering](#feature-engineering)
  - [Database Design](#database-design)
  - [REST API](#rest-api)
  - [Interactive Dashboard](#interactive-dashboard)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Dataset Source](#dataset-source)
- [Database Configuration](#database-configuration)
  - [SSL Configuration](#ssl-configuration)
- [Optional: VS Code Database Connection](#optional-vs-code-database-connection)
- [Running the Project](#running-the-project)
  - [Option 1: Local Deployment (Recommended)](#option-1-local-deployment-recommended)
  - [Option 2: Render Deployment](#option-2-render-deployment)
- [System Architecture](#system-architecture)
- [Entity Relationship Diagram](#entity-relationship-diagram)
- [Video Walkthrough](#video-walkthrough)
- [Deliverables](#deliverables)
- [Important Notes](#important-notes)
- [Summary](#summary)

## Team Members
| Name     | Role |
| -------- | ---- |
| Aduk Mathiang Ngut Nyang | FRONTEND DEV |
| Ntwali Beni David | DATA ENGINEER |
| Bol David Garang Dau | INTEGRATION & STORY |
| Ojudun Ayomide Oluwatimilehin | BACKEND/DBA |

---

## Project Overview

Urban Mobility Data Explorer is a full-stack data analytics platform built using real-world NYC Taxi & Limousine Commission (TLC) data.

The system ingests, cleans, stores, and analyzes urban transportation data to uncover patterns in mobility, trip demand, and trip economics. Results are presented through a REST API and an interactive geospatial dashboard.

---

## Features

### Data Cleaning Pipeline

The data pipeline follows these stages:

1. Load raw TLC datasets
2. Clean invalid or incomplete records
3. Log excluded records
4. Engineer analytical features
5. Load data into PostgreSQL
6. Serve insights through APIs and dashboard visualizations

Excluded logs are recorded in:

```text
cleaning/logs/cleaning_log.txt
```

### Feature Engineering

The system generates additional analytical features including:

* Trip duration (minutes)
* Average speed (mph)
* Tip percentage
* Pickup hour

### Database Design

The project uses a normalized PostgreSQL schema consisting of:

* Fact table: `trips`
* Dimension tables:

  * `zones`
  * `payments`
  * `rate_codes`
  * Other supporting lookup tables

Referential integrity is enforced through foreign keys.

### REST API

The Flask backend provides:

* Trip data endpoints
* Zone information endpoints
* Insight and analytics endpoints
* Filtered queries

### API Endpoints

```http
GET /api/trips

GET /api/zones

GET /api/insights/top-zones

GET /api/insights/hourly-demand
```

### Interactive Dashboard

The frontend includes:

* Interactive map using Leaflet
* Data visualizations using Chart.js
* Dynamic filtering by time and location
* Geospatial zone analysis


## Technology Stack

| Layer           | Technology                      |
| --------------- | ------------------------------- |
| Backend         | Python 3, Flask                 |
| Database        | PostgreSQL (Aiven Cloud)        |
| Database Driver | psycopg2-binary                 |
| Frontend        | HTML5, CSS3, Vanilla JavaScript |
| Mapping         | Leaflet.js                      |
| Data Processing | Python ETL Pipeline             |

---

## Project Structure

```text
.
├── README.md
├── backend
│   ├── __pycache__
│   │   └── config.cpython-312.pyc
│   ├── api
│   │   ├── api_readme.md
│   │   ├── app.py
│   │   ├── requirements.txt
│   │   └── routes
│   │       ├── __pycache__
│   │       │   ├── trips.cpython-312.pyc
│   │       │   └── zones.cpython-312.pyc
│   │       ├── trips.py
│   │       └── zones.py
│   ├── config.py
│   ├── db
│   │   ├── ca.pem
│   │   ├── check_fk_values.py
│   │   ├── load_trips.py
│   │   ├── schema.sql
│   │   └── seed_lookup.sql
│   ├── db_changelog.md
│   └── technical_reflection.md
├── cleaning
│   ├── TECHNICAL_REPORT.md
│   ├── data
│   │   ├── clean
│   │   └── raw
│   ├── logs
│   │   └── cleaning_log.txt
│   └── src
│       ├── clean.py
│       └── top_10_zones.py
├── diagrams
│   ├──system_acrhitecture_diagram.pdf
│   └──entity_relationship_diagram.pdf
├── frontend
│   ├── assets
│   │   ├── Aduk.jpeg
│   │   ├── Ayomide.jpeg
│   │   ├── Beni.jpeg
│   │   └── Bol.jpeg
│   ├── css
│   │   ├── index.css
│   │   └── main.css
│   ├── data
│   │   └── taxi_zones.geojson
│   ├── index.html
│   ├── js
│   │   └── app.js
│   └── main.html
├── package-lock.json
└── requirements.txt
```

---

## Dataset Source

Download the required datasets from:

https://www.nyc.gov/site/tlc/about/tlc-trip-record-data.page

Required files:

1. Yellow Taxi Trip Data (Parquet)
2. Taxi Zone Lookup (CSV)
3. Taxi Zones Spatial Data (GeoJSON or SHP)

---

## Database Configuration

Database credentials are not included in this repository.

The following must be valid values that you can either create on your own or obtain them from the team:

```python
backend/config.py
```

```python
DB_HOST = "your_host"
DB_PORT = "db_port"
DB_USER = "your_username"
DB_PASSWORD = "your_password"
DB_NAME = "your_database"
```

### SSL Configuration

Aiven PostgreSQL requires SSL-enabled connections.

Obtain the database certificate file (for example, `ca.pem`) and store it locally.

Update the connection configuration:

```python
sslmode = "require"
sslrootcert = "/path/to/ca.pem"
```

Do not commit certificate files or credentials to GitHub.

---

## Optional: VS Code Database Connection

Install the PostgreSQL (Database Client) extension and configure:

* Host
* Port
* Username
* Password
* Database Name

Enable:

```text
SSL = ON
```

Provide the path to the SSL certificate when prompted.

---

### Running the Project

### Option 1: Local Deployment (Recommended)

This is the recommended method for its simplicity.

### Step 1: Start the Backend

```bash
cd backend/api

pip3 install -r requirements.txt --break-system-packages

python3 app.py
```

Backend URL:

```text
http://127.0.0.1:5000
```

### Step 2: Start the Frontend

Open a second terminal:

```bash
cd frontend

python3 -m http.server 3000
```

Frontend URL:

```text
http://localhost:3000
```

#### Advantages

* Easy setup
* Reliable execution
* Suitable for evaluation and demonstrations

---

### Option 2: Render Deployment

For cloud hosting and public access.

#### Step 1: Push Project to GitHub

Commit and push the repository.

#### Step 2: Create a Render Service

Visit:

https://render.com

Create a new web service and connect the GitHub repository.

#### Step 3: Configure the Service

```text
Runtime: Python
Root Directory: backend/api

Build Command:
pip install -r requirements.txt

Start Command:
python app.py
```

#### Step 4: Configure Environment Variables

Add:

```text
DB_HOST
DB_PORT
DB_USER
DB_PASSWORD
DB_NAME
```

#### SSL Note

Since Aiven uses SSL certificates, additional certificate configuration may be required when deploying on Render.

---


## System Architecture

```text
assets/architecture.png
```

---

## Entity Relationship Diagram

```text
assets/erd.png
```

---

## Video Walkthrough

```text
https://youtu.be/E1JXXKbDgl8
```

---

## Deliverables

* Backend API
* PostgreSQL database schema
* Data cleaning pipeline
* Data loading process
* Interactive dashboard
* Technical report
* Video walkthrough
* Team participation documentation

---

## Important Notes

* Database credentials are not included in the repository.
* SSL certificates are required for Aiven PostgreSQL connections.
* Datasets must be downloaded manually.
* Verify all file paths before execution.
* The backend must be running before accessing the frontend.

---

## Summary

This project demonstrates:

* Real-world data preprocessing
* ETL pipeline development
* Relational database design
* REST API development
* Interactive data visualization
* Urban mobility analytics

