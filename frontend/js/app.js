// Base API URL — Flask backend hosted on Render
const API_BASE = "https://nyc-mobility.<school-domain>/api";

// Chart instances (kept to allow destroy/re-render on filter)
const charts = {};

// ─── Placeholder data (replace with API calls when backend is ready) ───
const PLACEHOLDER = {
  kpis: {
    totalTrips: 6_956_120,
    avgFare: 13.52,
    avgDistance: 2.89,
    avgDuration: 11.4,
    airportTrips: 312_450,
  },
  tripsByHour: [
    18200, 12400, 9800, 8500, 9200, 14600, 28000, 48000, 52000, 44000,
    40000, 42000, 46000, 44000, 42000, 43000, 50000, 58000, 62000, 60000,
    54000, 46000, 38000, 28000,
  ],
  paymentTypes: {
    labels: ["Credit Card", "Cash", "No Charge", "Dispute"],
    data: [4800000, 2000000, 80000, 76120],
  },
  fareDist: {
    labels: ["$0-5", "$5-10", "$10-15", "$15-20", "$20-30", "$30-50", "$50+"],
    data: [120000, 1800000, 2100000, 1200000, 900000, 600000, 236120],
  },
  tripsByDow: {
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    data: [980000, 1020000, 1050000, 1100000, 1200000, 920000, 686120],
  },
  topZones: {
    labels: [
      "Midtown Center", "Upper East Side N", "Times Sq/Theatre District",
      "Penn Station/Madison Sq West", "Upper East Side S", "Lincoln Square E",
      "Murray Hill", "Clinton East", "East Village", "Lower East Side",
    ],
    data: [312000, 289000, 267000, 245000, 230000, 218000, 205000, 198000, 187000, 175000],
  },
  speedByHour: [
    18, 22, 24, 25, 23, 18, 14, 10, 9, 11,
    13, 14, 13, 13, 14, 13, 11, 10, 11, 12,
    13, 15, 16, 17,
  ],
};

// ─── Populate hour filter dropdown ───
function buildHourFilter() {
  const sel = document.getElementById("hourFilter");
  for (let h = 0; h < 24; h++) {
    const opt = document.createElement("option");
    opt.value = h;
    opt.textContent = `${String(h).padStart(2, "0")}:00`;
    sel.appendChild(opt);
  }
}

// ─── KPI helpers ───
function fmt(n) { return Number(n).toLocaleString(); }
function fmtDollar(n) { return "$" + Number(n).toFixed(2); }
function fmtDecimal(n) { return Number(n).toFixed(1); }

function renderKPIs(data) {
  document.getElementById("totalTrips").textContent   = fmt(data.totalTrips);
  document.getElementById("avgFare").textContent      = fmtDollar(data.avgFare);
  document.getElementById("avgDistance").textContent  = fmtDecimal(data.avgDistance);
  document.getElementById("avgDuration").textContent  = fmtDecimal(data.avgDuration);
  document.getElementById("airportTrips").textContent = fmt(data.airportTrips);
}

// ─── Chart factory ───
const CHART_DEFAULTS = {
  color: "#e0e0e0",
  grid: "#2a2d3a",
  accent: "#f5c518",
  plugins: { legend: { labels: { color: "#aaa" } } },
};

function makeChart(id, config) {
  if (charts[id]) charts[id].destroy();
  const ctx = document.getElementById(id).getContext("2d");
  charts[id] = new Chart(ctx, config);
}

