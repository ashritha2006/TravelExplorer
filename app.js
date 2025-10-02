async function fetchOTMPlaces(lat, lon, radius){
  const apikey = keys.otm;
  if (!apikey) return [];
  const baseRadius = 'https://api.opentripmap.com/0.1/en/places/radius';
  const baseBbox = 'https://api.opentripmap.com/0.1/en/places/bbox';

  const makeRadiusUrl = (opts) => {
    const url = new URL(baseRadius);
    url.searchParams.set('apikey', apikey);
    url.searchParams.set('radius', String(opts.radius));
    url.searchParams.set('lon', String(lon));
    url.searchParams.set('lat', String(lat));
    if (opts.kinds) url.searchParams.set('kinds', opts.kinds);
    if (opts.rate) url.searchParams.set('rate', String(opts.rate));
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '30');
    return url;
  };

  const makeBboxUrl = (opts) => {
    const url = new URL(baseBbox);
    url.searchParams.set('apikey', apikey);
    url.searchParams.set('lon_min', String(opts.lon_min));
    url.searchParams.set('lon_max', String(opts.lon_max));
    url.searchParams.set('lat_min', String(opts.lat_min));
    url.searchParams.set('lat_max', String(opts.lat_max));
    if (opts.kinds) url.searchParams.set('kinds', opts.kinds);
    if (opts.rate) url.searchParams.set('rate', String(opts.rate));
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '30');
    return url;
  };

  // Try radius first, then bbox fallback
  const attempts = [
    makeRadiusUrl({ radius: Math.max(500, Math.min(radius, 3000)), kinds: 'interesting_places,sights,architecture,historic', rate: 2 }),
    makeRadiusUrl({ radius: Math.max(1000, Math.min(radius, 5000)), kinds: '', rate: 2 }),
    (() => {
      const deg = Math.min(0.08, Math.max(0.01, radius / 120000));
      return makeBboxUrl({
        lon_min: lon - deg, lon_max: lon + deg,
        lat_min: lat - deg, lat_max: lat + deg,
        kinds: '', rate: 2
      });
    })(),
  ];

  for (const url of attempts){
    try {
      const r = await fetch(url);
      if (!r.ok) continue;
      const list = await r.json();
      const filtered = (Array.isArray(list) ? list : (list?.features || [])).map(it => {
        if (it?.point) return it; // radius format
        if (it?.geometry?.coordinates) {
          return { name: it.properties?.name, point: { lat: it.geometry.coordinates[1], lon: it.geometry.coordinates[0] }, xid: it.properties?.xid };
        }
        return null;
      }).filter(Boolean).filter(p => p?.name && p?.point);
      filtered.sort((a,b) => (a.dist||0) - (b.dist||0));
      if (filtered.length) return filtered;
    } catch {}
  }
  return [];
}

async function fetchOTMDetails(xid){
  const apikey = keys.otm;
  if (!apikey) return null;
  const r = await fetch(`https://api.opentripmap.com/0.1/en/places/xid/${encodeURIComponent(xid)}?apikey=${apikey}`);
  if (!r.ok) return null;
  return await r.json();
}

function wireOpenTripMap(destName, geo, map){
  if (!elements.otmRefresh || !elements.otmList) return;
  const doFetch = async () => {
    elements.otmList.innerHTML = 'Loading attractions...';
    const places = await fetchOTMPlaces(geo.lat, geo.lon, 3000);
    elements.otmList.innerHTML = '';
    if (!places.length) { elements.otmList.textContent = 'No nearby attractions found. Try a different radius or zoom and retry.'; return; }
    if (map.__otmLayer) { map.removeLayer(map.__otmLayer); }
    const layerGroup = L.layerGroup().addTo(map); map.__otmLayer = layerGroup;
    places.slice(0, 20).forEach(p => {
      const marker = L.marker([p.point.lat, p.point.lon]).addTo(layerGroup);
      marker.bindPopup(p.name || 'Attraction');
      const row = document.createElement('div');
      row.className = 'itinerary-item';
      row.innerHTML = `<span>${p.name}</span><div style="display:flex;gap:6px"><button class="btn view">View</button></div>`;
      row.querySelector('.view').addEventListener('click', async () => {
        map.setView([p.point.lat, p.point.lon], 14);
        const det = await fetchOTMDetails(p.xid);
        let imgHtml = '';
            if (det?.preview?.source) {
  imgHtml = `<br><img src="${det.preview.source}" 
                   alt="${p.name}" 
                   style="width:100%;max-height:150px;object-fit:cover;border-radius:6px;">`;
}
const desc = det?.wikipedia_extracts?.text || det?.info?.descr || det?.address?.city || 'Attraction';
marker.bindPopup(`<b>${p.name}</b><br>${desc}${imgHtml}`).openPopup();

      });
      elements.otmList.appendChild(row);
    });
  };
  elements.otmRefresh.onclick = doFetch;
  // auto-load once
  doFetch();
}
// Minimal client-only Travel Explorer

const popularDestinations = [
  "Paris", "Tokyo", "New York", "Rome", "Bali", "Sydney", "London", "Dubai", "Istanbul", "Singapore"
];

