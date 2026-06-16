const API_BASE = "http://localhost:5000/api";
const charts = {};

async function fetchData(endpoint) {
  const response = await fetch(`${API_BASE}/${endpoint}`);
  const json = await response.json();
  return json.data;
}

async function loadSummary() {
  const data = await fetchData("trips/summary");
  document.getElementById("totalTrips").textContent = Number(data.total_trips).toLocaleString();
  document.getElementById("avgFare").textContent = "$" + Number(data.avg_fare).toFixed(2);
  document.getElementById("avgDistance").textContent = Number(data.avg_distance_miles).toFixed(1) + " mi";
  document.getElementById("avgDuration").textContent = Number(data.avg_duration_min).toFixed(1) + " min";
  document.getElementById("airportTrips").textContent = Number(data.airport_trips).toLocaleString();
  const speedMph = Number(data.avg_speed_mph);
  const speedKmh = (speedMph * 1.609).toFixed(1);
  document.getElementById("avgSpeed").textContent = `Average Speed: ${speedMph.toFixed(1)} mph / ${speedKmh} km/h`;
}

loadSummary();

async function loadTripPatterns(view = "hour") {
  const endpoint = view === "hour" ? "trips/by-hour" : "trips/by-day";
  const data = await fetchData(endpoint);
  const labels = view === "hour"
    ? data.map(d => `${String(d.hour).padStart(2, "0")}:00`)
    : data.map(d => d.day_name);
  const counts = data.map(d => d.trip_count);

  if (charts.tripPattern) charts.tripPattern.destroy();
  const ctx = document.getElementById("tripPatternChart").getContext("2d");
  charts.tripPattern = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [{
        label: "Trips",
        data: counts,
        backgroundColor: "#1a7a4a99",
        borderColor: "#1a7a4a",
        borderWidth: 1
      }]
    },
    options: { responsive: true }
  });
}

document.getElementById("tripPatternSelect").addEventListener("change", function() {
  loadTripPatterns(this.value);
});

loadTripPatterns();

async function loadFarePayment(view = "fare") {
  if (view === "fare") {
    const data = await fetchData("trips/fare-distribution");
    const labels = data.map(d => d.fare_range);
    const counts = data.map(d => d.trip_count);

    if (charts.farePayment) charts.farePayment.destroy();
    const ctx = document.getElementById("farePaymentChart").getContext("2d");
    charts.farePayment = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [{
          label: "Trips",
          data: counts,
          backgroundColor: "#f5c51899",
          borderColor: "#f5c518",
          borderWidth: 1
        }]
      },
      options: { responsive: true }
    });
  } else {
    const data = await fetchData("trips/by-payment");
    const labels = data.map(d => d.payment_type_name);
    const counts = data.map(d => d.trip_count);

    if (charts.farePayment) charts.farePayment.destroy();
    const ctx = document.getElementById("farePaymentChart").getContext("2d");
    charts.farePayment = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: labels,
        datasets: [{
          data: counts,
          backgroundColor: ["#1a7a4a", "#f5c518", "#4e9af1", "#ff6b6b"]
        }]
      },
      options: { responsive: true }
    });
  }
}

document.getElementById("farePaymentSelect").addEventListener("change", function() {
  loadFarePayment(this.value);
});

loadFarePayment();

async function loadTopZones() {
  const data = await fetchData("zones/top-pickup");
  const labels = data.map(d => d.zone);
  const counts = data.map(d => d.trip_count);

  if (charts.topZones) charts.topZones.destroy();
  const ctx = document.getElementById("topZonesChart").getContext("2d");
  charts.topZones = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [{
        label: "Pickups",
        data: counts,
        backgroundColor: "#1a7a4a99",
        borderColor: "#1a7a4a",
        borderWidth: 1
      }]
    },
    options: {
      indexAxis: "y",
      responsive: true
    }
  });
}

loadTopZones();

async function loadAirportChart() {
  const data = await fetchData("trips/airport-vs-city");
  const labels = data.map(d => d.trip_type);
  const counts = data.map(d => d.trip_count);
  const fares = data.map(d => d.avg_fare);

  if (charts.airport) charts.airport.destroy();
  const ctx = document.getElementById("airportChart").getContext("2d");
  charts.airport = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Trip Count",
          data: counts,
          backgroundColor: "#1a7a4a99",
          borderColor: "#1a7a4a",
          borderWidth: 1
        },
        {
          label: "Average Fare ($)",
          data: fares,
          backgroundColor: "#f5c51899",
          borderColor: "#f5c518",
          borderWidth: 1
        }
      ]
    },
    options: { responsive: true }
  });
}

