(function () {
  const G = window.MPGame;
  const KEY = "mp-visit-day-v6";
  const PREV_KEYS = ["mp-visit-day-v5", "mp-visit-day-v4", "mp-visit-day-v3", "mp-visit-day-v2"];

  let state = null;
  let summaryBest = false;
  let roadObserver = null;
  let driving = false;
  let mapPinned = false;
  let roadStamp = "";
  let driveToken = 0;
  let pinById = {};
  let edgeByKey = {};
  let flipHold = null;
  let skyRafId = 0;
  let skyTrip = null;
  let skyMinutesOverride = null;
  let roadLiftPx = 0;
  let hillShiftVb = 0;
  let roadSamples = [];
  let cityBlocks = [];
  let cityScroll = null;

  // Clinics stand on the road. A banner above each roof shows the trip and the points.
  const CLINIC_W = 194;
  const CLINIC_H = 263;
  const BANNER_H = 42;
  const BANNER_GAP = 10;
  const BANNER_W = 200;
  const CLINIC_SINK = 4;
  const HOME_W = 168;
  const HOME_PIN_Y = 0.606;
  const STEP_X = 400;
  const EDGE_X = 36;
  const SCENERY_W = 1200;
  const ROAD_HILL = { base: 70, amp1: 6, amp2: 3.5, phase: 90 };

  function carSvg() {
    return `<svg viewBox="0 0 52 24" aria-hidden="true">
      <ellipse cx="14" cy="20" rx="5.5" ry="2.2" fill="#1a2030"/>
      <ellipse cx="38" cy="20" rx="5.5" ry="2.2" fill="#1a2030"/>
      <path d="M8 14h10l3-5h14l5 5h4v6H8Z" fill="#e23d2f"/>
      <path d="M22 9h12l4 5H22Z" fill="#c9ecff" opacity="0.95"/>
      <rect x="10" y="14" width="3" height="4" rx="1" fill="#2a3038"/>
    </svg>`;
  }

  function esc(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[ch]));
  }

  function readSave(key) {
    try {
      const data = JSON.parse(localStorage.getItem(key) || "null");
      if (!data || typeof data !== "object") return null;
      return data;
    } catch {
      return null;
    }
  }

  function loadSave() {
    const current = readSave(KEY);
    const sources = [current, ...PREV_KEYS.map(readSave)].filter(Boolean);
    let name = "";
    let best = 0;
    sources.forEach((data) => {
      if (!name && typeof data.name === "string") name = data.name;
      if (Number.isFinite(data.best) && data.best > best) best = data.best;
    });
    return {
      name,
      best,
      game: current && isValidGame(current.game) ? current.game : null,
    };
  }

  function writeSave(save) {
    try {
      localStorage.setItem(KEY, JSON.stringify(save));
    } catch {
      /* private mode */
    }
  }

  function isValidGame(game) {
    if (!game || game.screen !== "game") return false;
    if (typeof game.name !== "string" || !game.name.trim()) return false;
    if (!Array.isArray(game.route) || game.route.length !== G.ROAD_STOPS) return false;
    const routeIds = new Set(game.route);
    if (routeIds.size !== G.ROAD_STOPS) return false;
    if (!game.route.every((id) => Number.isInteger(id) && G.doctorById(id))) return false;
    if (game.position !== 0 && !routeIds.has(game.position)) return false;
    if (!Number.isFinite(game.minutesLeft) || game.minutesLeft < 0 || game.minutesLeft > G.DAY_MINUTES) return false;
    if (!Array.isArray(game.visited) || !Array.isArray(game.log)) return false;
    if (!game.visited.every((id) => routeIds.has(id))) return false;
    return true;
  }

  function persist() {
    const save = loadSave();
    if (state?.name) save.name = state.name;
    if (state?.screen === "game") save.game = state;
    writeSave(save);
  }

  function freshState(name) {
    return {
      screen: "game",
      name,
      position: 0,
      route: G.pickRoute(),
      minutesLeft: G.DAY_MINUTES,
      score: 0,
      visited: [],
      log: [],
      phase: "map",
      selectedDoctor: null,
      selectedDrug: null,
      pending: null,
      lastResult: null,
      travelSpent: 0,
      visitSpent: 0,
    };
  }

  function motionMs(ms) {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : ms;
  }

  function minutesUsed() {
    return G.DAY_MINUTES - state.minutesLeft;
  }

  function placeLabel(position) {
    if (position === 0) return "дом";
    const doctor = G.doctorById(position);
    return doctor ? doctor.name : "маршрут";
  }

  function dayDoctors() {
    return state.route.map((id, index) => ({
      ...G.doctorById(id),
      slot: index + 1,
      points: G.pointsForSlot(index + 1),
    }));
  }

  function dayDoctor(id) {
    return dayDoctors().find((doctor) => doctor.id === id) || null;
  }

  function hasMove() {
    return dayDoctors().some(
      (doctor) => !state.visited.includes(doctor.id) && G.visitCost(state.route, state.position, doctor.id) <= state.minutesLeft
    );
  }

  function portfolioHtml() {
    return `<div class="legend">${G.DRUGS.map((drug) => {
      const spec = G.specialtyOf(drug.specialty);
      return `<div class="legend-item" style="--spec:${spec.color}"><b>${esc(drug.name)}</b><span>${esc(spec.label)}</span></div>`;
    }).join("")}</div>`;
  }

  function rulesListHtml() {
    return `<ol class="rules">
      <li><b>1</b><p>День с 09:00 до 17:00. Время уходит на дорогу и на визит.<span>Каждого врача можно посетить один раз.</span></p></li>
      <li><b>2</b><p>Пять поликлиник стоят вдоль дороги. Над каждой — время пути и баллы.<span>От дома: 20 минут и 20 баллов, 40 минут и 40, час и 60, полтора часа и 80, два часа и 100. Визит — 30 минут. Время считается от вашей текущей точки.</span></p></li>
      <li><b>3</b><p>Препарат по специальности — все баллы уровня.<span>Другая специальность — половина. Нелюбимый препарат — ноль.</span></p></li>
    </ol>`;
  }

  function setMenuChrome(on) {
    document.querySelector(".shell")?.classList.toggle("is-menu", on);
  }

  function menuSceneHtml() {
    return `<svg class="menu-scene" viewBox="0 0 460 200" aria-hidden="true">
      <defs>
        <radialGradient id="menuSun" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#fff6dc"/>
          <stop offset="42%" stop-color="#ffdc7a"/>
          <stop offset="100%" stop-color="#ffdc7a" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <circle cx="86" cy="62" r="40" fill="url(#menuSun)"/>
      <circle cx="86" cy="62" r="13" fill="#ffdc7a"/>
      <g fill="#fff">
        <ellipse cx="196" cy="38" rx="26" ry="11"/>
        <ellipse cx="182" cy="42" rx="14" ry="9"/>
        <ellipse cx="214" cy="42" rx="16" ry="10"/>
        <ellipse cx="330" cy="64" rx="20" ry="8"/>
        <ellipse cx="318" cy="68" rx="11" ry="7"/>
      </g>
      <path d="M0 118 C90 98 150 132 230 114 C310 96 370 128 460 108 V200 H0 Z" fill="#8aa89a"/>
      <path d="M0 146 C100 128 170 160 260 142 C340 126 400 158 460 140 V200 H0 Z" fill="#7fb356"/>
      <path d="M0 172 C110 160 190 186 280 170 C360 156 410 184 460 170 V200 H0 Z" fill="#9dcc72"/>
      <path d="M-8 164 C100 150 180 178 270 162 C350 148 400 174 468 160" fill="none" stroke="#243042" stroke-width="13" stroke-linecap="round"/>
      <path d="M-8 164 C100 150 180 178 270 162 C350 148 400 174 468 160" fill="none" stroke="#f3ecdf" stroke-width="1.4" stroke-dasharray="3 9" stroke-linecap="round"/>
      <path d="M36 156 L54 140 L72 156 Z" fill="#e14b3c"/>
      <rect x="42" y="156" width="24" height="16" fill="#f4efe4"/>
      <rect x="50" y="162" width="8" height="10" rx="1" fill="#6b4a34"/>
      <rect x="292" y="112" width="48" height="8" fill="#0f766e"/>
      <rect x="292" y="120" width="48" height="46" fill="#f7f4ee"/>
      <circle cx="316" cy="136" r="7" fill="#fff" stroke="#e23d2f" stroke-width="1.4"/>
      <path d="M316 132 v8 M312 136 h8" stroke="#e23d2f" stroke-width="1.4" stroke-linecap="round"/>
      <rect x="304" y="150" width="9" height="10" fill="#c5d7ea"/>
      <rect x="318" y="150" width="9" height="10" fill="#c5d7ea"/>
    </svg>`;
  }

  function showStart() {
    stopSkyLoop();
    roadObserver?.disconnect();
    state = null;
    setMenuChrome(true);
    const save = loadSave();
    const app = document.getElementById("app");
    const continueBtn = save.game
      ? '<button class="btn secondary" type="button" data-action="continue-game">Продолжить день</button>'
      : "";
    app.innerHTML = `<section class="start menu">
      <header class="menu-hero">
        <div class="menu-hero-copy">
          <p class="eyebrow">Тренажёр медпредставителя</p>
          <h1>Визитный день</h1>
          <p class="lead">За 8 часов на дороге 5 врачей из 30, каждый день состав новый. Ближняя поликлиника — 20 минут и 20 баллов, дальняя — 2 часа и 100. Прыжки назад съедают день.</p>
        </div>
        ${menuSceneHtml()}
      </header>
      <div class="menu-body">
        <div class="menu-card">
          <form id="start-form">
            <label class="field">Как к вам обращаться
              <input id="player-name" name="player" maxlength="24" autocomplete="nickname" placeholder="Имя" value="${esc(save.name)}" />
            </label>
            <p class="error" role="alert"></p>
            <button class="btn" type="submit">Начать день</button>
          </form>
          <div class="menu-actions">
            ${continueBtn}
            <button class="btn secondary" type="button" data-action="show-roster">Все врачи</button>
          </div>
          ${save.best ? `<p class="menu-best"><span>Рекорд</span><strong class="num">${esc(G.formatScore(save.best))}</strong></p>` : ""}
        </div>
        <div class="menu-rules">${rulesListHtml()}</div>
      </div>
      <section class="menu-bag">
        <p class="block-title">Портфель</p>
        ${portfolioHtml()}
        <p class="fine">Препараты вымышленные. Это учебная игра, а не реклама лекарств.</p>
      </section>
    </section>`;
    renderPanels();
  }

  function showRoster() {
    stopSkyLoop();
    roadObserver?.disconnect();
    state = null;
    const cards = G.DOCTORS.map((doctor) => {
      const spec = G.specialtyOf(doctor.specialty);
      const { first, last } = nameParts(doctor.name);
      return `<article class="roster-card">
        ${window.MPPortrait(doctor.id)}
        <p class="who"><span class="first">${esc(first)}</span><span class="last">${esc(last)}</span></p>
        <p class="spec" style="color:${spec.color}">${esc(spec.label)}</p>
      </article>`;
    }).join("");
    setMenuChrome(false);
    document.getElementById("app").innerHTML = `<section class="start roster">
      <p class="eyebrow">Справочник</p>
      <h1>Все врачи</h1>
      <p class="lead">Тридцать персонажей. Имя закреплено за портретом. На дороге каждый день случайные 5.</p>
      <div class="roster-grid">${cards}</div>
      <button class="btn" type="button" data-action="new-day">В меню</button>
    </section>`;
  }

  function startGame(name) {
    const save = loadSave();
    state = freshState(name);
    save.name = name;
    save.game = state;
    writeSave(save);
    showGame(true);
  }

  function continueGame() {
    const save = loadSave();
    if (!save.game) return;
    state = save.game;
    if (state.phase === "travel") state.phase = "visit";
    if (!["map", "confirm", "visit", "result", "help", "finish"].includes(state.phase)) state.phase = "map";
    showGame(false);
  }

  function showGame() {
    setMenuChrome(false);
    const app = document.getElementById("app");
    app.innerHTML = `<section class="game">
      <header class="topbar">
        <div class="top-row">
          <p class="hud-name" id="hud-name"></p>
          <div class="score-pill">
            <span>Результат</span>
            <strong class="num" id="hud-score">0</strong>
          </div>
        </div>
        <div class="daybar" aria-hidden="true"><i id="daybar-fill"></i></div>
        <div class="day-meta">
          <span class="num" id="hud-clock">09:00</span>
          <span id="hud-left"></span>
        </div>
        <div class="top-links">
          <button type="button" class="icon-btn" data-action="help" aria-label="Правила" title="Правила">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 4.5h8.2A2.3 2.3 0 0 1 17.5 6.8V19H9.2A2.2 2.2 0 0 0 7 21.2V4.5Z"/>
              <path d="M7 4.5A2.2 2.2 0 0 1 9.2 2.3H17.5"/>
              <path d="M10 8.5h5M10 12h5"/>
            </svg>
          </button>
          <button type="button" class="icon-btn icon-finish" data-action="ask-finish" aria-label="Завершить" title="Завершить">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 20.5V4"/>
              <path d="M6 5.2h12l-2.5 3.7L18 12.6H6"/>
            </svg>
          </button>
        </div>
      </header>
      <div class="map-scroll" id="map-scroll">
        <div class="route" id="route"></div>
      </div>
      <div class="overlay" id="overlay" hidden></div>
      <aside class="day-end" id="day-end" hidden>
        <button type="button" class="day-end-card" data-action="finish-day">
          <span class="day-end-mark" aria-hidden="true"></span>
          <span class="day-end-copy">
            <span class="day-end-kicker">Время вышло</span>
            <strong>Завершить день</strong>
            <span class="day-end-note" id="day-end-note"></span>
          </span>
        </button>
      </aside>
      <div class="sr" id="live" aria-live="polite"></div>
    </section>`;
    document.getElementById("route").innerHTML =
      `${sceneryHtml()}<svg class="road" id="road" aria-hidden="true"></svg><div class="skyline" id="skyline" aria-hidden="true"></div><div class="token" id="token" aria-hidden="true">${carSvg()}</div>${routeHtml()}`;
    updateHud();
    updateStops();
    renderOverlay();
    renderPanels();
    const scroller = document.getElementById("map-scroll");
    mapPinned = true;
    const releasePin = () => { mapPinned = false; };
    scroller.addEventListener("pointerdown", releasePin, { once: true });
    scroller.addEventListener("wheel", releasePin, { once: true, passive: true });
    scroller.addEventListener("touchstart", releasePin, { once: true, passive: true });
    scroller.addEventListener("wheel", panOnWheel, { passive: false });
    scroller.addEventListener("scroll", syncHillParallax, { passive: true });
    roadStamp = "";
    layoutRoad();
    placeToken(state.position);
    placeMap();
    requestAnimationFrame(() => {
      if (state?.screen !== "game" || driving) return;
      layoutRoad();
      placeToken(state.position);
      placeMap();
      watchRoad();
    });
    if (document.fonts?.ready) {
      document.fonts.ready.then(() => {
        if (state?.screen !== "game") return;
        layoutRoad();
        placeToken(state.position);
        placeMap();
      });
    }
    skyMinutesOverride = null;
    startSkyLoop();
  }

  function hillWave(x, base, amp1, amp2, phase, freq = 1) {
    return base
      + Math.sin((x + phase) * 0.017 * freq) * amp1
      + Math.sin((x + phase * 0.6) * 0.0085 * freq) * amp2;
  }

  function terrainYpx(xPx, routeW, routeH) {
    const x = (xPx / routeW) * SCENERY_W;
    const y = hillWave(x, ROAD_HILL.base, ROAD_HILL.amp1, ROAD_HILL.amp2, ROAD_HILL.phase);
    const py = (y / 100) * routeH + roadLiftPx;
    return Math.max(22, Math.min(routeH - 22, py));
  }

  function slotPinX(slot) {
    return EDGE_X + HOME_W + 130 + (slot - 1) * STEP_X;
  }

  function routeWidthPx() {
    const lastPin = slotPinX(G.ROAD_STOPS);
    return Math.round(lastPin + BANNER_W / 2 + EDGE_X);
  }

  function hillLayerPath(width, base, amp1, amp2, phase, pad = 0, freq = 1) {
    const start = -pad;
    const end = width + pad;
    const step = 18;
    let d = `M ${start} ${hillWave(start, base, amp1, amp2, phase, freq).toFixed(2)}`;
    for (let x = start + step; x <= end; x += step) {
      d += ` L ${x} ${hillWave(x, base, amp1, amp2, phase, freq).toFixed(2)}`;
    }
    return `${d} L ${end} 220 L ${start} 220 Z`;
  }

  const SKY_PALETTE = [
    { at: 0, top: "#8eb0d8", mid: "#c8ddf4", low: "#fde8c8" },
    { at: 0.32, top: "#7ec0ef", mid: "#b9e2fb", low: "#e8f4dc" },
    { at: 0.55, top: "#6fb4ea", mid: "#b3dcfa", low: "#dce8c8" },
    { at: 0.78, top: "#7088a8", mid: "#e8b498", low: "#ffc878" },
    { at: 1, top: "#4a5568", mid: "#c87858", low: "#ff9060" },
  ];

  function hexRgb(hex) {
    const h = hex.replace("#", "");
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  }

  function mixHex(a, b, t) {
    const A = hexRgb(a);
    const B = hexRgb(b);
    const ch = (i) => Math.round(A[i] + (B[i] - A[i]) * t);
    return `#${[ch(0), ch(1), ch(2)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  }

  function skyColors(progress) {
    const p = Math.max(0, Math.min(1, progress));
    for (let i = 0; i < SKY_PALETTE.length - 1; i += 1) {
      const left = SKY_PALETTE[i];
      const right = SKY_PALETTE[i + 1];
      if (p <= right.at) {
        const t = (p - left.at) / (right.at - left.at || 1);
        return {
          top: mixHex(left.top, right.top, t),
          mid: mixHex(left.mid, right.mid, t),
          low: mixHex(left.low, right.low, t),
        };
      }
    }
    const last = SKY_PALETTE[SKY_PALETTE.length - 1];
    return { top: last.top, mid: last.mid, low: last.low };
  }

  function dayProgress() {
    if (!state || state.screen !== "game") return 0;
    return Math.max(0, Math.min(1, minutesUsed() / G.DAY_MINUTES));
  }

  function skyMinutesForDisplay() {
    if (skyMinutesOverride != null) return skyMinutesOverride;
    return minutesUsed();
  }

  function skyStretch() {
    const route = document.getElementById("route");
    if (!route || !route.clientHeight) return 1;
    const sx = route.clientWidth / SCENERY_W;
    const sy = route.clientHeight / 100;
    return sy ? sx / sy : 1;
  }

  function sunScenePoint(progress) {
    const p = Math.max(0, Math.min(1, progress));
    const t = Math.PI * (1 - p);
    const lift = Math.sin(t);
    const vx = 600 + Math.cos(t) * 540;
    const hill = hillWave(Math.max(0, Math.min(1199, vx)), 46, 3.8, 2.1, 0, 0.72) + hillShiftVb;
    const vy = hill - lift * (hill - 4);
    const k = skyStretch() || 1;
    return { x: vx, y: vy / k };
  }

  function cumulusCloud(x, y, scale, drift) {
    return `<g class="sky-cloud" data-base-x="${x}" data-base-y="${y}" data-scale="${scale}" data-drift="${drift}">
      <ellipse cx="0" cy="6" rx="28" ry="9.5" fill="#dce6f0" opacity="0.95"/>
      <ellipse cx="-18" cy="7" rx="16" ry="8" fill="#e8eef6"/>
      <ellipse cx="16" cy="6.5" rx="18" ry="9" fill="#eef3f9"/>
      <ellipse cx="-2" cy="2" rx="22" ry="12" fill="#fff"/>
      <ellipse cx="14" cy="1.5" rx="15" ry="11" fill="#fff"/>
      <ellipse cx="-10" cy="3" rx="12" ry="9" fill="#fafcfe"/>
    </g>`;
  }

  function sceneryHtml() {
    const w = 1200;
    const far = hillLayerPath(w, 46, 3.8, 2.1, 0, 1100, 0.72);
    const mid = hillLayerPath(w, 58, 5.2, 2.8, 40, 900, 0.75);
    const near = hillLayerPath(w, ROAD_HILL.base, ROAD_HILL.amp1, ROAD_HILL.amp2, ROAD_HILL.phase, 800);
    const front = hillLayerPath(w, 84, 6, 3.2, 160, 700);
    const clouds = [
      cumulusCloud(-80, 5, 0.46, 0.4),
      cumulusCloud(95, 16, 0.74, 0.8),
      cumulusCloud(270, 36, 1.08, 1.25),
      cumulusCloud(445, 7, 0.5, 0.45),
      cumulusCloud(620, 18, 0.8, 0.9),
      cumulusCloud(795, 34, 1.02, 1.15),
      cumulusCloud(970, 11, 0.58, 0.55),
      cumulusCloud(1145, 26, 0.9, 1.05),
      cumulusCloud(1320, 6, 0.48, 0.42),
    ].join("");
    return `<div class="scenery" aria-hidden="true">
      <svg class="landscape" viewBox="0 0 ${w} 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop id="sky-stop-top" offset="0%" stop-color="#8eb0d8"/>
            <stop id="sky-stop-mid" offset="55%" stop-color="#c8ddf4"/>
            <stop id="sky-stop-low" offset="100%" stop-color="#fde8c8"/>
          </linearGradient>
          <radialGradient id="sunHalo" cx="50%" cy="50%" r="50%">
            <stop id="sun-halo-inner" offset="0%" stop-color="#fff8e6"/>
            <stop offset="28%" stop-color="#ffe9a3"/>
            <stop id="sun-halo-mid" offset="58%" stop-color="#ffd066" stop-opacity="0.55"/>
            <stop offset="100%" stop-color="#ffb830" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <rect width="${w}" height="100" fill="url(#skyGrad)"/>
        <g class="sky-sun-rig">
          <g class="sky-sun">
            <circle class="sun-halo" r="26" fill="url(#sunHalo)"/>
            <circle class="sun-core-outer" r="11.5" fill="#fff4d6"/>
            <circle class="sun-core" r="9.2" fill="#ffdc7a"/>
          </g>
        </g>
        <g class="sky-decor">${clouds}</g>
        <g class="hill-stack">
          <g class="hill-layer" data-depth="0.18"><path class="hill-far" d="${far}"/></g>
          <g class="hill-layer" data-depth="0.42"><path class="hill-mid" d="${mid}"/></g>
          <g class="hill-layer" data-depth="1"><path class="hill-near" d="${near}"/></g>
          <g class="hill-layer" data-depth="1.45"><path class="hill-front" d="${front}"/></g>
        </g>
      </svg>
    </div>`;
  }

  function routeHtml() {
    const doctors = dayDoctors().slice().reverse().map(stopHtml).join("");
    return `${doctors}
      <article class="stop center" data-stop="0" aria-label="Дом">
        <span class="pin" data-pin="0"></span>
        <svg class="home" viewBox="0 0 160 148" aria-hidden="true">
          <ellipse cx="78" cy="122" rx="50" ry="4.5" fill="#7fa062" opacity="0.35"/>
          <rect x="18" y="98" width="4" height="20" rx="0.4" fill="#6b4a34"/>
          <ellipse cx="16" cy="100" rx="8" ry="5.5" fill="#4d8b54"/>
          <ellipse cx="24" cy="96" rx="9" ry="6" fill="#3d7344"/>
          <ellipse cx="20" cy="90" rx="10" ry="7" fill="#35683e"/>
          <rect x="132" y="106" width="3" height="14" rx="0.3" fill="#6b4a34"/>
          <ellipse cx="130" cy="106" rx="6" ry="4" fill="#529456"/>
          <ellipse cx="136" cy="102" rx="7" ry="5" fill="#3f7a48"/>
          <rect x="48" y="114" width="64" height="5" fill="#d5cdc0"/>
          <rect x="50" y="70" width="60" height="46" fill="#f6f3ec"/>
          <rect x="50" y="70" width="6" height="46" fill="#e4ddd2"/>
          <polygon points="36,74 80,28 124,74" fill="#e14b3c"/>
          <polygon points="80,28 124,74 124,79 86,36" fill="#c4382e"/>
          <rect x="96" y="40" width="8" height="22" fill="#c4a48c"/>
          <path d="M96 46 h8 M96 52 h8 M96 58 h8" stroke="#b08b72" stroke-width="0.6"/>
          <rect x="94" y="36" width="12" height="4" rx="0.4" fill="#6a4632"/>
          <rect x="56" y="80" width="14" height="12" rx="0.4" fill="#f4fbff" stroke="#b7c9d6" stroke-width="0.7"/>
          <path d="M63 80 v12 M56 86 h14" stroke="#d5e3ec" stroke-width="0.45"/>
          <rect x="55.4" y="92" width="15.2" height="1.6" fill="#cfc6b8"/>
          <rect x="90" y="80" width="14" height="12" rx="0.4" fill="#f6e7c0" stroke="#b7c9d6" stroke-width="0.7"/>
          <path d="M97 80 v12 M90 86 h14" stroke="#e7d7b0" stroke-width="0.45"/>
          <rect x="89.4" y="92" width="15.2" height="1.6" fill="#cfc6b8"/>
          <rect x="68" y="78" width="24" height="3" rx="0.4" fill="#8d5a3c"/>
          <rect x="74" y="96" width="14" height="20" rx="0.4" fill="#3c342e"/>
          <rect x="75.5" y="97.5" width="5" height="7" rx="0.3" fill="#6a5344"/>
          <rect x="81.5" y="97.5" width="5" height="7" rx="0.3" fill="#6a5344"/>
          <rect x="75.5" y="106" width="5" height="8" rx="0.3" fill="#5c483c"/>
          <rect x="81.5" y="106" width="5" height="8" rx="0.3" fill="#5c483c"/>
          <circle cx="85.5" cy="107" r="0.7" fill="#e6d3b0"/>
          <rect x="70" y="116" width="22" height="2.5" fill="#e4dcd0"/>
          <ellipse cx="108" cy="120" rx="4" ry="1.6" fill="#c9c2b6"/>
          <ellipse cx="120" cy="122" rx="3.5" ry="1.4" fill="#d4cdc2"/>
          <text x="80" y="142" text-anchor="middle">Дом</text>
        </svg>
      </article>`;
  }

  function nameParts(full) {
    const parts = String(full).trim().split(/\s+/);
    const first = parts[0] || "";
    const last = parts.slice(1).join(" ");
    return { first, last: last || first };
  }

  function clinicSvg(seed, accent) {
    const faces = [
      { wall: "#f7f6f3", shade: "#e3e0d8", wing: "#eef2f3", glass: "#d5e6f0" },
      { wall: "#f8f3ec", shade: "#e6ddd0", wing: "#f4ebe3", glass: "#d3e5ef" },
      { wall: "#f4f7f8", shade: "#dbe3e8", wing: "#e7eef2", glass: "#d0e4f1" },
    ];
    const face = faces[seed % faces.length];
    const pane = (x, y, w, h, lit) => `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="0.5" fill="${lit ? "#f6e3b2" : "#f7fbfd"}" stroke="#b7c9d6" stroke-width="0.65"/><path d="M${x + w / 2} ${y} v${h} M${x} ${y + h * 0.42} h${w}" stroke="#d4e2ec" stroke-width="0.4"/><rect x="${x - 0.3}" y="${y + h}" width="${w + 0.6}" height="1.4" fill="#cfc7bb"/></g>`;
    const windows = [];
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        windows.push(pane(33 + col * 16, 64 + row * 20, 11, 12, (row * 4 + col + seed) % 5 === 0));
      }
    }
    windows.push(pane(9, 104, 12, 11, seed % 2 === 0));
    windows.push(pane(30, 136, 10, 12, false));
    windows.push(pane(86, 136, 10, 12, seed % 3 === 0));
    const floors = [];
    for (let i = 0; i < 6; i += 1) floors.push(`<rect x="100" y="${42 + i * 16}" width="20" height="1.1" fill="#ffffff" opacity="0.72"/>`);
    return `<svg viewBox="0 0 124 168" preserveAspectRatio="xMidYMax meet">
      <rect x="4" y="96" width="24" height="36" fill="${face.wing}"/>
      <rect x="2" y="92" width="28" height="5" fill="${accent}"/>
      <rect x="22" y="36" width="82" height="124" fill="${face.wall}"/>
      <rect x="22" y="36" width="7" height="124" fill="${face.shade}"/>
      <rect x="100" y="24" width="20" height="112" fill="${face.glass}"/>
      <rect x="100" y="24" width="20" height="4" fill="${accent}"/>
      <rect x="108.5" y="28" width="1.1" height="108" fill="#ffffff" opacity="0.5"/>
      ${floors.join("")}
      <rect x="20" y="32" width="84" height="6" fill="#fbfaf7"/>
      <rect x="18" y="29" width="88" height="3.5" fill="${accent}"/>
      <rect x="46" y="12" width="34" height="18" rx="1" fill="#e7eef3"/>
      <rect x="46" y="12" width="34" height="3" fill="#c5d3dc"/>
      <rect x="58" y="17" width="8" height="9" fill="#f7fbfd" stroke="#b7c9d6" stroke-width="0.5"/>
      <circle cx="63" cy="50" r="10.5" fill="#fff" stroke="#f0d2d0" stroke-width="0.7"/>
      <rect x="61.1" y="42.5" width="3.8" height="15" rx="0.5" fill="#e23b38"/>
      <rect x="55.5" y="48.1" width="15" height="3.8" rx="0.5" fill="#e23b38"/>
      ${windows.join("")}
      <rect x="22" y="128" width="82" height="28" fill="#efeae3"/>
      <rect x="40" y="124" width="46" height="5.5" rx="0.4" fill="${accent}"/>
      <rect x="49" y="130" width="28" height="30" rx="0.8" fill="#24343c"/>
      <rect x="51.5" y="132.5" width="10" height="20" fill="#d7eef8"/>
      <rect x="63.5" y="132.5" width="10" height="20" fill="#c5e4f4"/>
      <rect x="22" y="158" width="82" height="4" fill="#d3ccc0"/>
      <rect x="46" y="162" width="34" height="2.5" fill="#e6dfd4"/>
    </svg>`;
  }

  function stopHtml(doctor) {
    const spec = G.specialtyOf(doctor.specialty);
    return `<article class="stop at-clinic" data-stop="${doctor.id}">
      <button type="button" class="clinic-hit" style="--spec:${spec.color}" data-action="select-doctor" data-id="${doctor.id}" aria-label="${esc(doctor.name)}, ${esc(spec.label)}">
        <span class="clinic-banner">
          <span class="banner-time" data-meta="travel" hidden>
            <svg class="banner-time-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12.5" r="7.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 8.2v4.8l2.8 1.7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span class="banner-time-val"></span>
          </span>
          <span class="banner-split" aria-hidden="true"></span>
          <span class="banner-pts banner-pts-open">
            <strong class="num" data-meta="pts">${doctor.points}</strong>
            <span class="banner-unit" data-meta="unit">баллов</span>
          </span>
          <span class="banner-pts banner-pts-done">
            <svg class="banner-check" viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 12.5 9.5 16.5 18.5 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span class="banner-score">
              <strong class="num" data-meta="seal">0</strong>
              <span class="banner-unit" data-meta="seal-unit">баллов</span>
            </span>
          </span>
        </span>
        <span class="clinic" aria-hidden="true">${clinicSvg(doctor.slot, spec.color)}</span>
      </button>
      <span class="pin" data-pin="${doctor.id}"></span>
    </article>`;
  }

  function updateHud() {
    const name = document.getElementById("hud-name");
    if (!name) return;
    name.textContent = state.name;
    document.getElementById("hud-score").textContent = G.formatScore(state.score);
    document.getElementById("hud-clock").textContent = G.formatClock(minutesUsed());
    document.getElementById("hud-left").textContent = `ещё ${G.formatDuration(state.minutesLeft)}`;
    document.getElementById("daybar-fill").style.width = `${(minutesUsed() / G.DAY_MINUTES) * 100}%`;
  }

  function formatTravel(mins) {
    const hours = Math.floor(mins / 60);
    const minutes = mins % 60;
    if (hours && minutes) return `${hours} ч ${minutes} мин`;
    if (hours) return `${hours} ч`;
    return `${minutes} мин`;
  }

  function updateStops() {
    dayDoctors().forEach((doctor) => {
      const stop = document.querySelector(`[data-stop="${doctor.id}"]`);
      if (!stop) return;
      const here = mapPosition();
      const visited = state.visited.includes(doctor.id);
      const travel = G.travelMinutes(state.route, here, doctor.id);
      const affordable = !visited && travel + G.VISIT_MINUTES <= state.minutesLeft;
      const entry = state.log.find((item) => item.doctorId === doctor.id);
      const holdFace = flipHold === doctor.id || (state.phase === "result" && state.lastResult?.doctorId === doctor.id);
      stop.classList.toggle("is-current", here === doctor.id);
      stop.classList.toggle("is-visited", visited && !holdFace);
      stop.classList.toggle("is-locked", !visited && !affordable);
      stop.classList.toggle("is-selected", state.phase === "confirm" && state.selectedDoctor === doctor.id);
      stop.dataset.outcome = entry ? entry.outcome : "";
      const button = stop.querySelector("button");
      if (button) {
        button.disabled = visited || !affordable || here === doctor.id;
        if (visited && entry) {
          button.setAttribute("aria-label", `${doctor.name}. Визит завершен, ${G.formatScore(entry.points)} баллов.`);
        } else {
          button.removeAttribute("aria-label");
        }
      }
      const sealEl = stop.querySelector("[data-meta='seal']");
      const unitEl = stop.querySelector("[data-meta='seal-unit']");
      if (sealEl && entry) {
        const points = Math.round(entry.points);
        sealEl.textContent = G.formatScore(points);
        if (unitEl) unitEl.textContent = G.plural(points, "балл", "балла", "баллов");
      }
      const travelEl = stop.querySelector("[data-meta='travel']");
      const ptsEl = stop.querySelector("[data-meta='pts']");
      const unitOpen = stop.querySelector("[data-meta='unit']");
      const pointsNow = visited && entry ? Math.round(entry.points) : doctor.points;
      if (unitOpen) unitOpen.textContent = G.plural(doctor.points, "балл", "балла", "баллов");
      if (visited && entry) {
        travelEl.hidden = true;
        ptsEl.textContent = `+${G.formatScore(entry.points)}`;
      } else if (here === doctor.id || travel === 0) {
        travelEl.hidden = true;
        ptsEl.textContent = G.formatScore(doctor.points);
      } else {
        travelEl.hidden = false;
        const travelText = travelEl.querySelector(".banner-time-val");
        if (travelText) travelText.textContent = formatTravel(travel);
        ptsEl.textContent = G.formatScore(doctor.points);
      }
      const timeBit = travelEl.hidden ? "" : `, дорога ${formatTravel(travel)}`;
      const scoreBit = visited && entry ? G.formatScore(entry.points) : G.formatScore(pointsNow);
      if (button && !(visited && entry)) {
        button.setAttribute("aria-label", `${doctor.name}, ${G.specialtyOf(doctor.specialty).label}${timeBit}, ${scoreBit} баллов.`);
      }
    });
    document.querySelector('[data-stop="0"]')?.classList.toggle("is-current", mapPosition() === 0);
    syncDayEnd();
  }

  function syncDayEnd() {
    const card = document.getElementById("day-end");
    const game = document.querySelector(".game");
    if (!card || !game || !state) return;
    const show = state.screen === "game" && state.phase === "map" && state.visited.length < state.route.length && !hasMove();
    card.hidden = !show;
    game.classList.toggle("has-day-end", show);
    const note = document.getElementById("day-end-note");
    if (!show || !note) return;
    note.textContent = state.minutesLeft <= 0
      ? "Рабочий день закончился."
      : `Осталось ${G.formatDuration(state.minutesLeft)}. На следующую поездку и визит уже не хватает.`;
  }

  function placeIdForSlot(slot) {
    if (slot === 0) return 0;
    return state.route[slot - 1];
  }

  function parentPlace(placeId) {
    const slot = state.route.indexOf(placeId) + 1;
    if (!slot) return null;
    return placeIdForSlot(G.parentSlot(slot));
  }

  function roadLowerY(x, routeW, routeH) {
    const here = terrainYpx(x, routeW, routeH);
    const prev = terrainYpx(x - 14, routeW, routeH);
    const next = terrainYpx(x + 14, routeW, routeH);
    let tx = 28;
    let ty = next - prev;
    const len = Math.hypot(tx, ty) || 1;
    tx /= len;
    ty /= len;
    const ny = tx;
    const fore = here + ny * 10 - 1;
    const back = here - ny * 17 + 7;
    return Math.max(fore, back) - 14;
  }

  function clinicClipPath(pinX, roadY, routeW, routeH) {
    const steps = 10;
    const clinicTop = roadY + CLINIC_SINK - CLINIC_H;
    const edge = [];
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const x = pinX - CLINIC_W / 2 + CLINIC_W * t;
      const local = (roadLowerY(x, routeW, routeH) - clinicTop) / CLINIC_H;
      const pct = Math.max(0, Math.min(100, local * 100));
      edge.push(`${(t * 100).toFixed(1)}% ${pct.toFixed(1)}%`);
    }
    return `polygon(0% 0%, 100% 0%, ${edge.reverse().join(", ")})`;
  }

  function placeStops() {
    const route = document.getElementById("route");
    const pad = 10;
    const routeH = route.clientHeight;
    const routeW = routeWidthPx();
    const halfWave = ((ROAD_HILL.amp1 + ROAD_HILL.amp2) / 100) * routeH;
    const basePx = (ROAD_HILL.base / 100) * routeH;
    const stack = CLINIC_H - CLINIC_SINK + BANNER_GAP + BANNER_H + 8;
    const highest = basePx - halfWave;
    const lowestBase = basePx + halfWave;
    let lift = Math.max(0, stack + pad - highest);
    if (lowestBase + lift > routeH - pad) lift = Math.max(0, routeH - pad - lowestBase);
    roadLiftPx = lift;
    hillShiftVb = routeH > 0 ? roadLiftPx * (100 / routeH) : 0;
    route.style.setProperty("--clinic-w", `${CLINIC_W}px`);
    route.style.setProperty("--clinic-h", `${CLINIC_H}px`);
    route.style.setProperty("--clinic-sink", `${CLINIC_SINK}px`);
    route.style.setProperty("--banner-gap", `${BANNER_GAP}px`);
    route.querySelector(".hill-stack")?.setAttribute("transform", `translate(0 ${hillShiftVb.toFixed(2)})`);
    route.style.width = `${routeW}px`;
    const bySlot = new Map(dayDoctors().map((doctor) => [doctor.slot, doctor]));
    for (let slot = 1; slot <= G.ROAD_STOPS; slot += 1) {
      const doctor = bySlot.get(slot);
      const el = route.querySelector(`[data-stop="${doctor.id}"]`);
      if (!el) continue;
      const pinX = slotPinX(slot);
      const roadY = terrainYpx(pinX, routeW, routeH);
      el.classList.remove("above", "below", "center");
      el.classList.add("at-clinic");
      el.style.left = `${pinX}px`;
      el.style.top = `${Math.round(roadY)}px`;
      const pin = el.querySelector(".pin");
      if (pin) {
        pin.style.left = "0px";
        pin.style.top = "0px";
        pin.style.bottom = "auto";
        pin.style.transform = "translate(-50%, -50%)";
      }
      const clinic = el.querySelector(".clinic");
      if (clinic) clinic.style.clipPath = clinicClipPath(pinX, roadY, routeW, routeH);
    }
    const home = route.querySelector('[data-stop="0"]');
    if (home) {
      const homeH = home.offsetHeight || 154;
      const homeW = home.offsetWidth || HOME_W;
      const pinX = EDGE_X + homeW;
      const roadY = terrainYpx(pinX, routeW, routeH);
      home.style.left = `${EDGE_X}px`;
      home.style.top = `${Math.round(roadY - homeH * HOME_PIN_Y)}px`;
    }
  }

  function measurePins() {
    const route = document.getElementById("route");
    const origin = route.getBoundingClientRect();
    return [0, ...state.route].map((id) => {
      const pin = route.querySelector(`[data-pin="${id}"]`);
      const rect = pin.getBoundingClientRect();
      return {
        id,
        x: rect.left + rect.width / 2 - origin.left,
        y: rect.top + rect.height / 2 - origin.top,
      };
    });
  }

  function terrainSegmentSamples(a, b, routeW, routeH) {
    const dx = b.x - a.x;
    const steps = Math.max(16, Math.ceil(Math.abs(dx) / 18));
    const samples = [];
    for (let i = 0; i <= steps; i += 1) {
      const x = a.x + (dx * i) / steps;
      samples.push({ x, y: terrainYpx(x, routeW, routeH) });
    }
    if (samples.length) {
      samples[0] = { x: a.x, y: a.y };
      samples[samples.length - 1] = { x: b.x, y: b.y };
    }
    return samples;
  }

  function edgeKey(a, b) {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  }

  function buildRoad(routeHeight, routeWidth) {
    const pins = measurePins();
    pinById = {};
    pins.forEach((pin) => {
      pinById[pin.id] = pin;
    });
    edgeByKey = {};
    const segs = [];
    for (let slot = 1; slot <= G.ROAD_STOPS; slot += 1) {
      const childId = placeIdForSlot(slot);
      const parentId = placeIdForSlot(G.parentSlot(slot));
      const a = pinById[parentId];
      const b = pinById[childId];
      if (!a || !b) continue;
      const samples = terrainSegmentSamples(a, b, routeWidth, routeHeight);
      const marks = [0];
      let length = 0;
      for (let i = 1; i < samples.length; i += 1) {
        length += Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y);
        marks.push(length);
      }
      const seg = { from: parentId, to: childId, parts: [], samples, marks, length };
      segs.push(seg);
      edgeByKey[edgeKey(parentId, childId)] = seg;
    }
    return segs;
  }

  function pointOnEdge(seg, fromId, distance) {
    const forward = seg.from === fromId;
    const along = forward
      ? Math.max(0, Math.min(seg.length, distance))
      : seg.length - Math.max(0, Math.min(seg.length, distance));
    const { samples, marks } = seg;
    let index = marks.length - 1;
    for (let i = 1; i < marks.length; i += 1) {
      if (along <= marks[i]) {
        index = i;
        break;
      }
    }
    const prev = samples[Math.max(0, index - 1)];
    const next = samples[Math.min(samples.length - 1, index)];
    const span = (marks[index] - marks[Math.max(0, index - 1)]) || 1;
    const u = index === 0 ? 0 : (along - marks[index - 1]) / span;
    const point = {
      x: prev.x + (next.x - prev.x) * u,
      y: prev.y + (next.y - prev.y) * u,
    };
    const aim = forward
      ? { x: next.x - prev.x, y: next.y - prev.y }
      : { x: prev.x - next.x, y: prev.y - next.y };
    return { point, aim };
  }

  function syncSkyDecorScale() {
    const route = document.getElementById("route");
    if (!route) return;
    const sx = route.clientWidth / SCENERY_W;
    const sy = route.clientHeight / 100;
    if (!sy) return;
    const fix = `scale(1 ${(sx / sy).toFixed(5)})`;
    route.querySelector(".sky-decor")?.setAttribute("transform", fix);
    route.querySelector(".sky-sun-rig")?.setAttribute("transform", fix);
  }

  function applySkyProgress(progress) {
    if (!state || state.screen !== "game") return;
    const route = document.getElementById("route");
    if (!route) return;
    const p = Math.max(0, Math.min(1, progress));
    const colors = skyColors(p);
    route.querySelector("#sky-stop-top")?.setAttribute("stop-color", colors.top);
    route.querySelector("#sky-stop-mid")?.setAttribute("stop-color", colors.mid);
    route.querySelector("#sky-stop-low")?.setAttribute("stop-color", colors.low);
    const sun = route.querySelector(".sky-sun");
    if (sun) {
      const point = sunScenePoint(p);
      sun.setAttribute("transform", `translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})`);
    }
    const warm = Math.max(0, (p - 0.55) / 0.45);
    route.querySelector("#sun-halo-inner")?.setAttribute(
      "stop-color",
      mixHex("#fff8e6", "#ffe0b8", warm)
    );
    route.querySelector("#sun-halo-mid")?.setAttribute(
      "stop-color",
      mixHex("#ffd066", "#ff9848", warm)
    );
    route.querySelector(".sun-core-outer")?.setAttribute(
      "fill",
      mixHex("#fff4d6", "#ffd8a8", warm)
    );
    route.querySelector(".sun-core")?.setAttribute(
      "fill",
      mixHex("#ffdc7a", "#ff9a42", warm)
    );
    route.querySelector(".sun-halo")?.setAttribute("opacity", String(0.88 + warm * 0.1));
    document.getElementById("map-scroll")?.style.setProperty(
      "background",
      mixHex("#b9e2fb", "#c88868", warm * 0.65)
    );
  }

  function updateCloudMotion(now) {
    const route = document.getElementById("route");
    if (!route) return;
    const span = 1560;
    const left = -160;
    route.querySelectorAll(".sky-cloud").forEach((el) => {
      const bx = Number(el.dataset.baseX);
      const by = Number(el.dataset.baseY);
      const sc = Number(el.dataset.scale);
      const drift = Number(el.dataset.drift) || 1;
      let x = bx;
      let y = by;
      if (motionMs(1) !== 0) {
        const travel = (now / 1000) * 8 * drift;
        x = left + ((((bx - left + travel) % span) + span) % span);
        y = by + Math.sin(now * 0.00012 * drift + bx * 0.01) * 0.45;
      }
      el.setAttribute("transform", `translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${sc})`);
    });
  }

  function startSkyTrip(usedBefore, travelMins, durationMs) {
    const from = usedBefore / G.DAY_MINUTES;
    const to = (usedBefore + travelMins) / G.DAY_MINUTES;
    skyMinutesOverride = usedBefore + travelMins;
    skyTrip = {
      from,
      to,
      start: performance.now(),
      duration: Math.max(1, durationMs),
    };
    applySkyProgress(from);
  }

  function skyFrame(now) {
    if (state?.screen !== "game") {
      stopSkyLoop();
      return;
    }
    let progress;
    if (skyTrip) {
      const t = Math.min(1, (now - skyTrip.start) / skyTrip.duration);
      progress = skyTrip.from + (skyTrip.to - skyTrip.from) * easeInOut(t);
      if (t >= 1) skyTrip = null;
    } else {
      progress = skyMinutesForDisplay() / G.DAY_MINUTES;
    }
    applySkyProgress(progress);
    updateCloudMotion(now);
    syncSkyDecorScale();
    syncCityParallax();
    skyRafId = requestAnimationFrame(skyFrame);
  }

  function startSkyLoop() {
    stopSkyLoop();
    skyTrip = null;
    skyRafId = requestAnimationFrame(skyFrame);
  }

  function stopSkyLoop() {
    if (skyRafId) cancelAnimationFrame(skyRafId);
    skyRafId = 0;
    skyTrip = null;
  }

  function layoutRoad() {
    if (driving) return;
    const route = document.getElementById("route");
    const svg = document.getElementById("road");
    const scroller = document.getElementById("map-scroll");
    if (!route || !svg || !scroller || state?.screen !== "game") return;
    const h = Math.round(route.clientHeight);
    if (h < 10 || scroller.clientWidth < 10) return;
    const stamp = `${scroller.clientWidth}x${h}:${state.route.join(",")}`;
    if (stamp === roadStamp) return;
    roadStamp = stamp;
    placeStops();
    const w = Math.round(route.clientWidth);
    const segs = buildRoad(h, w);
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.setAttribute("width", String(w));
    svg.setAttribute("height", String(h));
    svg.style.width = `${w}px`;
    svg.style.height = `${h}px`;
    svg.setAttribute("preserveAspectRatio", "none");
    const d = curve(segs);
    const samples = samplesFromSegs(segs);
    const body = ribbonPath(samples, 10, 17);
    svg.innerHTML = `<defs>
        <linearGradient id="roadSideGrad" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${h}">
          <stop offset="0%" stop-color="#7a8496"/>
          <stop offset="42%" stop-color="#505a6c"/>
          <stop offset="100%" stop-color="#232a38"/>
        </linearGradient>
      </defs>
      <path class="road-body" d="${body}"></path>
      <path class="road-lip" d="${d}"></path>
      <path class="road-mark" d="${d}"></path>`;
    placeSkyline(samples);
    syncSkyDecorScale();
  }

  function roadCrownAt(samples, x) {
    if (!samples.length) return { x, y: 0 };
    if (x <= samples[0].x) return roadCrown(samples, 0);
    const last = samples.length - 1;
    if (x >= samples[last].x) return roadCrown(samples, last);
    let index = 1;
    while (index < last && samples[index].x < x) index += 1;
    const a = samples[index - 1];
    const b = samples[index];
    const span = b.x - a.x || 1;
    const t = (x - a.x) / span;
    const point = {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
    };
    let tx = b.x - a.x;
    let ty = b.y - a.y;
    const len = Math.hypot(tx, ty) || 1;
    tx /= len;
    ty /= len;
    return { x: point.x + ty * 11, y: point.y + 6 };
  }

  function roadCrown(samples, index) {
    const point = samples[index];
    const prev = samples[Math.max(0, index - 1)];
    const next = samples[Math.min(samples.length - 1, index + 1)];
    let tx = next.x - prev.x;
    let ty = next.y - prev.y;
    const len = Math.hypot(tx, ty) || 1;
    tx /= len;
    ty /= len;
    return {
      x: point.x + ty * 11,
      y: point.y + 6,
    };
  }

  function buildingSvg(kind, seed) {
    if (kind === "tower") {
      const glass = seed % 2 ? "#8eafc9" : "#6e92b0";
      const pane = seed % 2 ? "#e7f3fb" : "#d5e8f6";
      const windows = [];
      for (let row = 0; row < 11; row += 1) {
        for (let col = 0; col < 3; col += 1) {
          const lit = (row * 3 + col + seed) % 7 === 0;
          windows.push(`<rect x="${7 + col * 9}" y="${18 + row * 10}" width="6.2" height="6.4" rx="0.4" fill="${lit ? "#f3e2b0" : pane}"/>`);
        }
      }
      return `<svg viewBox="0 0 40 140" preserveAspectRatio="xMidYMax meet">
        <rect x="6" y="12" width="28" height="128" fill="${glass}"/>
        <rect x="6" y="12" width="28" height="4" fill="#2c3c4c"/>
        <rect x="10" y="8" width="20" height="5" fill="#3d5164"/>
        ${windows.join("")}
        <rect x="6" y="134" width="28" height="6" fill="#2c3c4c"/>
      </svg>`;
    }
    if (kind === "block") {
      const wall = seed % 2 ? "#f4efe4" : "#e7d3b4";
      const windows = [];
      for (let row = 0; row < 4; row += 1) {
        for (let col = 0; col < 3; col += 1) {
          windows.push(`<rect x="${8 + col * 12}" y="${16 + row * 16}" width="8" height="10" rx="0.4" fill="#f7fbff" stroke="#8aa4b8" stroke-width="0.6"/>`);
          windows.push(`<path d="M${12 + col * 12} ${16 + row * 16} v10 M${8 + col * 12} ${21 + row * 16} h8" stroke="#c5d5e2" stroke-width="0.5"/>`);
        }
      }
      return `<svg viewBox="0 0 48 104" preserveAspectRatio="xMidYMax meet">
        <rect x="4" y="8" width="40" height="96" fill="${wall}"/>
        <rect x="2" y="6" width="44" height="5" fill="#c45a4a"/>
        <rect x="4" y="78" width="40" height="26" fill="#e4d2b8"/>
        ${windows.join("")}
        <rect x="19" y="86" width="10" height="18" rx="0.6" fill="#3c4a58"/>
        <rect x="4" y="100" width="40" height="4" fill="#c9b89a"/>
      </svg>`;
    }
    const roof = seed % 2 ? "#c4533f" : "#3d5c8a";
    const wall = seed % 2 ? "#fbf6ee" : "#f3e6cf";
    return `<svg viewBox="0 0 64 74" preserveAspectRatio="xMidYMax meet">
      <rect x="10" y="70" width="44" height="4" fill="#d9cdb8"/>
      <rect x="12" y="32" width="40" height="38" fill="${wall}"/>
      <polygon points="6,34 32,12 58,34" fill="${roof}"/>
      <rect x="46" y="18" width="6" height="16" fill="#8d5a45"/>
      <rect x="44" y="16" width="10" height="3" fill="#6e4636"/>
      <rect x="16" y="40" width="12" height="10" rx="0.5" fill="#f7fbff" stroke="#9bb0c2" stroke-width="0.7"/>
      <rect x="36" y="40" width="12" height="10" rx="0.5" fill="#f7fbff" stroke="#9bb0c2" stroke-width="0.7"/>
      <path d="M22 40 v10 M16 45 h12 M42 40 v10 M36 45 h12" stroke="#d5e2ec" stroke-width="0.6"/>
      <rect x="27" y="52" width="10" height="18" rx="0.5" fill="#4a4038"/>
      <circle cx="35" cy="61" r="0.7" fill="#e6d7c4"/>
    </svg>`;
  }

  function placeSkyline(samples) {
    roadSamples = samples;
    const layer = document.getElementById("skyline");
    if (!layer || samples.length < 2) return;
    const end = samples[samples.length - 1].x;
    const bands = [
      { depth: 0.94, step: 36, scale: 0.58, kinds: ["house", "block", "house", "tower"] },
      { depth: 0.97, step: 58, scale: 0.8, kinds: ["block", "tower", "house", "tower"] },
      { depth: 0.99, step: 92, scale: 1, kinds: ["tower", "house", "block", "tower", "house"] },
    ];
    layer.innerHTML = bands.map((band, bandIndex) => {
      const blocks = [];
      let n = 0;
      for (let x = 16 + bandIndex * 14; x < end - 12; x += band.step * (0.82 + (n % 3) * 0.14)) {
        const kind = band.kinds[n % band.kinds.length];
        const tall = (kind === "tower" ? 165 : kind === "block" ? 120 : 80) * band.scale;
        const wide = (kind === "tower" ? 45 : kind === "block" ? 55 : 65) * band.scale;
        blocks.push(`<span class="city-block" data-x="${x.toFixed(1)}" style="width:${wide.toFixed(0)}px;height:${tall.toFixed(0)}px">${buildingSvg(kind, n + bandIndex * 5)}</span>`);
        n += 1;
      }
      return `<div class="city-layer" data-depth="${band.depth}">${blocks.join("")}</div>`;
    }).join("");
    cityBlocks = [...layer.querySelectorAll(".city-block")].map((el) => ({
      el,
      anchor: Number(el.dataset.x),
      depth: Number(el.parentElement.dataset.depth) || 1,
    }));
    cityScroll = null;
    syncCityParallax();
  }

  function syncCityParallax() {
    const scroller = document.getElementById("map-scroll");
    if (!scroller || !roadSamples.length || !cityBlocks.length) return;
    const target = scroller.scrollLeft;
    if (cityScroll == null) cityScroll = target;
    else cityScroll += (target - cityScroll) * 0.16;
    if (Math.abs(target - cityScroll) < 0.25) cityScroll = target;
    cityBlocks.forEach((block) => {
      const ground = roadCrownAt(roadSamples, block.anchor + cityScroll * (1 - block.depth));
      block.el.style.transform = `translate3d(${ground.x.toFixed(2)}px, ${ground.y.toFixed(2)}px, 0) translate(-50%, -100%)`;
    });
  }

  function samplesFromSegs(segs) {
    const out = [];
    segs.forEach((seg, index) => {
      seg.samples.forEach((point, i) => {
        if (index > 0 && i === 0) return;
        out.push(point);
      });
    });
    return out;
  }

  function ribbonPath(samples, topOffset, bottomOffset) {
    if (samples.length < 2) return "";
    const top = [];
    const bottom = [];
    for (let i = 0; i < samples.length; i += 1) {
      const prev = samples[Math.max(0, i - 1)];
      const next = samples[Math.min(samples.length - 1, i + 1)];
      let tx = next.x - prev.x;
      let ty = next.y - prev.y;
      const len = Math.hypot(tx, ty) || 1;
      tx /= len;
      ty /= len;
      const nx = -ty;
      const ny = tx;
      const p = samples[i];
      top.push({ x: p.x + nx * topOffset, y: p.y + ny * topOffset - 1 });
      bottom.push({ x: p.x - nx * bottomOffset, y: p.y - ny * bottomOffset + 7 });
    }
    const pt = (point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    let path = `M ${pt(top[0])}`;
    for (let i = 1; i < top.length; i += 1) path += ` L ${pt(top[i])}`;
    for (let i = bottom.length - 1; i >= 0; i -= 1) path += ` L ${pt(bottom[i])}`;
    return `${path} Z`;
  }

  function curve(segs) {
    return segs.map((seg) => {
      if (!seg.samples?.length) return "";
      return seg.samples.map((point, index) => {
        const cmd = index === 0 ? "M" : "L";
        return `${cmd} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
      }).join(" ");
    }).join(" ");
  }

  function mapPosition() {
    return state.phase === "travel" && state.travelFrom != null ? state.travelFrom : state.position;
  }

  function poseCarAt(point, aim) {
    const token = document.getElementById("token");
    if (!token || !point) return;
    token.style.left = `${point.x}px`;
    token.style.top = `${point.y}px`;
    if (aim && aim.x * aim.x + aim.y * aim.y > 0.01) {
      token.style.transform = `rotate(${Math.atan2(aim.y, aim.x) * (180 / Math.PI)}deg)`;
    }
  }

  function placeToken(stopId) {
    const here = pinById[stopId];
    if (!here) return;
    let aim = { x: 1, y: 0 };
    if (stopId === 0) {
      const next = pinById[placeIdForSlot(1)];
      if (next) aim = { x: next.x - here.x, y: next.y - here.y };
    } else {
      const parent = pinById[parentPlace(stopId)];
      if (parent) aim = { x: here.x - parent.x, y: here.y - parent.y };
    }
    poseCarAt(here, aim);
  }

  function syncHillParallax() {
    const scroller = document.getElementById("map-scroll");
    const route = document.getElementById("route");
    if (!scroller || !route || !route.clientWidth) return;
    const unit = SCENERY_W / route.clientWidth;
    route.querySelectorAll(".hill-layer").forEach((layer) => {
      const depth = Number(layer.dataset.depth);
      const shift = scroller.scrollLeft * (1 - depth) * unit;
      layer.setAttribute("transform", `translate(${shift.toFixed(2)} 0)`);
    });
  }

  function followCar() {
    const token = document.getElementById("token");
    const scroller = document.getElementById("map-scroll");
    if (!token || !scroller) return;
    const tokenRect = token.getBoundingClientRect();
    const scRect = scroller.getBoundingClientRect();
    const delta = tokenRect.left + tokenRect.width / 2 - (scRect.left + scRect.width / 2);
    scroller.scrollLeft += delta;
  }

  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
  }

  function driveCar(fromId, toId, travelMins, usedBeforeDepart, done) {
    const ids = G.placePath(state.route, fromId, toId);
    const hops = [];
    let total = 0;
    for (let i = 0; i < ids.length - 1; i += 1) {
      const seg = edgeByKey[edgeKey(ids[i], ids[i + 1])];
      if (!seg) {
        hops.length = 0;
        break;
      }
      hops.push({ seg, from: ids[i] });
      total += seg.length;
    }
    const skyMins = travelMins + G.VISIT_MINUTES;
    const travelProgress = (usedBeforeDepart + skyMins) / G.DAY_MINUTES;
    if (!hops.length || motionMs(1) === 0) {
      driving = false;
      applySkyProgress(travelProgress);
      skyMinutesOverride = usedBeforeDepart + skyMins;
      placeToken(toId);
      scrollToStop(toId, "center");
      done();
      return;
    }
    const id = ++driveToken;
    driving = true;
    const duration = Math.min(4800, Math.max(1500, total * 2.2));
    startSkyTrip(usedBeforeDepart, skyMins, duration);
    const started = performance.now();
    poseCarAt(pinById[fromId], pointOnEdge(hops[0].seg, hops[0].from, 0).aim);
    followCar();
    function frame(now) {
      if (id !== driveToken) return;
      const t = Math.min(1, (now - started) / duration);
      let remain = total * easeInOut(t);
      let hop = hops[0];
      for (let i = 0; i < hops.length; i += 1) {
        hop = hops[i];
        if (remain <= hop.seg.length || i === hops.length - 1) break;
        remain -= hop.seg.length;
      }
      const here = pointOnEdge(hop.seg, hop.from, remain);
      poseCarAt(here.point, here.aim);
      followCar();
      if (t < 1) {
        requestAnimationFrame(frame);
        return;
      }
      driving = false;
      placeToken(toId);
      done();
    }
    requestAnimationFrame(frame);
  }

  function placeMap() {
    if (!mapPinned || driving || state?.screen !== "game") return;
    const scroller = document.getElementById("map-scroll");
    if (!scroller) return;
    if ((state.position || 0) === 0) {
      scroller.scrollLeft = 0;
      return;
    }
    scrollToStop(state.position, "center");
  }

  function scrollToStop(id, align) {
    const el = document.querySelector(`[data-stop="${id}"]`);
    const scroller = document.getElementById("map-scroll");
    if (!el || !scroller) return;
    const elRect = el.getBoundingClientRect();
    const scRect = scroller.getBoundingClientRect();
    const delta = align === "end"
      ? elRect.right - scRect.right + 16
      : elRect.left - scRect.left - (scRect.width - elRect.width) / 2;
    scroller.scrollLeft += delta;
  }

  // A vertical wheel is the usual way to pan a desktop map that only scrolls sideways.
  function panOnWheel(event) {
    const scroller = event.currentTarget;
    if (!event.deltaY || event.deltaX) return;
    if (scroller.scrollHeight > scroller.clientHeight + 2) return;
    scroller.scrollLeft += event.deltaY;
    event.preventDefault();
  }

  function watchRoad() {
    const route = document.getElementById("route");
    roadObserver?.disconnect();
    if (!route || typeof ResizeObserver === "undefined") return;
    roadObserver = new ResizeObserver(() => {
      if (state?.screen !== "game" || driving) return;
      layoutRoad();
      placeToken(state.position);
      placeMap();
    });
    roadObserver.observe(route);
  }

  function renderOverlay() {
    const overlay = document.getElementById("overlay");
    const stage = document.querySelector(".stage");
    if (!overlay || !stage) return;
    const open = ["confirm", "visit", "result", "help", "finish"].includes(state.phase);
    stage.classList.toggle("is-modal", open || state.phase === "travel");
    stage.classList.toggle("is-busy", state.phase === "travel");
    if (!open) {
      overlay.hidden = true;
      overlay.innerHTML = "";
      return;
    }
    overlay.hidden = false;
    overlay.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${sheetHtml()}</div>`;
  }

  function sheetHtml() {
    if (state.phase === "confirm") return confirmHtml();
    if (state.phase === "visit") return visitHtml();
    if (state.phase === "result") return resultHtml();
    if (state.phase === "help") return helpHtml();
    if (state.phase === "finish") return finishHtml();
    return "";
  }

  function confirmHtml() {
    const doctor = dayDoctor(state.selectedDoctor);
    const spec = G.specialtyOf(doctor.specialty);
    const travel = G.travelMinutes(state.route, state.position, doctor.id);
    const total = travel + G.VISIT_MINUTES;
    const left = state.minutesLeft - total;
    const levels = Math.max(0, G.placePath(state.route, state.position, doctor.id).length - 1);
    const dislike = doctor.dislike ? G.drugById(doctor.dislike) : null;
    return `<div class="person">
        ${window.MPPortrait(doctor.id)}
        <div>
          <h2>${esc(doctor.name)}</h2>
          <p class="sub">${esc(spec.label)} · до ${esc(G.formatScore(doctor.points))} баллов</p>
        </div>
      </div>
      <p class="clock-note">От точки «${esc(placeLabel(state.position))}»: ${levels} ${G.plural(levels, "участок", "участка", "участков")} · ${esc(G.formatDuration(travel))} в пути и 30 минут визит. Вместе ${esc(G.formatDuration(total))}. После этого на часах ${G.formatClock(minutesUsed() + total)}, останется ${esc(G.formatDuration(left))}.</p>
      ${dislike ? `<p class="warn">Не назначает <b>${esc(dislike.name)}</b>.</p>` : ""}
      <ul class="outcomes">
        <li><span>Препарат по специальности</span><b>${esc(G.formatScore(doctor.points))}</b></li>
        <li><span>Другая специальность</span><b>${esc(G.formatScore(doctor.points / 2))}</b></li>
        <li><span>Нелюбимый препарат</span><b>0</b></li>
      </ul>
      <div class="stack">
        <button type="button" class="btn" data-action="depart">Поехать · ${esc(G.formatDuration(total))}</button>
        <button type="button" class="btn secondary" data-action="cancel">Остаться</button>
      </div>`;
  }

  function visitHtml() {
    const doctor = G.doctorById(state.position);
    const spec = G.specialtyOf(doctor.specialty);
    const dislike = doctor.dislike ? G.drugById(doctor.dislike) : null;
    const drugs = G.DRUGS.map((drug) => {
      const drugSpec = G.specialtyOf(drug.specialty);
      const picked = state.selectedDrug === drug.id;
      return `<button type="button" class="drug${picked ? " is-picked" : ""}" style="--spec:${drugSpec.color}" data-action="pick-drug" data-drug="${drug.id}" aria-pressed="${picked ? "true" : "false"}">
        <b>${esc(drug.name)}</b><small>для ${esc(drug.audience)}</small>
      </button>`;
    }).join("");
    return `<div class="person">
        ${window.MPPortrait(doctor.id)}
        <div>
          <p class="eyebrow">Визит</p>
          <h2>${esc(doctor.name)}</h2>
          <p class="sub">${esc(spec.label)}. Время дороги и визита уже списано. Сейчас ${G.formatClock(minutesUsed())}.</p>
        </div>
      </div>
      ${dislike ? `<p class="warn">Не назначает <b>${esc(dislike.name)}</b>.</p>` : ""}
      <p class="block-title">Какой препарат рассказать</p>
      <div class="drugs">${drugs}</div>
      <button type="button" class="btn" data-action="present" ${state.selectedDrug ? "" : "disabled"}>Рассказать о препарате</button>`;
  }

  function resultHtml() {
    const entry = state.lastResult;
    const doctor = G.doctorById(entry.doctorId);
    const drug = G.drugById(entry.drugId);
    const titles = { full: "Полные баллы", half: "Половина баллов", dislike: "Без баллов" };
    const stamps = { full: "Зачтено", half: "Половина", dislike: "Отказ" };
    const texts = {
      full: `${drug.name} совпал со специальностью «${G.specialtyOf(doctor.specialty).label.toLowerCase()}».`,
      half: `${drug.name} — препарат другой специальности. За визит начисляется половина.`,
      dislike: `${doctor.name.split(" ")[0]} не назначает ${drug.name}.`,
    };
    const nextLabel = state.visited.length === state.route.length ? "К итогам дня" : "Дальше по маршруту";
    return `<div class="result-head">
        <div>
          <p class="eyebrow">${esc(drug.name)}</p>
          <h2>${titles[entry.outcome]}</h2>
        </div>
        <div class="stamp ${entry.outcome}">${stamps[entry.outcome]}</div>
      </div>
      <p class="result-points ${entry.outcome} num">+${esc(G.formatScore(entry.points))}</p>
      <p class="sub">из ${esc(G.formatScore(entry.maxPoints))} · ${esc(texts[entry.outcome])}</p>
      <p class="clock-note">Счёт ${esc(G.formatScore(state.score))}. На часах ${G.formatClock(minutesUsed())}, ещё ${esc(G.formatDuration(state.minutesLeft))}.</p>
      <button type="button" class="btn" data-action="continue-day">${nextLabel}</button>`;
  }

  function helpHtml() {
    return `<p class="eyebrow">Как устроен день</p>
      <h2>Правила</h2>
      ${rulesListHtml()}
      <p class="block-title">Портфель</p>
      ${portfolioHtml()}
      <button type="button" class="btn" data-action="cancel">К маршруту</button>`;
  }

  function finishHtml() {
    return `<p class="eyebrow">До конца дня</p>
      <h2>Завершить день?</h2>
      <p class="clock-note">Сейчас ${esc(G.formatScore(state.score))} баллов, визитов ${state.visited.length} из ${state.route.length}. Осталось ${esc(G.formatDuration(state.minutesLeft))}.</p>
      <div class="stack">
        <button type="button" class="btn" data-action="finish-day">К итогам</button>
        <button type="button" class="btn secondary" data-action="cancel">Ещё визиты</button>
      </div>`;
  }

  function selectDoctor(id) {
    if (!state || (state.phase !== "map" && state.phase !== "confirm")) return;
    const doctorId = Number(id);
    const doctor = G.doctorById(doctorId);
    if (!doctor || state.visited.includes(doctorId) || doctorId === state.position) return;
    if (G.visitCost(state.route, state.position, doctorId) > state.minutesLeft) return;
    state.selectedDoctor = doctorId;
    state.phase = "confirm";
    updateStops();
    renderOverlay();
  }

  function closeSoft() {
    if (!state || !["confirm", "help", "finish"].includes(state.phase)) return;
    state.phase = "map";
    state.selectedDoctor = null;
    updateStops();
    renderOverlay();
  }

  function depart() {
    if (state.phase !== "confirm") return;
    const doctor = G.doctorById(state.selectedDoctor);
    if (!doctor) return;
    const travel = G.travelMinutes(state.route, state.position, doctor.id);
    const total = travel + G.VISIT_MINUTES;
    if (state.minutesLeft < total) return;
    const from = state.position;
    const usedBefore = minutesUsed();
    state.minutesLeft -= total;
    state.travelSpent += travel;
    state.visitSpent += G.VISIT_MINUTES;
    state.pending = { doctorId: doctor.id, travel };
    state.travelFrom = from;
    state.position = doctor.id;
    state.selectedDrug = null;
    state.selectedDoctor = null;
    state.phase = "travel";
    skyMinutesOverride = usedBefore;
    persist();
    updateHud();
    updateStops();
    renderOverlay();
    layoutRoad();
    driveCar(from, doctor.id, travel, usedBefore, () => {
      if (!state || state.phase !== "travel") return;
      state.travelFrom = null;
      state.phase = "visit";
      skyMinutesOverride = usedBefore + travel + G.VISIT_MINUTES;
      persist();
      updateHud();
      updateStops();
      renderOverlay();
    });
  }

  function pickDrug(id) {
    if (state.phase !== "visit" || !G.drugById(id)) return;
    state.selectedDrug = id;
    document.querySelectorAll("[data-drug]").forEach((button) => {
      const on = button.dataset.drug === id;
      button.classList.toggle("is-picked", on);
      button.setAttribute("aria-pressed", on ? "true" : "false");
    });
    const present = document.querySelector("[data-action='present']");
    if (present) present.disabled = false;
  }

  function present() {
    if (state.phase !== "visit" || !state.selectedDrug) return;
    skyMinutesOverride = null;
    const doctor = dayDoctor(state.position);
    const drug = G.drugById(state.selectedDrug);
    const result = G.scoreVisit(doctor, drug.id);
    state.score += result.points;
    if (!state.visited.includes(doctor.id)) state.visited.push(doctor.id);
    const entry = {
      doctorId: doctor.id,
      drugId: drug.id,
      points: result.points,
      maxPoints: doctor.points,
      outcome: result.outcome,
      travel: state.pending?.travel ?? G.travelMinutes(state.route, 0, doctor.id),
    };
    state.log.push(entry);
    state.lastResult = entry;
    state.pending = null;
    state.selectedDrug = null;
    state.phase = "result";
    persist();
    updateHud();
    updateStops();
    renderOverlay();
    renderPanels();
    const live = document.getElementById("live");
    if (live) live.textContent = `${doctor.name}: ${result.points} баллов. Счёт ${state.score}.`;
  }

  function continueDay() {
    if (state.phase !== "result") return;
    const finished = state.lastResult?.doctorId;
    const done = state.visited.length === state.route.length;
    flipHold = finished;
    state.phase = "map";
    state.lastResult = null;
    persist();
    renderOverlay();
    updateHud();
    updateStops();
    flipFinishedCard(finished, done);
  }

  function flipFinishedCard(id, done) {
    const stop = id == null ? null : document.querySelector(`[data-stop="${id}"]`);
    const card = stop?.querySelector(".clinic-banner");
    const finish = () => {
      if (done && state?.screen === "game") showSummary();
    };
    if (!stop || !card || motionMs(1) === 0) {
      flipHold = null;
      stop?.classList.add("is-visited");
      finish();
      return;
    }
    scrollToStop(id, "center");
    stop.classList.add("is-reveal");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        flipHold = null;
        stop.classList.add("is-visited");
        if (!done) return;
        const go = (event) => {
          if (event && event.propertyName !== "transform") return;
          card.removeEventListener("transitionend", go);
          finish();
        };
        card.addEventListener("transitionend", go);
        setTimeout(go, 900);
      });
    });
  }

  function showSummary() {
    setMenuChrome(false);
    const save = loadSave();
    summaryBest = state.score > (save.best || 0);
    save.best = Math.max(save.best || 0, state.score);
    save.name = state.name;
    save.game = null;
    writeSave(save);
    roadObserver?.disconnect();
    state.screen = "summary";
    document.getElementById("app").innerHTML = summaryHtml();
    renderPanels();
  }

  function lostPoints() {
    return state.log.reduce((sum, item) => sum + (item.maxPoints - item.points), 0);
  }

  function coaching() {
    const tips = [];
    if (state.log.some((item) => item.outcome === "dislike")) {
      tips.push("Перед презентацией смотрите, какой препарат врач не назначает.");
    }
    if (state.log.some((item) => item.outcome === "half")) {
      tips.push("Половина баллов — препарат не той специальности. Терапевт — Тералин, гинеколог — Феморин, невролог — Невролекс, хирург — Регенокс.");
    }
    if (state.visited.length < state.route.length && hasMove()) {
      tips.push("День закрыт раньше 17:00, на маршруте ещё оставались доступные врачи.");
    } else if (state.visited.length < state.route.length && state.minutesLeft > 0) {
      tips.push("Время ещё осталось, но его не хватило на дорогу до оставшихся врачей. Обратный путь до дальней поликлиники — два часа от дома.");
    } else if (state.visited.length < state.route.length) {
      tips.push("День закрылся по времени. Пять визитов по порядку занимают 4 часа 30 минут, прыжки назад съедают остаток.");
    }
    if (state.log.length && state.log.every((item) => item.outcome === "full")) {
      tips.push("Все визиты с полными баллами: препарат совпал со специальностью.");
    }
    return tips;
  }

  function summaryHtml() {
    const grade = G.grade(state.score);
    const missed = dayDoctors().filter((doctor) => !state.visited.includes(doctor.id));
    const tips = coaching();
    return `<section class="summary">
      <p class="eyebrow">${esc(state.name)}</p>
      <h1>${esc(grade.title)}</h1>
      <p class="grade">${esc(grade.text)}</p>
      ${summaryBest ? '<p class="record">Новый личный рекорд</p>' : ""}
      <div class="stats">
        <div class="stat"><b class="num">${esc(G.formatScore(state.score))}</b><span>баллы из ${esc(G.formatScore(G.totalPoints()))}</span></div>
        <div class="stat"><b class="num">${state.visited.length} / ${state.route.length}</b><span>визитов</span></div>
        <div class="stat"><b class="num">${esc(G.formatDuration(state.travelSpent))}</b><span>в пути</span></div>
        <div class="stat"><b class="num">${esc(G.formatDuration(state.visitSpent))}</b><span>на визитах</span></div>
        <div class="stat"><b class="num">${esc(G.formatDuration(state.minutesLeft))}</b><span>не использовано</span></div>
        <div class="stat"><b class="num">${esc(G.formatScore(lostPoints()))}</b><span>баллов потеряно на препарате</span></div>
      </div>
      ${tips.length ? `<ul class="tips">${tips.map((tip) => `<li>${esc(tip)}</li>`).join("")}</ul>` : ""}
      <p class="block-title">Журнал</p>
      <div class="log">${state.log.length ? state.log.map(logCard).join("") : "<p class=\"sub\">Визитов не было.</p>"}</div>
      ${missed.length ? `<p class="fine">Не посетили: ${missed.map((doctor) => esc(doctor.name)).join(", ")}.</p>` : ""}
      <button type="button" class="btn" data-action="new-day">Новый день</button>
    </section>`;
  }

  function logCard(entry) {
    const doctor = G.doctorById(entry.doctorId);
    const drug = G.drugById(entry.drugId);
    const spec = G.specialtyOf(doctor.specialty);
    return `<article>
      <b>${esc(doctor.name)}</b>
      <span>${esc(spec.label)} · ${esc(drug.name)} · дорога ${entry.travel} мин</span>
      <strong class="${entry.outcome} num">+${esc(G.formatScore(entry.points))}</strong>
    </article>`;
  }

  function renderPanels() {
    const right = document.getElementById("side-right");
    if (!right) return;
    if (state && (state.screen === "game" || state.screen === "summary") && state.log) {
      right.innerHTML = `<div class="panel-card">
        <p class="eyebrow">Журнал дня</p>
        <h2>${esc(G.formatScore(state.score))}</h2>
        <div class="side-log">${state.log.length ? state.log.map(logCard).join("") : "<p>Визиты появятся здесь.</p>"}</div>
      </div>`;
      return;
    }
    const save = loadSave();
    right.innerHTML = `<div class="panel-card">
      <p class="eyebrow">Как устроен день</p>
      <h2>Коротко</h2>
      <ol>
        <li>8 часов: с 09:00 до 17:00. Визит — 30 минут.</li>
          <li>Пять поликлиник. От дома 20, 40, 60, 90 и 120 минут — и 20, 40, 60, 80, 100 баллов.</li>
        <li>Своя специальность — 100% баллов, чужая — 50%, нелюбимый препарат — 0.</li>
      </ol>
      <p class="block-title">Портфель</p>
      ${portfolioHtml()}
      ${save.best ? `<p class="best-line">Рекорд: ${esc(G.formatScore(save.best))}</p>` : ""}
    </div>`;
  }

  function onClick(event) {
    const button = event.target.closest("[data-action]");
    if (!button || button.disabled) return;
    const action = button.dataset.action;
    if (action === "continue-game") continueGame();
    else if (action === "show-roster") showRoster();
    else if (action === "select-doctor") selectDoctor(button.dataset.id);
    else if (action === "cancel") closeSoft();
    else if (action === "depart") depart();
    else if (action === "pick-drug") pickDrug(button.dataset.drug);
    else if (action === "present") present();
    else if (action === "continue-day") continueDay();
    else if (action === "help") {
      if (state?.phase === "map") {
        state.phase = "help";
        renderOverlay();
      }
    } else if (action === "ask-finish") {
      if (state?.phase === "map") {
        state.phase = "finish";
        renderOverlay();
      }
    } else if (action === "finish-day") showSummary();
    else if (action === "new-day") showStart();
  }

  function onSubmit(event) {
    const form = event.target;
    if (form.id !== "start-form") return;
    event.preventDefault();
    const input = form.querySelector("input");
    const name = input.value.trim().slice(0, 24);
    const error = form.querySelector(".error");
    if (!name) {
      error.textContent = "Введите имя, чтобы начать день.";
      input.focus();
      return;
    }
    startGame(name);
  }

  document.getElementById("app").addEventListener("click", (event) => {
    if (event.target.id === "overlay") {
      closeSoft();
      return;
    }
    onClick(event);
  });
  document.getElementById("app").addEventListener("submit", onSubmit);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (document.querySelector(".roster")) showStart();
      else closeSoft();
    }
  });
  window.addEventListener("resize", () => {
    if (state?.screen !== "game" || driving) return;
    layoutRoad();
    placeToken(state.position);
    placeMap();
  });

  showStart();
})();
