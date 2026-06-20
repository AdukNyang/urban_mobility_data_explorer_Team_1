// fetches taxi trip data from the backend (Flask API) and draws charts for:
// trips by hour, by day, fare distribution, payment types, and top pickup zones.
// also controls the map view including animated taxi visuals and trip density circles.
// filters update everything on the page without having to reload time and again.


// Auto-detect API base: if served from Flask, use relative path.
// If opened directly (file://) or a different origin, fall back to localhost.
const API = (() => {
  const origin = window.location.origin;
  if (origin.startsWith('http://localhost:5000') || origin.startsWith('http://127.0.0.1:5000')) {
    return '/api';                          // served by Flask → relative, no CORS
  }
  return 'http://localhost:5000/api';       // fallback (needs Flask CORS enabled)
})();

// Chart registry
const CHARTS = {};

// Baseline data (full dataset, no filters) - stored on first load
let BASELINE = null;

// Currently rendered data
let CURRENT = null;

// theme utilities - handles light and dark mode colors

function css(v) {
  return getComputedStyle(document.documentElement).getPropertyValue(v).trim();
}

function isLight() {
  return document.documentElement.getAttribute('data-theme') === 'light';
}

function chartColors() {
  const light = isLight();
  return {
    accent:    light ? '#157347'               : '#00FF87',
    accentDim: light ? 'rgba(21,115,71,0.10)'  : 'rgba(0,255,135,0.08)',
    accentMid: light ? 'rgba(21,115,71,0.22)'  : 'rgba(0,255,135,0.22)',
    gold:      '#F2A53A',
    blue:      light ? '#2D5BE3'               : '#5B8DEF',
    grid:      light ? 'rgba(14,74,46,0.06)'   : 'rgba(255,255,255,0.04)',
    tick:      light ? '#7A9A7C'               : '#4A5A4C',
    text:      light ? '#0C1F0E'               : '#E8F0E9',
    text2:     light ? '#3A5C3D'               : '#8A9E8C',
    border:    light ? '#D8E8D9'               : '#263028',
    bg2:       light ? '#FFFFFF'               : '#0F1410',
    green:     light ? '#157347'               : '#00FF87',
    greenDeep: light ? '#0E4A2E'               : '#00FF87',
  };
}

function baseOpts(extra = {}) {
  const C = chartColors();
  const tooltipBg = isLight() ? '#FFFFFF' : '#0F1410';
  const tooltipText = isLight() ? '#0C1F0E' : '#E8F0E9';
  const tooltipMuted = isLight() ? '#3A5C3D' : '#8A9E8C';
  const tooltipBorder = isLight() ? '#D8E8D9' : '#263028';

  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 450, easing: 'easeOutQuart' },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: tooltipBg,
        titleColor: tooltipText,
        bodyColor: tooltipMuted,
        borderColor: tooltipBorder,
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        titleFont: { family: "'JetBrains Mono', monospace", size: 10, weight: '600' },
        bodyFont:  { family: "'JetBrains Mono', monospace", size: 11 },
        ...extra.tooltip,
      },
    },
    scales: {
      x: {
        ticks:  { color: C.tick, font: { family: "'JetBrains Mono', monospace", size: 9 } },
        grid:   { color: C.grid },
        border: { color: C.border, display: false },
        ...extra.x,
      },
      y: {
        ticks:  {
          color: C.tick,
          font: { family: "'JetBrains Mono', monospace", size: 9 },
          callback: v => Intl.NumberFormat('en', { notation: 'compact' }).format(v),
        },
        grid:   { color: C.grid },
        border: { color: C.border, display: false },
        ...extra.y,
      },
    },
    ...extra.root,
  };
}

function mkChart(id, cfg) {
  if (CHARTS[id]) { CHARTS[id].destroy(); delete CHARTS[id]; }
  const el = document.getElementById(id);
  if (!el) return;
  CHARTS[id] = new Chart(el.getContext('2d'), cfg);
}

// updates the status pill and live dot in the sidebar

function setStatus(type, msg) {
  const pill = document.getElementById('statusPill');
  const text = document.getElementById('statusText');
  const dot  = document.getElementById('liveDot');
  const liveText = document.getElementById('liveText');

  pill.className = `status-pill ${type}`;
  text.textContent = msg;

  if (type === 'error') {
    dot.classList.add('error');
    liveText.textContent = 'API OFFLINE';
  } else if (type === 'ok') {
    dot.classList.remove('error');
    liveText.textContent = 'FEED ACTIVE';
  } else {
    dot.classList.remove('error');
    liveText.textContent = 'LOADING...';
  }
}

// reads the current filter values and builds the query string for the API

function getFilters() {
  return {
    hour:    document.getElementById('hourFilter').value,
    payment: document.getElementById('paymentFilter').value,
    airport: document.getElementById('airportFilter').value,
  };
}

function filtersActive() {
  const f = getFilters();
  return f.hour !== 'all' || f.payment !== 'all' || f.airport !== 'all';
}

function filterQueryString() {
  const f = getFilters();
  const params = new URLSearchParams();
  if (f.hour    !== 'all') params.set('hour',         f.hour);
  if (f.payment !== 'all') params.set('payment_type', f.payment);
  if (f.airport !== 'all') params.set('is_airport',   f.airport);
  const q = params.toString();
  return q ? '?' + q : '';
}

function filterLabel() {
  const f = getFilters();
  const parts = [];
  if (f.hour !== 'all') {
    parts.push(`Hour: ${String(f.hour).padStart(2,'0')}:00`);
  }
  if (f.payment !== 'all') {
    const names = { '1': 'Credit Card', '2': 'Cash', '4': 'Dispute' };
    parts.push(`Payment: ${names[f.payment] || f.payment}`);
  }
  if (f.airport !== 'all') {
    parts.push(f.airport === 'true' ? 'Airport trips' : 'City trips');
  }
  return parts.join(' · ');
}

function updateFilterUI() {
  const active = filtersActive();
  const bar = document.getElementById('filterBar');
  const ctx = document.getElementById('filterContext');
  const lbl = document.getElementById('filterContextLabel');

  bar.classList.toggle('visible', active);
  ctx.classList.toggle('visible', active);

  if (active) {
    lbl.textContent = '▼ Filtered: ' + filterLabel();
    document.getElementById('footerFilter').textContent = filterLabel() + ' · filtered view';
  } else {
    document.getElementById('footerFilter').textContent = '7.28M trips · Aiven PostgreSQL · Flask API';
  }
}

// fills in the KPI cards at the top with animated numbers and percentage change badges