loadAirportChart();

let map = null;

async function loadMap() {
  const geojson = await fetch("data/taxi_zones.geojson").then(r => r.json());

  let tripDensity = {};
  try {
    const zoneData = await fetchData("zones/top-pickup");
    zoneData.forEach(z => { tripDensity[z.location_id] = z.trip_count; });
  } catch (err) {
    console.warn("API offline, map loads without trip density colors");
  }

  const counts = Object.values(tripDensity);
  const max = Math.max(...counts);

  function getColor(count) {
    if (max === 0 || count === 0) return "transparent";
    const ratio = count / max;
    if (ratio > 0.8) return "#e63946";
    if (ratio > 0.6) return "#f4722b";
    if (ratio > 0.4) return "#f5c518";
    if (ratio > 0.2) return "#2ecc71";
    return "#cccccc";
  }

  if (!map) {
    map = L.map("map").setView([40.7128, -74.006], 12);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png", {
      attribution: "OpenStreetMap, CartoDB",
      maxZoom: 19
    }).addTo(map);

    const legend = L.control({ position: "bottomright" });
    legend.onAdd = function() {
      const div = L.DomUtil.create("div", "map-legend");
      div.innerHTML = `
        <strong>Trip Density</strong><br>
        <span style="background:#e63946"></span> Very High<br>
        <span style="background:#f4722b"></span> High<br>
        <span style="background:#f5c518"></span> Medium<br>
        <span style="background:#2ecc71"></span> Low<br>
        <span style="background:#cccccc"></span> Minimal
      `;
      return div;
    };
    legend.addTo(map);
  }

  L.geoJSON(geojson, {
    style: feature => {
      const id = feature.properties.LocationID;
      const count = tripDensity[id] || 0;
      const fillColor = getColor(count);
      return {
        fillColor: fillColor,
        fillOpacity: fillColor === "transparent" ? 0 : 0.45,
        color: fillColor === "transparent" ? "transparent" : "#999",
        weight: 0.5
      };
    },
    onEachFeature: (feature, layer) => {
      const zone = feature.properties.zone || "Unknown";
      const borough = feature.properties.borough || "Unknown";
      const id = feature.properties.LocationID;
      const count = tripDensity[id] || 0;
      layer.bindTooltip(`<strong>${zone}</strong><br>Borough: ${borough}<br>Trips: ${count.toLocaleString()}`);
      layer.bindPopup(`
        <strong>${zone}</strong><br>
        Borough: ${borough}<br>
        Total Trips: ${count.toLocaleString()}<br>
        Zone ID: ${id}
      `);
    }
  }).addTo(map);

  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png", {
    attribution: "OpenStreetMap, CartoDB",
    maxZoom: 19,
    pane: "shadowPane"
  }).addTo(map);
}

loadMap();

async function loadBoroughs() {
  const data = await fetchData("zones/");
  const select = document.getElementById("boroughFilter");
  const boroughs = [...new Set(data.map(z => z.borough))].sort();
  boroughs.forEach(b => {
    const option = document.createElement("option");
    option.value = b;
    option.textContent = b;
    select.appendChild(option);
  });
}

document.getElementById("boroughFilter").addEventListener("change", async function() {
  if (this.value === "all") {
    loadSummary();
    return;
  }
  const data = await fetchData(`trips/by-borough?borough=${encodeURIComponent(this.value)}`);
  document.getElementById("totalTrips").textContent = Number(data[0]?.trip_count || 0).toLocaleString();
  document.getElementById("avgFare").textContent = "$" + Number(data[0]?.avg_fare || 0).toFixed(2);
  document.getElementById("avgDistance").textContent = Number(data[0]?.avg_distance_miles || 0).toFixed(1) + " mi";
  document.getElementById("avgDuration").textContent = Number(data[0]?.avg_duration_min || 0).toFixed(1) + " min";
});

document.getElementById("resetBtn").addEventListener("click", function() {
  document.getElementById("boroughFilter").value = "all";
  document.getElementById("paymentFilter").value = "all";
  loadSummary();
  loadTripPatterns();
  loadFarePayment();
  loadTopZones();
  loadAirportChart();
  loadMap();
});

loadBoroughs();