const elements = {
  searchInput: document.getElementById('searchInput'),
  searchBtn: document.getElementById('searchBtn'),
  resultsGrid: document.getElementById('resultsGrid'),
  popularChips: document.getElementById('popularChips'),
  themeToggle: document.getElementById('themeToggle'),
  infoBanner: document.getElementById('infoBanner'),
  // Modals
  destinationModal: document.getElementById('destinationModal'),
  modalTitle: document.getElementById('modalTitle'),
  modalClose: document.getElementById('modalClose'),
  modalGallery: document.getElementById('modalGallery'),
  destinationInfo: document.getElementById('destinationInfo'),
  weatherNow: document.getElementById('weatherNow'),
  weatherForecast: document.getElementById('weatherForecast'),
  map: document.getElementById('map'),
  travelTips: document.getElementById('travelTips'),
  monthClimate: document.getElementById('monthClimate'),
  tipsDo: document.getElementById('tipsDo'),
  tipsDont: document.getElementById('tipsDont'),
  bestMonths: document.getElementById('bestMonths'),
  quoteBox: document.getElementById('quoteBox'),
  // OpenTripMap
  otmRefresh: document.getElementById('otmRefresh'),
  otmList: document.getElementById('otmList'),
  // Wikivoyage tabs
  wvTabs: document.getElementById('wvTabs'),
  wvContent: document.getElementById('wvContent'),
  favoriteToggle: document.getElementById('favoriteToggle'),
  addToItinerary: document.getElementById('addToItinerary'),
  // Settings
  settingsBtn: document.getElementById('settingsBtn'),
  settingsModal: document.getElementById('settingsModal'),
  settingsClose: document.getElementById('settingsClose'),
  // api fields removed from settings
  logoutBtn: document.getElementById('logoutBtn'),
  // Favorites modal
  favoritesBtn: document.getElementById('favoritesBtn'),
  favoritesModal: document.getElementById('favoritesModal'),
  favoritesClose: document.getElementById('favoritesClose'),
  favoritesList: document.getElementById('favoritesList'),
  // Itinerary modal
  itineraryBtn: document.getElementById('itineraryBtn'),
  itineraryModal: document.getElementById('itineraryModal'),
  itineraryClose: document.getElementById('itineraryClose'),
  itineraryDate: document.getElementById('itineraryDate'),
  itineraryNote: document.getElementById('itineraryNote'),
  itineraryAddBtn: document.getElementById('itineraryAddBtn'),
  itineraryList: document.getElementById('itineraryList'),
  userBadge: document.getElementById('userBadge'),
};

const storage = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch { return fallback; }
  },
  set(key, value) { localStorage.setItem(key, JSON.stringify(value)); },
};

function getCurrentUser(){
  try { return JSON.parse(localStorage.getItem('current_user')||'null'); } catch { return null; }
}
function requireAuth(){
  const u = getCurrentUser();
  if (!u) { window.location.href = 'login.html'; return null; }
  return u;
}
function userPrefix(){
  const u = getCurrentUser();
  return u ? `${u.email}:` : '';
}

const keys = {
  get unsplash() {
    const fromStorage = storage.get('unsplash_key', '');
    if (fromStorage) return fromStorage;
    const fromConfig = (window.CONFIG && window.CONFIG.UNSPLASH_ACCESS_KEY) || '';
    return fromConfig;
  },
  set unsplash(v) { storage.set('unsplash_key', v); },
  get owm() {
    const fromStorage = storage.get('owm_key', '');
    if (fromStorage) return fromStorage;
    const fromConfig = (window.CONFIG && window.CONFIG.OWM_KEY) || '';
    return fromConfig;
  },
  set owm(v) { storage.set('owm_key', v); },
  get otm() {
    return (window.CONFIG && window.CONFIG.OPENTRIPMAP_KEY) || '';
  }
};

const theme = {
  init() {
    const mode = storage.get('theme', 'dark');
    if (mode === 'light') document.documentElement.classList.add('light');
    elements.themeToggle.textContent = mode === 'light' ? '🌞' : '🌓';
  },
  toggle() {
    const isLight = document.documentElement.classList.toggle('light');
    storage.set('theme', isLight ? 'light' : 'dark');
    elements.themeToggle.textContent = isLight ? '🌞' : '🌓';
  }
};

function createChip(label) {
  const btn = document.createElement('button');
  btn.className = 'chip';
  btn.textContent = label;
  btn.addEventListener('click', () => performSearch(label));
  return btn;
}

function renderPopular() {
  elements.popularChips.innerHTML = '';
  popularDestinations.forEach(d => elements.popularChips.appendChild(createChip(d)));
}

function cardTemplate(dest, thumb) {
  const div = document.createElement('div');
  div.className = 'card';
  div.innerHTML = `
    <img src="${thumb}" alt="${dest}">
    <div class="card-body">
      <div class="title">${dest}</div>
      <button class="btn">View</button>
    </div>
  `;
  div.querySelector('button').addEventListener('click', () => openDestination(dest));
  return div;
}