function animateNumber(el, from, to, formatter, duration = 400) {
  const start = performance.now();
  const fromN = parseFloat(String(from).replace(/[^0-9.]/g, '')) || 0;
  const toN   = parseFloat(String(to).replace(/[^0-9.]/g, ''))   || 0;

  function step(now) {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3); // ease out cubic
    const val = fromN + (toN - fromN) * eased;
    el.textContent = formatter(val);
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function renderKPIs(d) {
  const fmt   = n => Intl.NumberFormat().format(Math.round(n));
  const fmtC  = n => '$' + Number(n).toFixed(2);
  const fmtD1 = n => Number(n).toFixed(1);

  // Previous values for animation start
  const prev = CURRENT?.summary || {};

  animateNumber(document.getElementById('totalTrips'),   prev.total_trips || 0,          d.total_trips,          fmt,   500);
  animateNumber(document.getElementById('avgFare'),       prev.avg_fare || 0,              d.avg_fare,              fmtC,  400);
  animateNumber(document.getElementById('avgDistance'),   prev.avg_distance_miles || 0,    d.avg_distance_miles,    fmtD1, 400);
  animateNumber(document.getElementById('avgDuration'),   prev.avg_duration_min || 0,      d.avg_duration_min,      fmtD1, 400);
  animateNumber(document.getElementById('airportTrips'),  prev.airport_trips || 0,         d.airport_trips,         fmt,   400);

  document.getElementById('recordCount').textContent =
    Intl.NumberFormat('en', { notation: 'compact' }).format(d.total_trips);

  // Delta badges vs baseline
  if (BASELINE && filtersActive()) {
    const B = BASELINE.summary;
    showDelta('deltaTrips',   d.total_trips,          B.total_trips,          v => fmt(v) + ' trips');
    showDelta('deltaFare',    d.avg_fare,              B.avg_fare,              v => fmtC(v) + ' avg');
    showDelta('deltaDist',    d.avg_distance_miles,    B.avg_distance_miles,    v => fmtD1(v) + ' mi');
    showDelta('deltaDur',     d.avg_duration_min,      B.avg_duration_min,      v => fmtD1(v) + ' min');
    showDelta('deltaAirport', d.airport_trips,         B.airport_trips,         v => fmt(v) + ' trips');
  } else {
    ['deltaTrips','deltaFare','deltaDist','deltaDur','deltaAirport']
      .forEach(id => { document.getElementById(id).style.display = 'none'; });
  }
}

function showDelta(id, current, baseline, fmt) {
  const el = document.getElementById(id);
  const pct = ((current - baseline) / baseline) * 100;
  const positive = pct >= 0;
  const cls = Math.abs(pct) < 0.5 ? 'neutral' : (positive ? 'positive' : 'negative');
  el.className = `kpi-delta ${cls}`;
  el.textContent = (positive ? '▲ ' : '▼ ') + Math.abs(pct).toFixed(1) + '% vs all';
  el.style.display = '';
}

// story text that appears below each chart, changes depending on the active filter

const STORIES = {
  hour: {
    default: 'The city never truly sleeps — but demand troughs at 4 AM before surging with the morning commute. Evening rush peaks harder than morning.',
    '7': 'Morning rush — the city is waking up. Demand spikes as office workers and commuters flood the streets.',
    '8': '8 AM peak: the classic NYC morning crush. Speed data shows the city slowing to a crawl.',
    '17': 'Evening rush begins. After 5 PM, demand eclipses morning rush as New Yorkers head home or out.',
    '22': 'Late night: bar and restaurant closings drive a secondary demand spike — with more generous tips.',
  },
  airport_true: 'Airport trips average 3× the fare of city rides. Despite being just 6% of volume, they represent a disproportionate share of driver revenue.',
  airport_false: 'City trips dominate demand. Short Manhattan hops under 2 miles make up the majority — quick turnovers, lower fares.',
  payment_1: 'Credit card trips dominate — and they have the advantage of recorded tip data. Card payers tip an average of 18% in January 2019.',
  payment_2: 'Cash trips: TLC records no tip data for these. The true tip behavior of cash riders remains invisible in this dataset.',

  dow: {
    default: 'Friday is the peak day. Sunday is the quietest. The weekly rhythm is remarkably consistent — until a storm or holiday breaks it.',
    airport_true: 'Airport demand is steadier across the week — travel is less day-dependent than commuting.',
    airport_false: 'City trip demand follows the work week sharply. Business Monday-Thursday, social Friday-Saturday.',
  },

  fare: {
    default: 'Most trips cost $10–$15 — a short Manhattan hop. The long tail toward $50+ is almost entirely airport runs.',
    airport_true: 'With airport flat fares ($52 to JFK, variable to LGA/EWR), the $50+ bucket dominates. These trips skew the average fare upward significantly.',
    airport_false: 'Strip out airport trips and the fare distribution tightens dramatically. City rides cluster even more tightly in the $5–$20 window.',
  },

  speed: {
    default: 'Pre-dawn runs on the FDR average 22+ mph. By 8 AM, Midtown gridlock drags the city average to 9 mph. The data makes congestion visible.',
    '7': 'At 7 AM, speed is already dropping — the morning rush is building. Midtown approaches are congested before most offices open.',
    '22': 'Late night: with traffic thinned, average speeds nearly double vs. rush hour. The same city, twice as fast.',
  },

  pay: {
    default: 'Card payments dominate at ~70%. Cash tip data is unrecorded by TLC — the true tip rate is higher than the data suggests.',
    payment_2: 'This filtered view shows cash-only trips. No tip data is recorded — a known gap in the TLC dataset that understates actual tipping.',
  },
};

// shows a before and after comparison table when a filter is applied

function renderFilterImpact(current) {
  const panel = document.getElementById('filterImpact');
  if (!panel) return;

  if (!filtersActive() || !BASELINE) {
    panel.style.display = 'none';
    return;
  }

  panel.style.display = 'block';

  const B = BASELINE.summary;
  const C = current;
  const f = getFilters();

  // Subtitle
  const subtitle = document.getElementById('fiSubtitle');
  const parts = [];
  if (f.hour    !== 'all') parts.push(`Hour ${String(f.hour).padStart(2,'0')}:00`);
  if (f.payment !== 'all') parts.push({ '1':'Credit Card', '2':'Cash', '4':'Dispute' }[f.payment]);
  if (f.airport !== 'all') parts.push(f.airport === 'true' ? 'Airport trips only' : 'City trips only');
  subtitle.textContent = 'Active filter: ' + parts.join(' · ');

  // Helper to fill one row
  function fillRow(baseId, currId, chgId, bVal, cVal, fmt, higherIsBetter) {
    document.getElementById(baseId).textContent = fmt(bVal);
    document.getElementById(currId).textContent = fmt(cVal);

    const pct = ((cVal - bVal) / bVal) * 100;
    const el  = document.getElementById(chgId);
    const abs = Math.abs(pct);
    const dir = pct > 0.5 ? 'up' : pct < -0.5 ? 'down' : 'flat';

    el.className = `fi-change ${dir}`;
    if (dir === 'flat') {
      el.textContent = '≈ no change';
    } else {
      const arrow = pct > 0 ? '▲' : '▼';
      el.textContent = `${arrow} ${abs.toFixed(1)}%`;
    }
  }

  const fmtN  = v => Intl.NumberFormat().format(Math.round(v));
  const fmtC  = v => '$' + Number(v).toFixed(2);
  const fmtD1 = v => Number(v).toFixed(1);

  fillRow('fiBaseTrips', 'fiCurrTrips', 'fiChgTrips', B.total_trips,        C.total_trips,        fmtN,  false);
  fillRow('fiBaseFare',  'fiCurrFare',  'fiChgFare',  B.avg_fare,            C.avg_fare,            fmtC,  false);
  fillRow('fiBaseDist',  'fiCurrDist',  'fiChgDist',  B.avg_distance_miles,  C.avg_distance_miles,  v => fmtD1(v) + ' mi', false);
  fillRow('fiBaseDur',   'fiCurrDur',   'fiChgDur',   B.avg_duration_min,    C.avg_duration_min,    v => fmtD1(v) + ' min', false);

  // Auto-generate a plain-English insight
  const tripPct  = ((C.total_trips - B.total_trips) / B.total_trips) * 100;
  const farePct  = ((C.avg_fare    - B.avg_fare)    / B.avg_fare)    * 100;
  const distPct  = ((C.avg_distance_miles - B.avg_distance_miles) / B.avg_distance_miles) * 100;

  const insightEl = document.getElementById('fiInsight');
  let insight = '';

  if (f.airport === 'true') {
    insight = `Airport trips are ${Math.abs(distPct).toFixed(0)}% longer and ${Math.abs(farePct).toFixed(0)}% more expensive than the January average. They represent a small share of volume (${Math.abs(tripPct).toFixed(0)}% of all trips) but carry outsized revenue per ride.`;
  } else if (f.airport === 'false') {
    insight = `City-only trips are shorter and cheaper than the dataset average. Removing airport runs drops the average fare by ${Math.abs(farePct).toFixed(1)}% and average distance by ${Math.abs(distPct).toFixed(1)}% — showing how much airports skew the overall numbers.`;
  } else if (f.hour !== 'all') {
    const h = parseInt(f.hour);
    const timeLabel = h < 6 ? 'late-night' : h < 10 ? 'morning rush' : h < 16 ? 'midday' : h < 20 ? 'evening rush' : 'night';
    insight = `During ${timeLabel} (${String(h).padStart(2,'0')}:00), this filter captures ${Math.abs(tripPct).toFixed(1)}% of January's total trips. Fares are ${farePct > 0 ? 'higher' : 'lower'} than average by ${Math.abs(farePct).toFixed(1)}%, likely due to ${h >= 17 && h <= 20 ? 'surge pricing and longer routes home' : h >= 22 || h < 5 ? 'late-night surcharges and longer trips' : 'typical demand patterns'}.`;
  } else if (f.payment === '1') {
    insight = `Credit card riders make up ~70% of all trips. Their average fare is ${farePct > 0 ? 'slightly above' : 'slightly below'} the overall mean — and crucially, all tip data in this dataset comes exclusively from card payments.`;
  } else if (f.payment === '2') {
    insight = `Cash trips represent ~28% of January rides. Average fares run ${Math.abs(farePct).toFixed(1)}% ${farePct > 0 ? 'above' : 'below'} the overall mean. Note: TLC records no tip data for cash payments — the true tipping rate is unknown.`;
  } else {
    insight = `This filter captures ${fmtN(C.total_trips)} trips — ${Math.abs(tripPct).toFixed(1)}% ${tripPct < 0 ? 'fewer' : 'more'} than the full January dataset. Average fares shift ${farePct > 0 ? 'up' : 'down'} by ${Math.abs(farePct).toFixed(1)}%.`;
  }

  insightEl.textContent = insight;
}

function updateStoryNotes() {
  const f = getFilters();
  const active = filtersActive();

  // Hour story
  const hourEl = document.getElementById('storyHour');
  if (!active) {
    hourEl.textContent = STORIES.hour.default;
  } else if (f.hour !== 'all' && STORIES.hour[f.hour]) {
    hourEl.textContent = STORIES.hour[f.hour];
  } else {
    hourEl.textContent = STORIES.hour.default;
  }

  // DOW story
  const dowEl = document.getElementById('storyDow');
  if (f.airport === 'true') dowEl.textContent = STORIES.dow.airport_true;
  else if (f.airport === 'false') dowEl.textContent = STORIES.dow.airport_false;
  else dowEl.textContent = STORIES.dow.default;

  // Fare story
  const fareEl = document.getElementById('storyFare');
  if (f.airport === 'true') fareEl.textContent = STORIES.fare.airport_true;
  else if (f.airport === 'false') fareEl.textContent = STORIES.fare.airport_false;
  else fareEl.textContent = STORIES.fare.default;

  // Pay story
  const payEl = document.getElementById('storyPay');
  if (f.payment === '2') payEl.textContent = STORIES.pay.payment_2;
  else payEl.textContent = STORIES.pay.default;

  // Fare per mile story
  const fpmEl = document.getElementById('storyFarePerMile');
  if (fpmEl) {
    if (f.airport === 'true') {
      fpmEl.textContent = 'Airport flat fares ($52 to JFK) look expensive — but at 15+ miles they deliver some of the best per-mile value in the dataset. Distance collapses the base fare penalty.';
    } else if (f.airport === 'false') {
      fpmEl.textContent = 'Strip out airports and the economics get brutal: sub-1-mile city trips cost riders $12+ per mile once you factor in the base fare and surcharges. Distance is everything.';
    } else {
      fpmEl.textContent = 'The base fare ($2.50) makes short rides expensive per mile. A 1-mile trip costs ~$8/mile. A 10-mile airport run drops to ~$5/mile. Distance is the great equalizer.';
    }
  }
}

// functions that draw each chart using Chart.js

// Trips by Hour
function renderHour(rows) {
  const C = chartColors();
  const isPeak = r => (r.hour >= 7 && r.hour <= 9) || (r.hour >= 17 && r.hour <= 19);

  mkChart('hourChart', {
    type: 'bar',
    data: {
      labels: rows.map(r => String(r.hour).padStart(2,'0')),
      datasets: [{
        data: rows.map(r => r.trip_count),
        backgroundColor: rows.map(r => isPeak(r) ? C.accent : C.accentDim),
        borderColor:     rows.map(r => isPeak(r) ? C.accent : C.border),
        borderWidth: 1,
        borderRadius: 3,
        borderSkipped: 'bottom',
      }]
    },
    options: baseOpts({
      tooltip: {
        callbacks: {
          title: l => `${String(l[0].label).padStart(2,'0')}:00`,
          label: l => Intl.NumberFormat().format(l.raw) + ' trips',
          afterLabel: l => {
            const r = rows[l.dataIndex];
            return r.avg_speed_mph ? `Avg speed: ${Number(r.avg_speed_mph).toFixed(1)} mph` : '';
          },
        }
      },
      x: { ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 12 } },
    }),
  });
}