function renderTripsByHour(data) {
  const labels = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:00`);
  makeChart("tripsByHourChart", {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Trips",
        data,
        backgroundColor: "#f5c518aa",
        borderColor: "#f5c518",
        borderWidth: 1,
      }],
    },
    options: {
      responsive: true,
      plugins: CHART_DEFAULTS.plugins,
      scales: {
        x: { ticks: { color: "#888" }, grid: { color: CHART_DEFAULTS.grid } },
        y: { ticks: { color: "#888" }, grid: { color: CHART_DEFAULTS.grid } },
      },
    },
  });
}

function renderPaymentChart(data) {
  makeChart("paymentChart", {
    type: "doughnut",
    data: {
      labels: data.labels,
      datasets: [{
        data: data.data,
        backgroundColor: ["#f5c518", "#4e9af1", "#44d7a8", "#ff6b6b"],
      }],
    },
    options: {
      responsive: true,
      plugins: CHART_DEFAULTS.plugins,
    },
  });
}

function renderFareDist(data) {
  makeChart("fareDistChart", {
    type: "bar",
    data: {
      labels: data.labels,
      datasets: [{
        label: "Trips",
        data: data.data,
        backgroundColor: "#4e9af1aa",
        borderColor: "#4e9af1",
        borderWidth: 1,
      }],
    },
    options: {
      responsive: true,
      plugins: CHART_DEFAULTS.plugins,
      scales: {
        x: { ticks: { color: "#888" }, grid: { color: CHART_DEFAULTS.grid } },
        y: { ticks: { color: "#888" }, grid: { color: CHART_DEFAULTS.grid } },
      },
    },
  });
}

function renderTripsByDow(data) {
  makeChart("tripsByDowChart", {
    type: "line",
    data: {
      labels: data.labels,
      datasets: [{
        label: "Trips",
        data: data.data,
        borderColor: "#44d7a8",
        backgroundColor: "#44d7a820",
        fill: true,
        tension: 0.4,
        pointBackgroundColor: "#44d7a8",
      }],
    },
    options: {
      responsive: true,
      plugins: CHART_DEFAULTS.plugins,
      scales: {
        x: { ticks: { color: "#888" }, grid: { color: CHART_DEFAULTS.grid } },
        y: { ticks: { color: "#888" }, grid: { color: CHART_DEFAULTS.grid } },
      },
    },
  });
}

function renderTopZones(data) {
  makeChart("topZonesChart", {
    type: "bar",
    data: {
      labels: data.labels,
      datasets: [{
        label: "Pickups",
        data: data.data,
        backgroundColor: "#ff6b6baa",
        borderColor: "#ff6b6b",
        borderWidth: 1,
      }],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      plugins: CHART_DEFAULTS.plugins,
      scales: {
        x: { ticks: { color: "#888" }, grid: { color: CHART_DEFAULTS.grid } },
        y: { ticks: { color: "#ccc" }, grid: { color: CHART_DEFAULTS.grid } },
      },
    },
  });
}

function renderSpeedByHour(data) {
  const labels = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:00`);
  makeChart("speedByHourChart", {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Avg Speed (mph)",
        data,
        borderColor: "#a78bfa",
        backgroundColor: "#a78bfa20",
        fill: true,
        tension: 0.4,
        pointBackgroundColor: "#a78bfa",
      }],
    },
    options: {
      responsive: true,
      plugins: CHART_DEFAULTS.plugins,
      scales: {
        x: { ticks: { color: "#888" }, grid: { color: CHART_DEFAULTS.grid } },
        y: { ticks: { color: "#888" }, grid: { color: CHART_DEFAULTS.grid } },
      },
    },
  });
}

// ─── Derive KPIs from raw trips array ───
function deriveKPIs(trips) {
  if (!Array.isArray(trips) || trips.length === 0) return PLACEHOLDER.kpis;
  const total = trips.length;
  const avgFare = trips.reduce((s, t) => s + (t.fare_amount ?? 0), 0) / total;
  const avgDistance = trips.reduce((s, t) => s + (t.trip_distance ?? 0), 0) / total;
  const avgDuration = trips.reduce((s, t) => s + (t.trip_duration_min ?? 0), 0) / total;
  const airportTrips = trips.filter(t => t.is_airport_trip).length;
  return { totalTrips: total, avgFare, avgDistance, avgDuration, airportTrips };
}

// ─── Derive payment breakdown from trips ───
function derivePaymentData(trips) {
  if (!Array.isArray(trips) || trips.length === 0) return PLACEHOLDER.paymentTypes;
  const counts = [1, 2, 3, 4].map(type => trips.filter(t => t.payment_type === type).length);
  return { labels: ["Credit Card", "Cash", "No Charge", "Dispute"], data: counts };
}