async function fetchUnsplashPhotos(query) {
  const key = keys.unsplash;
  if (!key) return [];
  const url = new URL('https://api.unsplash.com/search/photos');
  url.searchParams.set('query', query);
  url.searchParams.set('per_page', '9');
  url.searchParams.set('orientation', 'landscape');
  const res = await fetch(url, { headers: { Authorization: `Client-ID ${key}` } });
  if (!res.ok) return [];
  const json = await res.json();
  return (json.results || []).map(p => ({
    id: p.id,
    thumb: p.urls.small,
    full: p.urls.regular,
    alt: p.alt_description || query,
    author: p.user?.name || 'Unknown'
  }));
}

async function fetchGeocoding(place) {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', place);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');
  const res = await fetch(url.toString(), { headers: { 'Accept-Language': 'en' } });
  if (!res.ok) return null;
  const arr = await res.json();
  if (!arr.length) return null;
  const { lat, lon, display_name } = arr[0];
  return { lat: parseFloat(lat), lon: parseFloat(lon), name: display_name };
}

async function fetchWeather(lat, lon) {
  const key = keys.owm;
  if (!key) return null;
  const currentUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${key}`;
  const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${key}`;
  let current = null, forecast = null;
  try {
    const curRes = await fetch(currentUrl);
    if (curRes.ok) current = await curRes.json();
  } catch {}
  try {
    const forRes = await fetch(forecastUrl);
    if (forRes.ok) forecast = await forRes.json();
  } catch {}
  if (!current && !forecast) return null;
  return { current, forecast };
}