// Trips by Day of Week
function renderDow(rows) {
  const C = chartColors();
  mkChart('dowChart', {
    type: 'line',
    data: {
      labels: rows.map(r => r.day_name.slice(0,3).toUpperCase()),
      datasets: [{
        data: rows.map(r => r.trip_count),
        borderColor: C.accent,
        backgroundColor: C.accentDim,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: C.accent,
        pointBorderColor: C.bg2,
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 8,
        borderWidth: 2.5,
      }]
    },
    options: baseOpts({
      tooltip: { callbacks: { label: l => Intl.NumberFormat().format(l.raw) + ' trips' } },
    }),
  });
}

// Fare Distribution
function renderFare(rows) {
  const C = chartColors();
  const data = rows.map(r => r.trip_count);
  const maxIdx = data.indexOf(Math.max(...data));

  mkChart('fareChart', {
    type: 'bar',
    data: {
      labels: rows.map(r => r.fare_range),
      datasets: [{
        data,
        backgroundColor: data.map((_, i) => i === maxIdx ? C.gold : C.accentDim),
        borderColor:     data.map((_, i) => i === maxIdx ? C.gold : C.border),
        borderWidth: 1,
        borderRadius: 3,
        borderSkipped: 'bottom',
      }]
    },
    options: baseOpts({
      tooltip: { callbacks: { label: l => Intl.NumberFormat().format(l.raw) + ' trips' } },
    }),
  });
}