// ─── Derive fare distribution buckets ───
function deriveFareDist(trips) {
  if (!Array.isArray(trips) || trips.length === 0) return PLACEHOLDER.fareDist;
  const buckets = [0, 0, 0, 0, 0, 0, 0];
  const edges = [5, 10, 15, 20, 30, 50];
  trips.forEach(t => {
    const f = t.fare_amount ?? 0;
    let i = 0;
    while (i < edges.length && f > edges[i]) i++;
    buckets[i]++;
  });
  return {
    labels: ["$0-5", "$5-10", "$10-15", "$15-20", "$20-30", "$30-50", "$50+"],
    data: buckets,
  };
}

// ─── Derive trips by day of week ───
function deriveDowData(trips) {
  if (!Array.isArray(trips) || trips.length === 0) return PLACEHOLDER.tripsByDow;
  const counts = [0, 0, 0, 0, 0, 0, 0];
  trips.forEach(t => {
    const dow = t.pickup_dow;
    if (dow >= 0 && dow <= 6) counts[dow]++;
  });
  return { labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], data: counts };
}

// ─── Fetch from API (with fallback to placeholder) ───
async function fetchData(filters = {}) {
  const params = new URLSearchParams();
  if (filters.hour && filters.hour !== "all") params.append("hour", filters.hour);
  if (filters.payment && filters.payment !== "all") params.append("payment_type", filters.payment);
  if (filters.airport && filters.airport !== "all") params.append("is_airport_trip", filters.airport);

  try {
    const [hourly, zones, topZones, trips] = await Promise.all([
      fetch(`${API_BASE}/insights/hourly-demand?${params}`).then(r => r.json()),
      fetch(`${API_BASE}/zones`).then(r => r.json()),
      fetch(`${API_BASE}/insights/top-zones?${params}`).then(r => r.json()),
      fetch(`${API_BASE}/trips?${params}`).then(r => r.json()),
    ]);

    // Map API responses to chart-ready format
    // Adjust these field names to match your backend's actual JSON keys
    return {
      kpis: deriveKPIs(trips),
      hourly: hourly.map(h => h.count),
      payment: derivePaymentData(trips),
      fare: deriveFareDist(trips),
      dow: deriveDowData(trips),
      zones: {
        labels: topZones.map(z => z.zone_name),
        data: topZones.map(z => z.trip_count),
      },
      speed: hourly.map(h => h.avg_speed ?? 0),
    };
  } catch (err) {
    console.warn("API unavailable, using placeholder data:", err.message);
    return {
      kpis: PLACEHOLDER.kpis,
      hourly: PLACEHOLDER.tripsByHour,
      payment: PLACEHOLDER.paymentTypes,
      fare: PLACEHOLDER.fareDist,
      dow: PLACEHOLDER.tripsByDow,
      zones: PLACEHOLDER.topZones,
      speed: PLACEHOLDER.speedByHour,
    };
  }
}

// ─── Main render ───
async function render(filters = {}) {
  const data = await fetchData(filters);
  renderKPIs(data.kpis);
  renderTripsByHour(data.hourly);
  renderPaymentChart(data.payment);
  renderFareDist(data.fare);
  renderTripsByDow(data.dow);
  renderTopZones(data.zones);
  renderSpeedByHour(data.speed);
}

// ─── Event listeners ───
document.getElementById("applyFilters").addEventListener("click", () => {
  render({
    hour: document.getElementById("hourFilter").value,
    payment: document.getElementById("paymentFilter").value,
    airport: document.getElementById("airportFilter").value,
  });
});

document.getElementById("resetFilters").addEventListener("click", () => {
  document.getElementById("hourFilter").value = "all";
  document.getElementById("paymentFilter").value = "all";
  document.getElementById("airportFilter").value = "all";
  render();
});

// ─── Init ───
buildHourFilter();
render();