// Optional: monthly climate via OpenWeather (One Call or Climate endpoints vary by plan)
async function fetchMonthlyClimate(lat, lon){
  const key = keys.owm;
  if (!key) return null;
  // Using One Call 3.0 daily climatology approximation via 30-day aggregation is not
  // publicly available for free; here we try a pragmatic fallback: use 5-day forecast
  // to at least classify near-future months, else return null to fallback to heuristics.
  // If you have paid Climate endpoints, replace this with that API.
  try {
    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${key}`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const j = await r.json();
    // Aggregate by month index from forecast dates
    const byMonth = {};
    for (const item of j.list){
      const d = new Date(item.dt * 1000);
      const mi = d.getMonth();
      if (!byMonth[mi]) byMonth[mi] = { temps: [], rain: 0, humid: [] };
      byMonth[mi].temps.push(item.main.temp);
      byMonth[mi].humid.push(item.main.humidity);
      const rain = (item.rain && (item.rain['3h'] || item.rain['1h'])) || 0;
      byMonth[mi].rain += rain;
    }
    const list = Object.keys(byMonth).map(k => {
      const v = byMonth[k];
      const avgT = v.temps.length ? v.temps.reduce((a,b)=>a+b,0)/v.temps.length : 0;
      const avgH = v.humid.length ? v.humid.reduce((a,b)=>a+b,0)/v.humid.length : 0;
      return { month: Number(k), temp: { average: avgT }, humidity: avgH, rain: v.rain };
    });
    return { list };
  } catch { return null; }
}

async function fetchDestinationSummary(title){
  // Try Wikivoyage first via MediaWiki API
  const wikiBase = 'https://en.wikivoyage.org/w/api.php';
  const params = new URLSearchParams({
    origin: '*',
    format: 'json',
    action: 'query',
    prop: 'extracts|info',
    inprop: 'url',
    exintro: '1',
    explaintext: '1',
    titles: title,
  });
  const r = await fetch(`${wikiBase}?${params.toString()}`);
  if (r.ok){
    const j = await r.json();
    const pages = j?.query?.pages || {};
    const first = Object.values(pages)[0];
    if (first && first.extract){
      return { extract: first.extract, url: first.fullurl, source: 'Wikivoyage' };
    }
  }
  // Fallback to Wikipedia
  const wpBase = 'https://en.wikipedia.org/api/rest_v1/page/summary/';
  const rr = await fetch(wpBase + encodeURIComponent(title));
  if (rr.ok){
    const jj = await rr.json();
    if (jj?.extract && jj?.content_urls?.desktop?.page){
      return { extract: jj.extract, url: jj.content_urls.desktop.page, source: 'Wikipedia' };
    }
  }
  return null;
}

// Wikivoyage parse API -> extract sections and simple tabs
async function fetchWikivoyageGuide(title){
  try {
    const url = new URL('https://en.wikivoyage.org/w/api.php');
    url.searchParams.set('origin','*');
    url.searchParams.set('format','json');
    url.searchParams.set('action','parse');
    url.searchParams.set('page', title);
    url.searchParams.set('prop','text|sections');
    const r = await fetch(url);
    if (!r.ok) return null;
    const j = await r.json();
    const html = j?.parse?.text?.['*'] || '';
    const sections = j?.parse?.sections || [];
    return { html, sections };
  } catch { return null; }
}

async function fetchWikivoyageSection(title, sectionIndex){
  try {
    const url = new URL('https://en.wikivoyage.org/w/api.php');
    url.searchParams.set('origin','*');
    url.searchParams.set('format','json');
    url.searchParams.set('action','parse');
    url.searchParams.set('page', title);
    url.searchParams.set('section', String(sectionIndex));
    url.searchParams.set('prop','text');
    const r = await fetch(url);
    if (!r.ok) return null;
    const j = await r.json();
    const html = j?.parse?.text?.['*'] || '';
    return html;
  } catch { return null; }
}

// Cache for Wikivoyage sections: key = `${title}::${index}`
const wvSectionCache = new Map();

function sanitizeWvSection(html, title){
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  // Remove scripts/styles
  wrapper.querySelectorAll('script, style, noscript').forEach(n => n.remove());
  // Fix links and images
  wrapper.querySelectorAll('a').forEach(a => {
    const href = a.getAttribute('href') || '';
    if (!href) { a.removeAttribute('href'); return; }
    if (/action=edit|Special:|index\.php\?title=.*&action=edit/i.test(href)) {
      a.replaceWith(a.textContent || '');
      return;
    }
    let abs = href;
    if (href.startsWith('//')) abs = 'https:' + href;
    else if (href.startsWith('/')) abs = 'https://en.wikivoyage.org' + href;
    else if (href.startsWith('#')) {
      abs = 'https://en.wikivoyage.org/wiki/' + encodeURIComponent(title) + href;
    }
    a.setAttribute('href', abs);
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener');
  });
  wrapper.querySelectorAll('.mw-editsection, .noprint, table, .thumb, .metadata').forEach(n => n.remove());
  const imgs = Array.from(wrapper.querySelectorAll('img'));
  imgs.forEach((img, idx) => {
    const src = img.getAttribute('src') || '';
    if (src.startsWith('//')) img.src = 'https:' + src;
    if (src.startsWith('/')) img.src = 'https://en.wikivoyage.org' + src;
    img.loading = 'lazy';
    if (idx > 5) img.remove();
  });
  Array.from(wrapper.querySelectorAll('ul, ol')).forEach((list) => {
    const items = Array.from(list.children);
    if (items.length > 10) items.slice(10).forEach(li => li.remove());
  });
  return wrapper.innerHTML;
}


function renderWikivoyageGuide(title){
  if (!elements.wvTabs || !elements.wvContent) return;
  elements.wvTabs.innerHTML = '';
  elements.wvContent.innerHTML = '';
  const wantedOrder = ['Get in','See','Do','Eat','Respect','Stay safe'];
  fetchWikivoyageGuide(title).then(async data => {
    if (!data) { elements.wvContent.textContent = 'Guide not available.'; return; }
    // Map sections by line (title) to index
    const lineToIndex = new Map();
    for (const s of data.sections) {
      if (s?.line) lineToIndex.set(s.line.trim().toLowerCase(), Number(s.index));
    }
    const tabs = [];
    for (const label of wantedOrder){
      const idx = lineToIndex.get(label.toLowerCase());
      if (idx){
        tabs.push({ label, index: idx });
      }
    }
    if (!tabs.length) { elements.wvContent.textContent = 'Guide not available.'; return; }
    // Wire tabs to fetch section on click
    tabs.forEach((t, i) => {
      const b = document.createElement('button');
      b.className = 'chip';
      b.textContent = `${i===0?'🧭 ':''}${t.label}`;
      b.addEventListener('click', async () => {
        const cacheKey = `${title}::${t.index}`;
        if (wvSectionCache.has(cacheKey)) {
          elements.wvContent.innerHTML = wvSectionCache.get(cacheKey);
          return;
        }
        elements.wvContent.textContent = 'Loading section...';
        const raw = await fetchWikivoyageSection(title, t.index);
        const sanitized = raw ? sanitizeWvSection(raw, title) : 'Section unavailable.';

        wvSectionCache.set(cacheKey, sanitized);
        elements.wvContent.innerHTML = sanitized;
      });
      elements.wvTabs.appendChild(b);
    });
    // Prefetch all tabs in parallel, then render first
    const prefetches = await Promise.all(tabs.map(async t => {
      const cacheKey = `${title}::${t.index}`;
      if (wvSectionCache.has(cacheKey)) return { index: t.index, html: wvSectionCache.get(cacheKey) };
      const raw = await fetchWikivoyageSection(title, t.index);
      const sanitized = raw ? sanitizeWvSection(raw, title) : 'Section unavailable.';
      wvSectionCache.set(cacheKey, sanitized);
      return { index: t.index, html: sanitized };
    }));
    const first = prefetches[0];
    elements.wvContent.innerHTML = first?.html || 'Section unavailable.';
  });
}

function renderSearchResults(query, photos) {
  elements.resultsGrid.innerHTML = '';
  if (photos.length === 0) {
    elements.resultsGrid.innerHTML = `<div class="info-banner">No photos found. Add API key in settings or try another search.</div>`;
    return;
  }
  const uniqueByAuthor = new Map();
  for (const p of photos) {
    if (!uniqueByAuthor.has(p.author)) uniqueByAuthor.set(p.author, p);
  }
  const items = Array.from(uniqueByAuthor.values()).slice(0, 12);
  items.forEach(p => elements.resultsGrid.appendChild(cardTemplate(query, p.thumb)));
}

async function performSearch(query) {
  elements.searchInput.value = query;
  const photos = await fetchUnsplashPhotos(query);
  renderSearchResults(query, photos);
}

function setModalOpen(open) {
  const dlg = elements.destinationModal;
  if (open) dlg.showModal(); else dlg.close();
}

function renderGallery(photos) {
  elements.modalGallery.innerHTML = '';
  photos.slice(0, 9).forEach(p => {
    const img = document.createElement('img');
    img.src = p.thumb;
    img.alt = p.alt;
    elements.modalGallery.appendChild(img);
  });
}

function getDestinationInfoText(name, geo) {
  const base = `${name} — ${geo?.name || ''}`.trim();
  return `${base}. A popular destination. Best time varies; consider shoulder seasons for fewer crowds.`;
}

function renderWeather(data) {
  elements.weatherNow.innerHTML = '';
  elements.weatherForecast.innerHTML = '';
  if (!data || (!data.current && !data.forecast)) {
    elements.weatherNow.textContent = 'Weather unavailable. Add OpenWeatherMap key in settings.';
    return;
  }
  if (data.current) {
    const c = data.current;
    const cards = [
      { label: 'Temp', value: `${Math.round(c.main.temp)}°C` },
      { label: 'Feels', value: `${Math.round(c.main.feels_like)}°C` },
      { label: 'Cond', value: c.weather?.[0]?.main || '-' },
    ];
    cards.forEach(kv => {
      const d = document.createElement('div');
      d.className = 'info-banner';
      d.textContent = `${kv.label}: ${kv.value}`;
      elements.weatherNow.appendChild(d);
    });
  }
  if (data.forecast && data.forecast.list) {
    const byDay = {};
    for (const item of data.forecast.list) {
      const dt = new Date(item.dt * 1000);
      const key = dt.toDateString();
      if (!byDay[key]) byDay[key] = [];
      byDay[key].push(item);
    }
    Object.entries(byDay).slice(0, 5).forEach(([day, arr]) => {
      const temps = arr.map(a => a.main.temp);
      const min = Math.round(Math.min(...temps));
      const max = Math.round(Math.max(...temps));
      const d = document.createElement('div');
      d.className = 'day';
      d.innerHTML = `<div>${day.split(' ')[0]}</div><div>${min}–${max}°C</div>`;
      elements.weatherForecast.appendChild(d);
    });
  }
}

function renderMap(geo, title) {
  if (!geo) return;
  // Reuse singleton map instance to avoid re-init error
  let map = elements.map.__leafletInstance;
  if (!map) {
    map = L.map(elements.map).setView([geo.lat, geo.lon], 12);
    elements.map.__leafletInstance = map;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);
  } else {
    map.setView([geo.lat, geo.lon], 12);
  }
  L.marker([geo.lat, geo.lon]).addTo(map).bindPopup(title).openPopup();
  setTimeout(() => map.invalidateSize(), 100);
  return map;
}

const MONTHS = [
  'January','February','March','April','May','June','July','August','September','October','November','December'
];

// Destination-specific overrides
const PLACE_OVERRIDES = {
  paris: {
    bestMonths: [4,5,9,10], // Apr, May, Sep, Oct
    peakMonths: [6,7,8],
    dos: ['Learn basic French phrases', 'Book Louvre/Eiffel time slots'],
    donts: ["Don’t picnic on no-picnic lawns", 'Avoid unmarked taxis']
  },
  rome: {
    bestMonths: [4,5,10],
    peakMonths: [6,7,8],
    dos: ['Carry a scarf for churches', 'Buy skip-the-line passes'],
    donts: ['Avoid restaurants next to main sights']
  },
  london: {
    bestMonths: [5,6,9],
    peakMonths: [7,8],
    dos: ['Use Oyster/contactless on transit', 'Reserve afternoon tea'],
    donts: ['Don’t stand on the left on escalators']
  },
  tokyo: {
    bestMonths: [3,4,10,11],
    peakMonths: [3,4],
    dos: ['Buy IC card (Suica/Pasmo)', 'Respect quiet on trains'],
    donts: ['Don’t eat while walking in busy areas']
  },
  bali: {
    bestMonths: [5,6,7,8,9],
    peakMonths: [7,8],
    dos: ['Dress modestly at temples', 'Use reputable scooter rentals'],
    donts: ['Don’t drink tap water']
  },
  sydney: {
    bestMonths: [10,11,3,4],
    peakMonths: [12,1,2],
    dos: ['Wear SPF 50+; strong UV', 'Tap on/off with Opal card'],
    donts: ['Don’t underestimate beach rips—swim between flags']
  },
  'new york': {
    bestMonths: [5,6,9,10],
    peakMonths: [12],
    dos: ['Reserve popular restaurants', 'Use subway for speed'],
    donts: ['Avoid empty subway cars (usually broken A/C)']
  },
  dubai: {
    bestMonths: [11,12,1,2,3],
    peakMonths: [12,1],
    dos: ['Dress modestly in malls', 'Book outdoor activities for morning'],
    donts: ['Don’t show PDA in conservative areas']
  },
  istanbul: {
    bestMonths: [4,5,9,10],
    peakMonths: [6,7,8],
    dos: ['Carry a scarf for mosques', 'Use Istanbulkart for transit'],
    donts: ['Avoid pushy carpet shop tours']
  },
  singapore: {
    bestMonths: [2,3,7,8],
    peakMonths: [12,1],
    dos: ['Carry umbrella; sudden showers', 'Use EZ-Link/SimplyGo'],
    donts: ['Don’t litter; fines are strict']
  },
};

function normalizePlaceName(name){
  return (name||'').toLowerCase().trim();
}



function getRegionHeuristic(name){
  const n = name.toLowerCase();
  if (/paris|rome|london|istanbul|amsterdam|barcelona|europe/.test(n)) return 'europe';
  if (/tokyo|bali|singapore|asia|bangkok|seoul|kyoto/.test(n)) return 'asia';
  if (/new york|los angeles|usa|canada|north america/.test(n)) return 'na';
  if (/sydney|australia|nz|new zealand|oceania/.test(n)) return 'oceania';
  if (/dubai|uae|middle east|qatar/.test(n)) return 'me';
  return 'global';
}

function tipsFor(region, monthIdx){
  const m = Number(monthIdx);
  const cool = 'Carry layers; book skip-the-line tickets; use public transit cards.';
  const hot = 'Hydrate; plan early mornings; pick indoor sights midday.';
  const rain = 'Pack a light rain jacket; keep flexible indoor options.';
  const crowd = 'Avoid peak hours; pre-book attractions and restaurants.';
  const general = 'Keep copies of documents; use eSIM; notify bank; travel light.';
  const map = {
    europe: m>=5 && m<=8 ? [hot,crowd,general] : (m===11||m<=2 ? [cool,general] : [rain,general]),
    asia: m>=4 && m<=9 ? [hot,rain,general] : [general,crowd],
    na: m>=5 && m<=8 ? [hot,crowd,general] : [cool,general],
    oceania: (m>=11||m<=2) ? [hot,crowd,general] : [cool,general],
    me: m>=5 && m<=9 ? [hot,general] : [general],
    global: [general]
  };
  return map[region] || [general];
}

function dosDontsFor(region, destName){
  const baseDo = [
    'Respect local customs and dress codes',
    'Use registered taxis or transit cards',
    'Keep emergency contacts and embassy info',
  ];
  const baseDont = [
    'Do not carry large amounts of cash',
    'Avoid unlicensed guides or rides',
    'Don’t ignore local weather advisories',
  ];
  const regionExtras = {
    europe: {
      do: ['Book attractions in advance', 'Validate tickets on trains'],
      dont: ['Don’t rely on cash-only; cards are common'],
    },
    asia: {
      do: ['Carry small bills', 'Try street food at busy stalls'],
      dont: ['Don’t drink tap water unless verified safe'],
    },
    na: {
      do: ['Rent a car for national parks', 'Tip service staff ~15-20%'],
      dont: ['Don’t walk in unsafe areas at night'],
    },
    oceania: {
      do: ['Use sun protection (UV is strong)', 'Book intercity flights early'],
      dont: ['Don’t underestimate distances when driving'],
    },
    me: {
      do: ['Dress modestly in religious places', 'Check weekend days (Fri/Sat)'],
      dont: ['Don’t show PDA in conservative areas'],
    },
    global: { do: [], dont: [] }
  };
  const ext = regionExtras[region] || regionExtras.global;
  const place = PLACE_OVERRIDES[normalizePlaceName(destName)] || null;
  const placeDo = place?.dos || [];
  const placeDont = place?.donts || [];
  return { do: [...baseDo, ...ext.do, ...placeDo], dont: [...baseDont, ...ext.dont, ...placeDont] };
}

function bestMonthsFor(region, destName){
  const place = PLACE_OVERRIDES[normalizePlaceName(destName)];
  if (place?.bestMonths) return place.bestMonths;
  switch(region){
    case 'europe': return [4,5,6,9]; // Apr, May, Jun, Sep
    case 'asia': return [1,2,11,12]; // Many places drier/cooler
    case 'na': return [4,5,9,10];
    case 'oceania': return [3,4,10,11];
    case 'me': return [11,12,1,2,3];
    default: return [3,4,9,10];
  }
}

function priceQuoteFor(region, monthIdx, interests, destName){
  const baseByRegion = { europe: 1200, asia: 900, na: 1100, oceania: 1400, me: 1000, global: 1000 };
  const place = PLACE_OVERRIDES[normalizePlaceName(destName)];
  const isPlacePeak = place?.peakMonths ? place.peakMonths.includes(Number(monthIdx)) : false;
  const seasonMultRegion = (region==='europe' && (monthIdx>=5 && monthIdx<=8)) ? 1.25
    : (region==='oceania' && (monthIdx===11||monthIdx<=2)) ? 1.25
    : (region==='asia' && (monthIdx>=4 && monthIdx<=9)) ? 1.15
    : 1.0;
  const seasonMult = Math.max(seasonMultRegion, isPlacePeak ? 1.25 : 1.0);
  const interestAdd = interests.includes('adventure') ? 150 : 0;
  const foodAdd = interests.includes('food') ? 80 : 0;
  const cultureAdd = interests.includes('culture') ? 60 : 0;
  const relaxAdd = interests.includes('relax') ? 40 : 0;
  const shoppingAdd = interests.includes('shopping') ? 120 : 0;
  const base = baseByRegion[region] || baseByRegion.global;
  const est = Math.round((base + interestAdd + foodAdd + cultureAdd + relaxAdd + shoppingAdd) * seasonMult);
  return { estimate: est, notes: seasonMult>1 ? 'Peak pricing window' : 'Off/shoulder pricing likely' };
}

function updateTipsAndQuote(destName){
  if (!elements.travelTips || !elements.quoteBox) return;
  const monthIdx = new Date().getMonth();
  const region = getRegionHeuristic(destName);
  const interests = Array.from(document.querySelectorAll('.interest:checked')).map(i=>i.value);
  const tips = tipsFor(region, monthIdx).join(' ');
  const quote = priceQuoteFor(region, monthIdx, interests, destName);
  elements.travelTips.textContent = `Travel tips: ${tips}`;
  elements.quoteBox.textContent = `Estimated trip cost: ~$${quote.estimate} ( ${MONTHS[monthIdx]}, ${quote.notes} )`;
  // Month climate summary
  if (elements.monthClimate){
    const key = Array.from(climateCache.keys()).find(k => k.startsWith(destName+':'));
    const climate = key ? climateCache.get(key) : null;
    if (climate){
      const m = climate.list.find(x => Number(x.month) === monthIdx);
      if (m){
        const t = Math.round(m.temp.average);
        const h = Math.round(m.humidity || 0);
        const r = Math.round(m.rain || 0);
        elements.monthClimate.textContent = `Average for ${MONTHS[monthIdx]} — Temp: ${t}°C, Humidity: ${h}%, Rain: ${r}mm (approx)`;
      } else {
  elements.monthClimate.textContent = '';
}
    } else {
  elements.monthClimate.textContent = '';
}
  }
  // Do / Don't
  if (elements.tipsDo && elements.tipsDont){
    const dd = dosDontsFor(region, destName);
    elements.tipsDo.innerHTML = dd.do.map(x=>`<li>${x}</li>`).join('');
    elements.tipsDont.innerHTML = dd.dont.map(x=>`<li>${x}</li>`).join('');
  }
  // Best months chips
  if (elements.bestMonths){
    elements.bestMonths.innerHTML = '';
    bestMonthsFor(region, destName).forEach(mi => {
      const b = document.createElement('button');
      b.className = 'chip';
      b.textContent = MONTHS[mi];
      b.addEventListener('click', () => {updateTipsAndQuote(destName); });
      elements.bestMonths.appendChild(b);
    });

    // Only add legend if not already present
    if (!document.getElementById('monthColorLegend')) {
      const legend = document.createElement('div');
      legend.id = 'monthColorLegend';
      legend.className = 'month-legend';
      legend.innerHTML = `
        <span><span class="legend-box good"></span> Good</span>
        <span><span class="legend-box warn"></span> Warning</span>
        <span><span class="legend-box bad"></span> Bad</span>
      `;
      elements.bestMonths.insertAdjacentElement('afterend', legend);
    }
  }
}

// Enhance best-months dynamically using climate when possible
const climateCache = new Map(); // key: name -> data
async function enhanceBestMonthsWithClimate(destName, geo){
  if (!elements.bestMonths) return;
  const key = `${destName}:${geo?.lat?.toFixed?.(2)}:${geo?.lon?.toFixed?.(2)}`;
  if (climateCache.has(key)) { applyClimateClassification(climateCache.get(key)); return; }
  const data = geo ? await fetchMonthlyClimate(geo.lat, geo.lon) : null;
  if (data && Array.isArray(data.list)){
    climateCache.set(key, data);
    applyClimateClassification(data);
  }
}

function applyClimateClassification(climate){
  // Rules
  const isGood = m => (m.temp.average>=15 && m.temp.average<=30) && (m.rain<100) && (m.humidity??m.hum<70 ? true : true);
  const labels = {};
  for (const m of climate.list){
    const good = isGood(m);
    labels[m.month] = good ? 'good' : 'bad';
  }
  // Color chips accordingly
  Array.from(elements.bestMonths.children).forEach(ch => {
    const mi = MONTHS.indexOf(ch.textContent);
    const label = labels[mi];
    ch.classList.remove('good','bad','warn');
    if (label==='good') ch.classList.add('good');
    else if (label==='bad') ch.classList.add('bad');
    else ch.classList.add('warn');
  });
}

function getFavorites() { return storage.get(userPrefix()+'favorites', []); }
function setFavorites(arr) { storage.set(userPrefix()+'favorites', arr); }
function isFavorite(name) { return getFavorites().includes(name); }
function toggleFavorite(name) {
  const favs = new Set(getFavorites());
  if (favs.has(name)) favs.delete(name); else favs.add(name);
  setFavorites(Array.from(favs));
}

function updateFavoriteButton(name) {
  const fav = isFavorite(name);
  elements.favoriteToggle.textContent = fav ? '⭐ Favorited' : '⭐ Favorite';
}

function openFavoritesModal() {
  const list = getFavorites();
  elements.favoritesList.innerHTML = '';
  if (!list.length) { elements.favoritesList.textContent = 'No favorites yet.'; }
  list.forEach(name => {
    const row = document.createElement('div');
    row.className = 'itinerary-item';
    row.innerHTML = `<span>${name}</span><div style="display:flex;gap:6px"><button class="btn view">View</button><button class="icon-btn remove">Remove</button></div>`;
    row.querySelector('.view').addEventListener('click', () => { elements.favoritesModal.close(); openDestination(name); });
    row.querySelector('.remove').addEventListener('click', () => { toggleFavorite(name); openFavoritesModal(); });
    elements.favoritesList.appendChild(row);
  });
  elements.favoritesModal.showModal();
}

function getItinerary() { return storage.get(userPrefix()+'itinerary', []); }
function setItinerary(arr) { storage.set(userPrefix()+'itinerary', arr); }
function addItineraryItem(place, date, note) {
  const list = getItinerary();
  list.push({ id: Date.now(), place, date, note });
  setItinerary(list);
}
function removeItineraryItem(id) {
  setItinerary(getItinerary().filter(i => i.id !== id));
}
function openItineraryModal() {
  renderItineraryList();
  elements.itineraryModal.showModal();
}
function renderItineraryList() {
  const list = getItinerary();
  elements.itineraryList.innerHTML = '';
  if (!list.length) { elements.itineraryList.textContent = 'No items yet.'; return; }
  list.forEach(item => {
    const row = document.createElement('div');
    row.className = 'itinerary-item';
    row.innerHTML = `<span>${item.date || ''} — ${item.place}: ${item.note || ''}</span><button class="icon-btn">Delete</button>`;
    row.querySelector('button').addEventListener('click', () => { removeItineraryItem(item.id); renderItineraryList(); });
    elements.itineraryList.appendChild(row);
  });
}

async function openDestination(name) {
  elements.modalTitle.textContent = name;
  elements.destinationInfo.textContent = 'Loading...';
  elements.weatherNow.innerHTML = '';
  elements.weatherForecast.innerHTML = '';
  elements.modalGallery.innerHTML = '';
  updateFavoriteButton(name);
  setModalOpen(true);

  const [photos, geo] = await Promise.all([
    fetchUnsplashPhotos(name),
    fetchGeocoding(name)
  ]);
  renderGallery(photos);
  // Fetch rich summary from Wikivoyage/Wikipedia
  try {
    const summary = await fetchDestinationSummary(name);
    if (summary && summary.extract) {
      const safe = summary.extract.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      elements.destinationInfo.innerHTML = `${safe} <a href="${summary.url}" target="_blank" rel="noopener">(${summary.source})</a>`;
    } else {
      elements.destinationInfo.textContent = getDestinationInfoText(name, geo);
    }
  } catch {
    elements.destinationInfo.textContent = getDestinationInfoText(name, geo);
  }
  const leafletMap = renderMap(geo, name);

  const weather = geo ? await fetchWeather(geo.lat, geo.lon) : null;
  renderWeather(weather);
  if (geo) {
    enhanceBestMonthsWithClimate(name, geo);
    wireOpenTripMap(name, geo, leafletMap);
  }
  renderWikivoyageGuide(name);

  elements.favoriteToggle.onclick = () => { toggleFavorite(name); updateFavoriteButton(name); };
  elements.addToItinerary.onclick = () => {
    addItineraryItem(name, elements.itineraryDate.value, elements.itineraryNote.value);
    alert('Added to itinerary');
  };

  updateTipsAndQuote(name);
  const interestBoxes = document.querySelectorAll('.interest');
  interestBoxes.forEach(b => b.onchange = () => updateTipsAndQuote(name));

}

function wireEvents() {
  elements.searchBtn.addEventListener('click', () => {
    const q = elements.searchInput.value.trim();
    if (q) performSearch(q);
  });
  elements.searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') elements.searchBtn.click();
  });
  elements.themeToggle.addEventListener('click', theme.toggle);
  elements.settingsBtn.addEventListener('click', () => {
    elements.settingsModal.showModal();
  });
  elements.settingsClose.addEventListener('click', () => elements.settingsModal.close());
  if (elements.logoutBtn) {
    elements.logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('current_user');
      elements.settingsModal.close();
      window.location.href = 'login.html';
    });
  }
  elements.modalClose.addEventListener('click', () => setModalOpen(false));
  elements.favoritesBtn.addEventListener('click', openFavoritesModal);
  elements.favoritesClose.addEventListener('click', () => elements.favoritesModal.close());
  elements.itineraryBtn.addEventListener('click', openItineraryModal);
  elements.itineraryClose.addEventListener('click', () => elements.itineraryModal.close());
  elements.itineraryAddBtn.addEventListener('click', () => {
    const place = elements.searchInput.value.trim() || 'Untitled place';
    addItineraryItem(place, elements.itineraryDate.value, elements.itineraryNote.value);
    renderItineraryList();
  });
}

function init() {
  // auth check
  const user = requireAuth();
  if (!user) return;
  if (elements.userBadge) elements.userBadge.textContent = `${user.name}`;
  theme.init();
  renderPopular();
  wireEvents();
}

init();


