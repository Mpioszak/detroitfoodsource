(function () {
  "use strict";

  const config = window.SITE_CONFIG || {};
  const DETROIT = L.latLng(42.3314, -83.0458);
  const METERS_PER_MILE = 1609.34;

  // Colors for the "type" column. A type that isn't listed here still works and gets a gray dot.
  const TYPE_COLORS = {
    "Urban farm": "#2b8a3e",
    "Farm": "#e67700",
    "Dairy": "#1c7ed6",
    "Meat": "#c92a2a",
    "Market": "#c2255c",
    "Wholesale": "#6741d9",
    "Food rescue": "#0c8599",
    "Growing region": "#8d5524",
    "Port of entry": "#495057",
  };
  const OTHER_COLOR = "#868e96";

  // Which "scope" values each view button shows, and where it points the map.
  const VIEWS = {
    "Metro Detroit": { scopes: ["Metro Detroit"], bounds: [[41.98, -83.72], [42.9, -82.75]] },
    "Michigan": { scopes: ["Metro Detroit", "Michigan"], bounds: [[41.7, -86.6], [45.0, -82.4]] },
    "All": { scopes: null, bounds: null },
  };

  const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const currentMonth = new Date().getMonth();

  const state = {
    sources: [],
    activeTypes: new Set(),
    view: "Metro Detroit",
    search: "",
    inSeasonOnly: false,
    selected: null,
  };

  const el = {
    updated: document.getElementById("updated"),
    search: document.getElementById("search"),
    viewButtons: document.querySelectorAll("[data-view]"),
    typeFilters: document.getElementById("type-filters"),
    inSeason: document.getElementById("in-season"),
    monthName: document.getElementById("month-name"),
    count: document.getElementById("result-count"),
    list: document.getElementById("list"),
  };

  // ---------- Map ----------

  const map = L.map("map").fitBounds(VIEWS["Metro Detroit"].bounds);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(map);

  const lineLayer = L.layerGroup().addTo(map);
  const markerLayer = L.layerGroup().addTo(map);

  // ---------- Helpers ----------

  function escapeHtml(text) {
    return String(text == null ? "" : text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function safeUrl(url) {
    return /^https?:\/\//i.test(url || "") ? url : "";
  }

  function colorFor(type) {
    return TYPE_COLORS[type] || OTHER_COLOR;
  }

  function monthIndex(text) {
    const i = MONTHS.indexOf(text.trim().toLowerCase().slice(0, 3));
    return i < 0 ? null : i;
  }

  // Turns "Year-round", "Jun-Oct", "Nov-Apr" or "May-Jun, Sep-Oct" into a set of month numbers.
  function parseSeason(text) {
    const value = (text || "").trim().toLowerCase();
    if (!value) return null;
    if (value.includes("year")) return new Set(MONTHS.map((_, i) => i));
    const months = new Set();
    value.split(/[,;]/).forEach((part) => {
      const [start, end] = part.split(/\s*(?:-|–|\bto\b)\s*/).map(monthIndex);
      if (start == null) return;
      if (end == null) { months.add(start); return; }
      for (let m = start; ; m = (m + 1) % 12) {
        months.add(m);
        if (m === end) break;
      }
    });
    return months.size ? months : null;
  }

  function milesFromDetroit(source) {
    return Math.round(map.distance(source.latlng, DETROIT) / METERS_PER_MILE);
  }

  function formatUpdated(value) {
    const match = /^(\d{4})-(\d{1,2})/.exec(value || "");
    if (!match) return value ? `Updated ${value}` : "";
    const date = new Date(Number(match[1]), Number(match[2]) - 1, 1);
    return "Updated " + date.toLocaleString("en-US", { month: "long", year: "numeric" });
  }

  // ---------- Building sources ----------

  function popupHtml(source) {
    const website = safeUrl(source.website);
    const miles = source.scope !== "Metro Detroit" ? milesFromDetroit(source) : null;
    return `
      <p class="popup-title">${escapeHtml(source.name)}</p>
      <div class="popup-type"><span class="dot" style="background:${colorFor(source.type)}"></span>${escapeHtml(source.type)} · ${escapeHtml(source.place)}</div>
      ${source.products ? `<p class="popup-row"><strong>Food:</strong> ${escapeHtml(source.products)}</p>` : ""}
      ${source.season ? `<p class="popup-row"><strong>Season:</strong> ${escapeHtml(source.season)}</p>` : ""}
      ${miles ? `<p class="popup-row"><strong>Distance:</strong> about ${miles.toLocaleString("en-US")} miles from Detroit</p>` : ""}
      ${source.notes ? `<p class="popup-notes">${escapeHtml(source.notes)}</p>` : ""}
      ${website ? `<p class="popup-row"><a href="${escapeHtml(website)}" target="_blank" rel="noopener">Visit website</a></p>` : ""}
    `;
  }

  function buildSource(row) {
    const lat = parseFloat(row.lat);
    const lng = parseFloat(row.lng);
    if (!row.name || Number.isNaN(lat) || Number.isNaN(lng)) {
      console.warn("Skipping row with a missing name or coordinates:", row);
      return null;
    }

    const source = {
      name: row.name.trim(),
      type: (row.type || "Other").trim(),
      scope: (row.scope || "Metro Detroit").trim(),
      place: (row.place || "").trim(),
      products: (row.products || "").trim(),
      season: (row.season || "").trim(),
      website: (row.website || "").trim(),
      notes: (row.notes || "").trim(),
      latlng: L.latLng(lat, lng),
    };
    source.months = parseSeason(source.season);
    source.searchText = [source.name, source.type, source.place, source.products, source.notes].join(" ").toLowerCase();

    const isRegion = source.type === "Growing region" || source.type === "Port of entry";
    source.marker = L.circleMarker(source.latlng, {
      radius: isRegion ? 9 : 7,
      color: "#ffffff",
      weight: 2,
      fillColor: colorFor(source.type),
      fillOpacity: 0.92,
    })
      .bindTooltip(source.name, { direction: "top", offset: [0, -6] })
      .bindPopup(popupHtml(source), { maxWidth: 280 })
      .on("popupopen", () => select(source, false))
      .on("popupclose", () => { if (state.selected === source) select(null, false); });

    // Food from outside Metro Detroit gets a line showing it travelling in.
    if (source.scope !== "Metro Detroit") {
      source.line = L.polyline([source.latlng, DETROIT], {
        color: colorFor(source.type),
        weight: 1.5,
        opacity: 0.45,
        dashArray: "4 6",
        interactive: false,
      });
    }
    return source;
  }

  // ---------- Filtering and rendering ----------

  function inView(source) {
    const scopes = VIEWS[state.view].scopes;
    return !scopes || scopes.includes(source.scope);
  }

  function matchesFilters(source) {
    if (!state.activeTypes.has(source.type)) return false;
    if (state.inSeasonOnly && !(source.months && source.months.has(currentMonth))) return false;
    if (state.search) {
      return state.search.split(/\s+/).every((word) => source.searchText.includes(word));
    }
    return true;
  }

  function renderTypeFilters() {
    const counts = {};
    state.sources.forEach((s) => { counts[s.type] = (counts[s.type] || 0) + 1; });
    const types = Object.keys(TYPE_COLORS).filter((t) => counts[t])
      .concat(Object.keys(counts).filter((t) => !TYPE_COLORS[t]).sort());

    el.typeFilters.innerHTML = "";
    types.forEach((type) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.setAttribute("aria-pressed", String(state.activeTypes.has(type)));
      chip.innerHTML = `<span class="dot" style="background:${colorFor(type)}"></span>${escapeHtml(type)} <span class="count">${counts[type]}</span>`;
      chip.addEventListener("click", () => {
        if (state.activeTypes.has(type)) state.activeTypes.delete(type);
        else state.activeTypes.add(type);
        chip.setAttribute("aria-pressed", String(state.activeTypes.has(type)));
        render();
      });
      el.typeFilters.appendChild(chip);
    });
  }

  function render() {
    const matching = state.sources.filter(matchesFilters);
    const visible = matching.filter(inView);
    const hiddenElsewhere = matching.length - visible.length;

    markerLayer.clearLayers();
    lineLayer.clearLayers();
    visible.forEach((s) => {
      markerLayer.addLayer(s.marker);
      if (s.line) lineLayer.addLayer(s.line);
    });

    el.count.textContent = `${visible.length} ${visible.length === 1 ? "source" : "sources"}`;
    el.list.innerHTML = "";

    visible
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((source) => {
        const li = document.createElement("li");
        const button = document.createElement("button");
        button.type = "button";
        button.innerHTML = `
          <span class="source-name"><span class="dot" style="background:${colorFor(source.type)}"></span>${escapeHtml(source.name)}</span>
          <span class="source-meta">${escapeHtml(source.place)}${source.products ? " · " + escapeHtml(source.products) : ""}</span>`;
        button.classList.toggle("active", state.selected === source);
        button.addEventListener("click", () => select(source, true));
        source.listButton = button;
        li.appendChild(button);
        el.list.appendChild(li);
      });

    if (!visible.length) {
      const li = document.createElement("li");
      li.className = "empty";
      li.textContent = "Nothing matches these filters.";
      el.list.appendChild(li);
    }

    if (hiddenElsewhere > 0 && state.view !== "All") {
      const li = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "empty";
      button.textContent = `${hiddenElsewhere} more outside this view. Show everywhere →`;
      button.addEventListener("click", () => setView("All"));
      li.appendChild(button);
      el.list.appendChild(li);
    }
  }

  function select(source, moveMap) {
    if (state.selected && state.selected.line) {
      state.selected.line.setStyle({ weight: 1.5, opacity: 0.45, dashArray: "4 6" });
    }
    if (state.selected && state.selected.listButton) state.selected.listButton.classList.remove("active");

    state.selected = source;
    if (!source) return;

    if (source.line) source.line.setStyle({ weight: 3, opacity: 0.9, dashArray: null });
    if (source.listButton) source.listButton.classList.add("active");

    if (moveMap) {
      // On phones the map sits above the list, so bring it back into view.
      if (window.matchMedia("(max-width: 800px)").matches) {
        document.getElementById("map").scrollIntoView({ behavior: "smooth" });
      }
      const done = () => source.marker.openPopup();
      if (source.line) {
        map.once("moveend", done);
        map.flyToBounds(L.latLngBounds([source.latlng, DETROIT]), { padding: [60, 60], maxZoom: 11, duration: 0.8 });
      } else if (map.getCenter().distanceTo(source.latlng) < 100 && map.getZoom() >= 11) {
        done();
      } else {
        map.once("moveend", done);
        map.flyTo(source.latlng, Math.max(map.getZoom(), 11), { duration: 0.8 });
      }
    }
  }

  function setView(view) {
    state.view = view;
    el.viewButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === view)));
    map.closePopup();
    render();

    const bounds = VIEWS[view].bounds;
    if (bounds) {
      map.flyToBounds(bounds, { duration: 0.8 });
    } else if (state.sources.length) {
      const all = L.latLngBounds(state.sources.map((s) => s.latlng)).extend(DETROIT);
      map.flyToBounds(all, { padding: [30, 30], duration: 0.8 });
    }
  }

  // ---------- Wiring ----------

  el.updated.textContent = formatUpdated(config.updated);
  el.monthName.textContent = new Date().toLocaleString("en-US", { month: "long" });

  el.search.addEventListener("input", () => {
    state.search = el.search.value.trim().toLowerCase();
    render();
  });

  el.inSeason.addEventListener("change", () => {
    state.inSeasonOnly = el.inSeason.checked;
    render();
  });

  el.viewButtons.forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });

  const dataUrl = (config.sheetCsvUrl || "").trim() || "data/sources.csv";
  Papa.parse(dataUrl, {
    download: true,
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
    complete: (results) => {
      state.sources = results.data.map(buildSource).filter(Boolean);
      state.sources.forEach((s) => state.activeTypes.add(s.type));
      renderTypeFilters();
      render();
    },
    error: (err) => {
      console.error(err);
      el.count.textContent = "Couldn't load the data";
      el.list.innerHTML = `<li class="empty">The food source list didn't load. Check that ${escapeHtml(dataUrl)} exists.</li>`;
    },
  });
})();