// Payment Type
function renderPayment(rows) {
  const C = chartColors();
  const light = isLight();
  const COLORS = light
    ? [C.green, C.blue, C.gold, 'rgba(255,68,68,0.6)']
    : [C.accent, 'rgba(255,255,255,0.15)', C.accentMid, 'rgba(255,68,68,0.4)'];

  mkChart('payChart', {
    type: 'doughnut',
    data: {
      labels: rows.map(r => r.payment_type_name),
      datasets: [{
        data: rows.map(r => r.trip_count),
        backgroundColor: COLORS,
        borderColor: C.bg2,
        borderWidth: 3,
        hoverOffset: 8,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 450 },
      cutout: '66%',
      plugins: {
        legend: {
          display: true,
          position: 'right',
          labels: {
            color: light ? '#3A5C3D' : '#8A9E8C',
            font: { family: "'JetBrains Mono', monospace", size: 9 },
            boxWidth: 10,
            padding: 12,
          }
        },
        tooltip: {
          backgroundColor: isLight() ? '#FFFFFF' : '#0F1410',
          titleColor: isLight() ? '#0C1F0E' : '#E8F0E9',
          bodyColor: isLight() ? '#3A5C3D' : '#8A9E8C',
          borderColor: isLight() ? '#D8E8D9' : '#263028',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 8,
          callbacks: { label: l => ' ' + Intl.NumberFormat().format(l.raw) + ' trips' }
        },
      }
    }
  });
}

// Top 10 Zones
function renderZones(rows) {
  const max   = rows[0] ? rows[0].trip_count : 1;
  const tbody = document.getElementById('zonesBody');
  tbody.innerHTML = '';

  if (!rows.length) {
    const msg = document.createElement('div');
    msg.className = 'feed-loading';
    msg.textContent = 'No zone data for this filter combination.';
    tbody.appendChild(msg);
    return;
  }

  rows.forEach((r, i) => {
    const row = document.createElement('div');
    row.className = 'zone-row' + (i === 0 ? ' top' : '');

    const rank = document.createElement('span');
    rank.className = 'zone-rank';
    rank.textContent = String(i + 1).padStart(2, '0');

    const name = document.createElement('span');
    name.className = 'zone-name';
    name.textContent = r.zone;

    const borough = document.createElement('span');
    borough.className = 'zone-borough';
    borough.textContent = r.borough;

    const barWrap = document.createElement('div');
    barWrap.className = 'zone-bar-wrap';
    const barFill = document.createElement('div');
    barFill.className = 'zone-bar-fill';
    barFill.style.width = Math.round((r.trip_count / max) * 100) + '%';
    barWrap.appendChild(barFill);

    const count = document.createElement('span');
    count.className = 'zone-count';
    count.textContent = Intl.NumberFormat().format(r.trip_count);

    row.appendChild(rank);
    row.appendChild(name);
    row.appendChild(borough);
    row.appendChild(barWrap);
    row.appendChild(count);
    tbody.appendChild(row);
  });
}


// Fare Per Mile vs Distance — always rich data, tells the base-fare economics story
function renderFarePerMile(filters) {
  const C = chartColors();
  const airport = filters?.airport;

  // Static analytical curve: fare_per_mile = (base_fare + rate_per_mile * d) / d
  // NYC: base $2.50 + $0.50 per 1/5mi = $2.50/mile rate + $2.50 base
  // avg_fare ≈ 2.50 + 2.50*d + extras(~$4 for surcharges/tolls)
  const distances = [0.5, 0.8, 1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 6.0, 8.0, 10.0, 12.0, 15.0, 20.0];

  function farePerMile(d, isAirport) {
    if (isAirport) {
      // Airport flat rate logic: $52 to JFK avg ~15mi, ~$5.2/mi; LGA ~$35 avg 8mi ~$4.4/mi
      return Math.max(3.5, 52 / Math.max(d, 8));
    }
    const base = 2.50;
    const ratePerMile = 2.50;
    const extras = 4.00; // MTA surcharge, tolls avg
    return (base + ratePerMile * d + extras) / d;
  }

  const cityData   = distances.map(d => ({ x: d, y: parseFloat(farePerMile(d, false).toFixed(2)) }));
  const airportPts = [
    { x: 8,  y: parseFloat(farePerMile(8,  true).toFixed(2)) },
    { x: 12, y: parseFloat(farePerMile(12, true).toFixed(2)) },
    { x: 15, y: parseFloat(farePerMile(15, true).toFixed(2)) },
    { x: 18, y: parseFloat(farePerMile(18, true).toFixed(2)) },
  ];

  const datasets = [];

  if (airport !== 'true') {
    datasets.push({
      label: 'City trips',
      data: cityData,
      borderColor: C.accent,
      backgroundColor: C.accentDim,
      fill: true,
      tension: 0.4,
      pointRadius: 4,
      pointHoverRadius: 7,
      pointBackgroundColor: C.accent,
      borderWidth: 2.5,
      showLine: true,
    });
  }

  if (airport !== 'false') {
    datasets.push({
      label: 'Airport (flat fare)',
      data: airportPts,
      borderColor: C.gold,
      backgroundColor: 'rgba(242,165,58,0.10)',
      fill: false,
      pointRadius: 8,
      pointHoverRadius: 10,
      pointBackgroundColor: C.gold,
      pointBorderColor: C.bg2,
      pointBorderWidth: 2,
      borderWidth: 0,
      showLine: false,
    });
  }

  mkChart('farePerMileChart', {
    type: 'scatter',
    data: { datasets },
    options: {
      ...baseOpts({
        tooltip: {
          callbacks: {
            label: l => `${l.dataset.label}: ${l.parsed.x} mi → $${l.parsed.y.toFixed(2)}/mi`,
          }
        },
        x: {
          type: 'linear',
          title: {
            display: true,
            text: 'Trip distance (miles)',
            color: C.tick,
            font: { family: "'JetBrains Mono', monospace", size: 8 },
          },
          ticks: {
            color: C.tick,
            font: { family: "'JetBrains Mono', monospace", size: 9 },
            callback: v => v + ' mi',
          },
        },
        y: {
          title: {
            display: true,
            text: '$/mile',
            color: C.tick,
            font: { family: "'JetBrains Mono', monospace", size: 8 },
          },
          ticks: {
            color: C.tick,
            font: { family: "'JetBrains Mono', monospace", size: 9 },
            callback: v => '$' + v,
          },
          suggestedMin: 0,
          suggestedMax: 18,
        },
      }),
      plugins: {
        legend: {
          display: datasets.length > 1,
          position: 'top',
          labels: {
            color: isLight() ? '#3A5C3D' : '#8A9E8C',
            font: { family: "'JetBrains Mono', monospace", size: 9 },
            boxWidth: 10,
            padding: 10,
          }
        },
      },
    }
  });
}

// ──────────────────────────────────────────────────────────────────
//  NYC MAP — Leaflet + OSM tiles · Animated taxi SVG markers
//  Heatmap circles per zone · click for trip count popup
// ──────────────────────────────────────────────────────────────────

const NYC_ZONES = [
  { id:237, name:'Upper East Side South',   borough:'Manhattan', lat:40.7685, lng:-73.9605, w:1.00 },
  { id:161, name:'Midtown Center',          borough:'Manhattan', lat:40.7549, lng:-73.9840, w:0.93 },
  { id:236, name:'Upper East Side North',   borough:'Manhattan', lat:40.7745, lng:-73.9565, w:0.90 },
  { id:162, name:'Midtown East',            borough:'Manhattan', lat:40.7530, lng:-73.9720, w:0.81 },
  { id:230, name:'Times Sq/Theatre Dist',   borough:'Manhattan', lat:40.7580, lng:-73.9855, w:0.69 },
  { id:186, name:'Penn Station/Madison Sq', borough:'Manhattan', lat:40.7505, lng:-73.9934, w:0.64 },
  { id:142, name:'Lincoln Square East',     borough:'Manhattan', lat:40.7745, lng:-73.9830, w:0.61 },
  { id:170, name:'Murray Hill',             borough:'Manhattan', lat:40.7476, lng:-73.9762, w:0.58 },
  { id:138, name:'LaGuardia Airport',       borough:'Queens',    lat:40.7769, lng:-73.8740, w:0.55 },
  { id:132, name:'JFK Airport',             borough:'Queens',    lat:40.6413, lng:-73.7781, w:0.50 },
  { id:164, name:'Midtown North',           borough:'Manhattan', lat:40.7609, lng:-73.9774, w:0.48 },
  { id:239, name:'Upper West Side South',   borough:'Manhattan', lat:40.7768, lng:-73.9822, w:0.52 },
  { id:113, name:'Greenwich Village North', borough:'Manhattan', lat:40.7344, lng:-74.0001, w:0.35 },
  { id:79,  name:'East Village',            borough:'Manhattan', lat:40.7265, lng:-73.9815, w:0.30 },
  { id:234, name:'Union Square',            borough:'Manhattan', lat:40.7359, lng:-73.9906, w:0.38 },
  { id:45,  name:'Chelsea',                 borough:'Manhattan', lat:40.7465, lng:-74.0014, w:0.32 },
  { id:50,  name:'Clinton West',            borough:'Manhattan', lat:40.7627, lng:-73.9945, w:0.40 },
  { id:209, name:'SoHo',                    borough:'Manhattan', lat:40.7235, lng:-74.0020, w:0.28 },
  { id:12,  name:'Battery Park',            borough:'Manhattan', lat:40.7045, lng:-74.0170, w:0.20 },
  { id:29,  name:'Brooklyn Heights',        borough:'Brooklyn',  lat:40.6960, lng:-73.9950, w:0.12 },
  { id:7,   name:'Astoria',                 borough:'Queens',    lat:40.7717, lng:-73.9301, w:0.10 },
  { id:3,   name:'Bronx Park',              borough:'Bronx',     lat:40.8535, lng:-73.8785, w:0.05 },
];

let leafletMap = null;
let mapZoneWeights = {};
let heatCircles = [];
let taxiMarkers = [];
let taxiAnimFrames = [];

// draws the taxi car icon using SVG shapes and gradients
function taxiSVG(angle, available) {
  // Isometric-style top-down NYC yellow cab. Car faces UP at angle=0.
  // Inspired by the 3D map car aesthetic — rounded body, clear profile, shading.
  const lit = available;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 60 60">
  <defs>
    <radialGradient id="bodyG" cx="40%" cy="30%" r="65%">
      <stop offset="0%"   stop-color="#FFD740"/>
      <stop offset="60%"  stop-color="#F5C000"/>
      <stop offset="100%" stop-color="#C89000"/>
    </radialGradient>
    <radialGradient id="roofG" cx="40%" cy="25%" r="70%">
      <stop offset="0%"   stop-color="#E8B800"/>
      <stop offset="100%" stop-color="#A07800"/>
    </radialGradient>
    <radialGradient id="wheelG" cx="35%" cy="30%" r="70%">
      <stop offset="0%"   stop-color="#555"/>
      <stop offset="100%" stop-color="#111"/>
    </radialGradient>
    <filter id="dropshadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="rgba(0,0,0,0.35)"/>
    </filter>
  </defs>

  <g transform="rotate(${angle}, 30, 30)">

    <!-- Ground shadow -->
    <ellipse cx="30" cy="50" rx="17" ry="4.5" fill="rgba(0,0,0,0.18)"/>

    <!-- ── BODY ── -->
    <!-- Outer body panel (dark outline) -->
    <rect x="9" y="8" width="42" height="40" rx="8" fill="#A07800" filter="url(#dropshadow)"/>
    <!-- Main body yellow -->
    <rect x="10" y="9" width="40" height="38" rx="7" fill="url(#bodyG)"/>

    <!-- Hood (front) — slightly darker, angled feel -->
    <path d="M12,9 Q30,6 48,9 L48,19 Q30,17 12,19 Z" fill="#D4A800" opacity="0.6"/>
    <!-- Trunk (rear) -->
    <path d="M12,43 L48,43 Q48,47 30,48 Q12,47 12,43 Z" fill="#A07800" opacity="0.5"/>

    <!-- ── CABIN / ROOF ── -->
    <rect x="15" y="14" width="30" height="22" rx="5" fill="url(#roofG)"/>
    <!-- Roof highlight -->
    <ellipse cx="26" cy="19" rx="9" ry="3.5" fill="rgba(255,255,255,0.18)" transform="rotate(-8,26,19)"/>

    <!-- ── WINDSHIELDS ── -->
    <!-- Front windshield -->
    <path d="M17,14 Q30,11 43,14 L41,20 Q30,18 19,20 Z" fill="rgba(200,235,255,0.82)"/>
    <!-- Windshield glare -->
    <path d="M19,14.5 Q24,13 29,14 L27,18 Q22,17 20,18 Z" fill="rgba(255,255,255,0.42)"/>
    <!-- Rear windshield -->
    <path d="M19,36 L41,36 Q42,40 30,41 Q18,40 18,36 Z" fill="rgba(180,215,245,0.70)"/>

    <!-- Side windows -->
    <rect x="10" y="19" width="5" height="13" rx="2" fill="rgba(190,225,255,0.65)"/>
    <rect x="45" y="19" width="5" height="13" rx="2" fill="rgba(190,225,255,0.65)"/>

    <!-- ── CHECKERED STRIPE (NYC Taxi) ── -->
    <g opacity="0.28">
      ${[...Array(10)].map((_,i) => `
      <rect x="${10+i*4}" y="27" width="2" height="2.5" fill="#111"/>
      <rect x="${12+i*4}" y="29.5" width="2" height="2.5" fill="#111"/>`).join('')}
    </g>
    <!-- Stripe border lines -->
    <line x1="10" y1="27" x2="50" y2="27" stroke="#B09000" stroke-width="0.6" opacity="0.4"/>
    <line x1="10" y1="32" x2="50" y2="32" stroke="#B09000" stroke-width="0.6" opacity="0.4"/>

    <!-- ── DOOR SEAMS ── -->
    <line x1="30" y1="20" x2="30" y2="40" stroke="#B09000" stroke-width="0.7" opacity="0.35"/>
    <line x1="10" y1="20" x2="50" y2="20" stroke="#B09000" stroke-width="0.5" opacity="0.25"/>
    <line x1="10" y1="40" x2="50" y2="40" stroke="#B09000" stroke-width="0.5" opacity="0.25"/>

    <!-- ── WHEELS ── -->
    <!-- FL -->
    <rect x="5"  y="10" width="9" height="12" rx="3.5" fill="#111"/>
    <rect x="6"  y="11" width="7" height="10" rx="2.5" fill="url(#wheelG)"/>
    <circle cx="9.5" cy="16" r="2.5" fill="#555"/>
    <circle cx="9.5" cy="16" r="1.1" fill="#888"/>
    <!-- FR -->
    <rect x="46" y="10" width="9" height="12" rx="3.5" fill="#111"/>
    <rect x="47" y="11" width="7" height="10" rx="2.5" fill="url(#wheelG)"/>
    <circle cx="50.5" cy="16" r="2.5" fill="#555"/>
    <circle cx="50.5" cy="16" r="1.1" fill="#888"/>
    <!-- RL -->
    <rect x="5"  y="34" width="9" height="12" rx="3.5" fill="#111"/>
    <rect x="6"  y="35" width="7" height="10" rx="2.5" fill="url(#wheelG)"/>
    <circle cx="9.5" cy="40" r="2.5" fill="#555"/>
    <circle cx="9.5" cy="40" r="1.1" fill="#888"/>
    <!-- RR -->
    <rect x="46" y="34" width="9" height="12" rx="3.5" fill="#111"/>
    <rect x="47" y="35" width="7" height="10" rx="2.5" fill="url(#wheelG)"/>
    <circle cx="50.5" cy="40" r="2.5" fill="#555"/>
    <circle cx="50.5" cy="40" r="1.1" fill="#888"/>

    <!-- ── HEADLIGHTS (front) ── -->
    <rect x="11" y="9.5" width="10" height="4" rx="2" fill="rgba(255,252,190,0.95)"/>
    <rect x="39" y="9.5" width="10" height="4" rx="2" fill="rgba(255,252,190,0.95)"/>
    <!-- Headlight inner glow -->
    <rect x="12" y="10" width="7" height="2.5" rx="1.5" fill="rgba(255,255,230,0.80)"/>
    <rect x="41" y="10" width="7" height="2.5" rx="1.5" fill="rgba(255,255,230,0.80)"/>

    <!-- ── TAILLIGHTS (rear) ── -->
    <rect x="11" y="43.5" width="10" height="3.5" rx="2" fill="rgba(255,40,40,0.90)"/>
    <rect x="39" y="43.5" width="10" height="3.5" rx="2" fill="rgba(255,40,40,0.90)"/>

    <!-- ── MEDALLION ROOF LIGHT ── -->
    <rect x="22" y="4"   width="16" height="6"   rx="2.5" fill="${lit ? '#1A1A1A' : '#111'}" opacity="0.85"/>
    <rect x="23" y="4.5" width="14" height="5"   rx="2"   fill="${lit ? 'white'   : '#333'}"/>
    <rect x="24" y="5"   width="12" height="3.5" rx="1.5" fill="${lit ? '#FFFDE7' : '#2A2A2A'}"/>
    ${lit ? '<rect x="25" y="5.2" width="5" height="1.8" rx="1" fill="rgba(255,255,230,0.6)"/>' : ''}

  </g>
</svg>`;
}

function makeTaxiIcon(angle, available) {
  return L.divIcon({
    className: 'taxi-marker',
    html: taxiSVG(angle, available),
    iconSize: [48, 48],
    iconAnchor: [24, 24],
  });
}

// defines the NYC street routes the taxis follow on the map

const TAXI_ROUTES = [
  // [lat1,lng1, lat2,lng2] — pairs of NYC street points
  [40.758,-73.985, 40.748,-73.984],  // 7th Ave → 34th
  [40.752,-73.977, 40.762,-73.974],  // Park Ave N
  [40.767,-73.981, 40.758,-73.982],  // 6th Ave S
  [40.776,-73.988, 40.767,-73.990],  // 8th Ave
  [40.743,-73.989, 40.748,-73.977],  // 23rd→34th cross
  [40.758,-73.998, 40.758,-73.970],  // 42nd St W→E
  [40.748,-74.002, 40.748,-73.970],  // 34th St
  [40.726,-74.010, 40.726,-73.975],  // 14th St
  [40.769,-73.962, 40.777,-73.955],  // UES
  [40.785,-73.978, 40.776,-73.982],  // UWS
  [40.740,-73.989, 40.734,-73.994],  // 23rd→Union Sq
  [40.762,-73.967, 40.752,-73.971],  // Lex Ave
  [40.777,-73.874, 40.769,-73.895],  // LGA area
  [40.728,-74.002, 40.721,-73.999],  // SoHo/Canal
  [40.706,-74.008, 40.713,-73.998],  // Lower Manhattan
];

function createTaxiMarker(map) {
  const route = TAXI_ROUTES[Math.floor(Math.random() * TAXI_ROUTES.length)];
  const forward = Math.random() > 0.5;
  const [lat1,lng1,lat2,lng2] = route;

  // Angle in degrees (Leaflet marker rotation)
  const dLat = lat2 - lat1, dLng = lng2 - lng1;
  const angleDeg = (Math.atan2(dLng, dLat) * 180 / Math.PI + (forward ? 0 : 180) + 360) % 360;

  const progress = { t: Math.random() };
  const available = Math.random() > 0.45;
  const speed = 0.0006 + Math.random() * 0.0008;

  const startLat = lat1 + (lat2 - lat1) * progress.t;
  const startLng = lng1 + (lng2 - lng1) * progress.t;

  const marker = L.marker([startLat, startLng], {
    icon: makeTaxiIcon(angleDeg, available),
    interactive: false,
    zIndexOffset: 1000,
  }).addTo(map);

  return { marker, route, forward, progress, speed, angleDeg, available };
}

function animateTaxis() {
  taxiMarkers.forEach(t => {
    const [lat1,lng1,lat2,lng2] = t.route;
    t.progress.t += t.speed * (t.forward ? 1 : -1);

    // Loop back
    if (t.progress.t > 1.0) { t.progress.t = 0; t.forward = true; }
    if (t.progress.t < 0.0) { t.progress.t = 1; t.forward = false; }

    const lat = lat1 + (lat2 - lat1) * t.progress.t;
    const lng = lng1 + (lng2 - lng1) * t.progress.t;
    t.marker.setLatLng([lat, lng]);
  });
  requestAnimationFrame(animateTaxis);
}

// draws green circles on the map to show trip density per zone
function buildHeatCircles(map) {
  // Remove old
  heatCircles.forEach(c => c.remove());
  heatCircles = [];

  NYC_ZONES.forEach(zone => {
    const w = mapZoneWeights[zone.id] !== undefined ? mapZoneWeights[zone.id] : zone.w;
    if (w < 0.04) return;

    const color = isLight() ? '#157347' : '#00FF87';
    const count = Math.round(w * 54321);

    // Outer glow circle
    const outer = L.circle([zone.lat, zone.lng], {
      radius: 200 + w * 600,
      color: 'transparent',
      fillColor: color,
      fillOpacity: 0.10 + w * 0.12,
      interactive: true,
    });

    // Inner solid circle
    const inner = L.circle([zone.lat, zone.lng], {
      radius: 60 + w * 180,
      color: color,
      weight: 1.5,
      opacity: 0.5 + w * 0.3,
      fillColor: color,
      fillOpacity: 0.30 + w * 0.35,
      interactive: true,
    });

    const popupHTML = `<div class="zone-popup">
      <div class="zone-popup-name">${zone.name}</div>
      <div class="zone-popup-borough">${zone.borough}</div>
      <div class="zone-popup-count">${Intl.NumberFormat().format(count)}</div>
      <div class="zone-popup-label">trips picked up · Jan 2019</div>
    </div>`;

    outer.bindPopup(popupHTML, { className: 'zone-popup-wrapper', closeButton: false });
    inner.bindPopup(popupHTML, { className: 'zone-popup-wrapper', closeButton: false });

    outer.addTo(map);
    inner.addTo(map);
    heatCircles.push(outer, inner);
  });
}

// sets up the Leaflet map, adds tiles, taxis and heatmap circles
function initMap() {
  if (leafletMap) return; // already initialised

  const container = document.getElementById('leafletMap');
  if (!container) return;

  leafletMap = L.map('leafletMap', {
    center: [40.754, -73.984],  // Midtown Manhattan
    zoom: 12,
    zoomControl: true,
    scrollWheelZoom: false,     // don't hijack page scroll
    attributionControl: false,
  });

  // CartoDB Positron — clean, light, minimal like Uber map
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 18,
    subdomains: 'abcd',
  }).addTo(leafletMap);

  // Attribution small
  L.control.attribution({ prefix: false })
    .addAttribution('© <a href="https://carto.com/">CARTO</a> © <a href="https://www.openstreetmap.org/copyright">OSM</a>')
    .addTo(leafletMap);

  // Heatmap circles
  buildHeatCircles(leafletMap);

  // Spawn 15 animated taxis
  taxiMarkers = [];
  for (let i = 0; i < 15; i++) {
    taxiMarkers.push(createTaxiMarker(leafletMap));
  }

  // Start animation loop
  animateTaxis();
}

function refreshMap(zoneRows) {
  if (zoneRows && zoneRows.length) {
    const maxCount = Math.max(...zoneRows.map(r => r.trip_count || 0), 1);
    mapZoneWeights = {};
    zoneRows.forEach(r => { if (r.zone_id) mapZoneWeights[r.zone_id] = (r.trip_count||0)/maxCount; });
  }
  if (leafletMap) buildHeatCircles(leafletMap);
}

function destroyMap() {
  if (leafletMap) { leafletMap.remove(); leafletMap = null; }
  heatCircles = []; taxiMarkers = [];
}

// fills the hour dropdown with 00:00 to 23:00 options
function buildHourFilter() {
  const sel = document.getElementById('hourFilter');
  for (let h = 0; h < 24; h++) {
    const opt = document.createElement('option');
    opt.value = h;
    opt.textContent = String(h).padStart(2,'0') + ':00 – ' + String(h).padStart(2,'0') + ':59';
    sel.appendChild(opt);
  }
}

// demo data used when the API is offline so the dashboard still shows something

function getPlaceholderData(filters) {
  // Apply simple filter simulation to placeholder data
  const hour    = filters.hour    !== 'all' ? parseInt(filters.hour) : null;
  const payment = filters.payment !== 'all' ? filters.payment : null;
  const airport = filters.airport !== 'all' ? filters.airport : null;

  // Base counts
  const hourlyBase = [
    18200,12400,9800,8500,9200,14600,28000,48000,
    52000,44000,40000,42000,46000,44000,42000,43000,
    50000,58000,62000,60000,54000,46000,38000,28000
  ];
  const speedBase = [
    18,22,24,25,23,18,14,10,9,11,13,14,
    13,13,14,13,11,10,11,12,13,15,16,17
  ];

  // Multipliers
  let totalMult = 1.0;
  if (hour !== null) totalMult *= 0.042; // ~4.2% of trips in any one hour
  if (payment === '1') totalMult *= 0.70;
  if (payment === '2') totalMult *= 0.28;
  if (airport === 'true') totalMult *= 0.06;
  if (airport === 'false') totalMult *= 0.94;

  const baseTotal = 1400000;
  const summary = {
    total_trips:        Math.round(baseTotal * totalMult),
    avg_fare:           airport === 'true' ? 48.20 : (hour !== null && hour >= 22 ? 16.80 : 13.52),
    avg_distance_miles: airport === 'true' ? 11.4  : 2.89,
    avg_duration_min:   airport === 'true' ? 38.2  : 11.4,
    airport_trips:      airport === 'false' ? 0 : Math.round(87423 * (hour !== null ? 0.042 : 1)),
  };

  const hourRows = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    trip_count: hour !== null && i !== hour ? 0 : Math.round(hourlyBase[i] * (payment === '1' ? 0.70 : payment === '2' ? 0.28 : 1) * (airport === 'true' ? 0.06 : airport === 'false' ? 0.94 : 1)),
    avg_speed_mph: speedBase[i],
  })).filter(r => hour === null || r.hour === hour || true); // always show all hours

  const dayRows = [
    { day_name: 'Monday',    trip_count: Math.round(196000 * totalMult * (1/0.042 || 1)) },
    { day_name: 'Tuesday',   trip_count: Math.round(205000 * totalMult * (1/0.042 || 1)) },
    { day_name: 'Wednesday', trip_count: Math.round(210000 * totalMult * (1/0.042 || 1)) },
    { day_name: 'Thursday',  trip_count: Math.round(220000 * totalMult * (1/0.042 || 1)) },
    { day_name: 'Friday',    trip_count: Math.round(240000 * totalMult * (1/0.042 || 1)) },
    { day_name: 'Saturday',  trip_count: Math.round(184000 * totalMult * (1/0.042 || 1)) },
    { day_name: 'Sunday',    trip_count: Math.round(145000 * totalMult * (1/0.042 || 1)) },
  ];

  // For non-hour filter, normalise day rows to total
  const dayTotal = dayRows.reduce((s, r) => s + r.trip_count, 0);
  if (hour === null) {
    const scale = summary.total_trips / dayTotal;
    dayRows.forEach(r => r.trip_count = Math.round(r.trip_count * scale));
  }

  const payRows = payment === '1'
    ? [{ payment_type_name: 'Credit Card', trip_count: summary.total_trips }]
    : payment === '2'
    ? [{ payment_type_name: 'Cash', trip_count: summary.total_trips }]
    : [
        { payment_type_name: 'Credit Card', trip_count: Math.round(summary.total_trips * 0.70) },
        { payment_type_name: 'Cash',        trip_count: Math.round(summary.total_trips * 0.28) },
        { payment_type_name: 'No Charge',   trip_count: Math.round(summary.total_trips * 0.01) },
        { payment_type_name: 'Dispute',     trip_count: Math.round(summary.total_trips * 0.01) },
      ];

  const fareBase = [
    { fare_range: '$0–5',    trip_count: 45000  },
    { fare_range: '$5–10',   trip_count: 389000 },
    { fare_range: '$10–15',  trip_count: 412000 },
    { fare_range: '$15–20',  trip_count: 198000 },
    { fare_range: '$20–30',  trip_count: 143000 },
    { fare_range: '$30–50',  trip_count: 87000  },
    { fare_range: '$50+',    trip_count: 24000  },
  ];
  const fareRows = fareBase.map(r => ({
    ...r,
    trip_count: airport === 'true'
      ? (r.fare_range === '$50+' ? Math.round(r.trip_count * 4) : Math.round(r.trip_count * 0.05))
      : Math.round(r.trip_count * totalMult * 4.5),
  }));

  const zoneRows = [
    { zone: 'Midtown Center',            borough: 'Manhattan', trip_count: Math.round(54321 * totalMult * 24) },
    { zone: 'Upper East Side South',     borough: 'Manhattan', trip_count: Math.round(48932 * totalMult * 24) },
    { zone: 'LaGuardia Airport',         borough: 'Queens',    trip_count: airport === 'false' ? 0 : Math.round(43210 * totalMult * 24) },
    { zone: 'Times Sq/Theatre District', borough: 'Manhattan', trip_count: Math.round(41000 * totalMult * 24) },
    { zone: 'Penn Station/Madison Sq',   borough: 'Manhattan', trip_count: Math.round(38500 * totalMult * 24) },
    { zone: 'Upper East Side North',     borough: 'Manhattan', trip_count: Math.round(35200 * totalMult * 24) },
    { zone: 'Lincoln Square East',       borough: 'Manhattan', trip_count: Math.round(31000 * totalMult * 24) },
    { zone: 'Murray Hill',               borough: 'Manhattan', trip_count: Math.round(28400 * totalMult * 24) },
    { zone: 'JFK Airport',               borough: 'Queens',    trip_count: airport === 'false' ? 0 : Math.round(26700 * totalMult * 24) },
    { zone: 'Clinton East',              borough: 'Manhattan', trip_count: Math.round(24100 * totalMult * 24) },
  ].filter(r => r.trip_count > 0)
   .sort((a, b) => b.trip_count - a.trip_count);

  return { summary, hourRows, dayRows, payRows, fareRows, zoneRows };
}

// main function that fetches all data and renders everything on the page
async function loadAll() {
  const filters = getFilters();
  const qs = filterQueryString();

  setStatus('loading', 'Fetching...');
  updateFilterUI();

  try {
    const [summary, byHour, byDay, byPayment, fareDist, topZones] = await Promise.all([
      fetch(`${API}/trips/summary${qs}`).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
      fetch(`${API}/trips/by-hour${qs}`).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
      fetch(`${API}/trips/by-day${qs}`).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
      fetch(`${API}/trips/by-payment${qs}`).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
      fetch(`${API}/trips/fare-distribution${qs}`).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
      fetch(`${API}/zones/top-pickup${qs}`).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
    ]);

    // Store baseline on first load (no filters)
    if (!BASELINE && !filtersActive()) {
      BASELINE = {
        summary: summary.data,
        byHour:  byHour.data,
        byDay:   byDay.data,
      };
    }

    CURRENT = {
      summary: summary.data,
      byHour:  byHour.data,
    };

    renderKPIs(summary.data);
    renderHour(byHour.data);
    renderDow(byDay.data);
    renderPayment(byPayment.data);
    renderFare(fareDist.data);
    renderZones(topZones.data);
    renderFarePerMile(filters);
    renderFilterImpact(summary.data);
    refreshMap(topZones.data);
    updateStoryNotes();

    setStatus('ok', 'Live — ' + Intl.NumberFormat().format(summary.data.total_trips) + ' trips');

  } catch (err) {
    console.warn('API offline, using demo data:', err.message);
    setStatus('error', 'Offline — demo data');

    const d = getPlaceholderData(filters);

    // Baseline on first load
    if (!BASELINE) {
      const base = getPlaceholderData({ hour:'all', payment:'all', airport:'all' });
      BASELINE = { summary: base.summary, byHour: base.hourRows, byDay: base.dayRows };
    }

    CURRENT = { summary: d.summary, byHour: d.hourRows };

    renderKPIs(d.summary);
    renderHour(d.hourRows);
    renderDow(d.dayRows);
    renderPayment(d.payRows);
    renderFare(d.fareRows);
    renderZones(d.zoneRows);
    renderFarePerMile(filters);
    renderFilterImpact(d.summary);
    refreshMap(d.zoneRows.map((r, i) => ({ zone_id: [237,161,236,162,132,230,186,142,138,170][i] || 0, trip_count: r.trip_count })));
    updateStoryNotes();
  }
}

// handles switching between light and dark mode
function initTheme() {
  const saved = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeButton(saved);
}

function updateThemeButton(theme) {
  document.getElementById('themeIcon').textContent  = theme === 'dark' ? '☀' : '◑';
  document.getElementById('themeLabel').textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
}

document.getElementById('themeToggle').addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  updateThemeButton(next);

  // Rebuild heatmap circles with new theme colors
  if (leafletMap) buildHeatCircles(leafletMap);

  // Re-render all charts
  loadAll();
});

// highlights the active sidebar nav item as you scroll down the page
function scrollToSection(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

function initScrollSpy() {
  const sections = document.querySelectorAll('.section[id], .map-section[id]');
  const navItems = document.querySelectorAll('.nav-item[data-section]');

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id.replace('section-', '');
        navItems.forEach(n => n.classList.toggle('active', n.dataset.section === id));
      }
    });
  }, { threshold: 0.25, rootMargin: '-60px 0px -40% 0px' });

  sections.forEach(s => observer.observe(s));
}

// event listeners for the apply, reset and clear filter buttons
document.getElementById('applyFilters').addEventListener('click', loadAll);

document.getElementById('resetFilters').addEventListener('click', () => {
  document.getElementById('hourFilter').value    = 'all';
  document.getElementById('paymentFilter').value = 'all';
  document.getElementById('airportFilter').value = 'all';
  loadAll();
});

document.getElementById('filterContextClear').addEventListener('click', () => {
  document.getElementById('hourFilter').value    = 'all';
  document.getElementById('paymentFilter').value = 'all';
  document.getElementById('airportFilter').value = 'all';
  loadAll();
});

// fixes the map size when the browser window is resized
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (leafletMap) leafletMap.invalidateSize();
  }, 250);
});

// kicks everything off when the page loads
initTheme();
buildHourFilter();
initScrollSpy();

// Init map after DOM is ready
window.addEventListener('load', () => {
  initMap();
  loadAll();
});
