(function () {
  const G = window.MPGame;
  const KEY = "mp-visit-day-v7";
  const PREV_KEYS = ["mp-visit-day-v6", "mp-visit-day-v5", "mp-visit-day-v4", "mp-visit-day-v3", "mp-visit-day-v2"];

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
  let contactReplyTimer = 0;
  let interestRevealTimer = 0;
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
    const wheel = (cx) => `<g class="car-wheel">
        <circle cx="${cx}" cy="31.6" r="5.8" fill="#1e2430"/>
        <circle cx="${cx}" cy="31.6" r="2.7" fill="#f7f4ee"/>
        <circle cx="${cx}" cy="31.6" r="1" fill="#1e2430"/>
      </g>`;
    return `<svg class="car" viewBox="0 0 96 42" aria-hidden="true">
      <g class="car-spring">
        <path d="M29.5 27.2c1.6 1.5 3.2 1.5 4.8 0s3.2-1.5 4.8 0" fill="none" stroke="#5c6573" stroke-width="1.15" stroke-linecap="round"/>
      </g>
      <g class="car-spring">
        <path d="M67.5 27.2c1.6 1.5 3.2 1.5 4.8 0s3.2-1.5 4.8 0" fill="none" stroke="#5c6573" stroke-width="1.15" stroke-linecap="round"/>
      </g>
      <g class="car-suspension">
        <g class="car-engine">
          <path d="M14 28.6V23.2c0-2.2 1.8-3.8 4.2-3.8h12.2L38.6 11c1.2-1.5 3-2.4 4.9-2.4H62c2.4 0 4.2 1 5.4 3.2L74 19.4h8.2c4.2 0 7 2 7 4.6v4.2c0 1.6-1.3 2.6-3.2 2.6H17.2c-1.9 0-3.2-1-3.2-2.2z" fill="#e23d2f"/>
          <path d="M18 27.8h62c3.2 0 6 .4 8 1.2v1.4c-2.2 1-6.4 1.6-10 1.6H26c-4 0-8-.5-10-1.4v-1.6c1.6-.8 5-1.2 8-1.2z" fill="#c43228"/>
          <path d="M44 10.4h16" stroke="#ffb4aa" stroke-width="1.4" stroke-linecap="round"/>
          <path d="M42.5 13.2h16.5L66.5 19H49z" fill="#e8f6fc" stroke="#c5dbe8" stroke-width="0.7" stroke-linejoin="round"/>
          <path d="M57.2 13.4v5.4" stroke="#d4e6f0" stroke-width="0.8"/>
          <path d="M52 19.4v8" stroke="#c43228" stroke-width="0.7"/>
          <rect x="15.2" y="21.4" width="2.6" height="3.2" rx="0.7" fill="#ffd0c8"/>
          <rect x="84.6" y="21.2" width="4.2" height="2.8" rx="0.9" fill="#fff6dc"/>
        </g>
      </g>
      ${wheel(34)}
      ${wheel(72)}
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
    const anchors = [];
    const routeIds = [];
    for (let i = 0; i < game.route.length; i += 1) {
      const group = game.route[i];
      if (!Array.isArray(group) || group.length !== G.DOCTORS_PER_CLINIC) return false;
      if (new Set(group).size !== G.DOCTORS_PER_CLINIC) return false;
      if (!group.every((id) => Number.isInteger(id) && G.doctorById(id))) return false;
      anchors.push(group[0]);
      routeIds.push(...group);
    }
    if (new Set(routeIds).size !== G.ROAD_STOPS * G.DOCTORS_PER_CLINIC) return false;
    if (game.position !== 0 && !anchors.includes(game.position)) return false;
    if (!Number.isFinite(game.minutesLeft) || game.minutesLeft < 0 || game.minutesLeft > G.DAY_MINUTES) return false;
    if (!Array.isArray(game.visited) || !Array.isArray(game.log)) return false;
    if (!game.visited.every((id) => routeIds.includes(id))) return false;
    return true;
  }

  function persist() {
    const save = loadSave();
    if (state?.name) save.name = state.name;
    if (state?.screen === "game") save.game = state;
    writeSave(save);
  }

  function freshState(name) {
    const route = G.pickRoute();
    return {
      screen: "game",
      name,
      position: 0,
      route,
      clinicNames: G.pickClinicNames(),
      interests: G.pickDoctorInterests(route.flat()),
      knownInterests: [],
      rapport: null,
      interestSpent: 0,
      minutesLeft: G.DAY_MINUTES,
      score: 0,
      visited: [],
      log: [],
      phase: "map",
      selectedDoctor: null,
      selectedClinic: null,
      focusDoctor: null,
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
    return clinicByAnchor(position) ? "поликлиника" : "маршрут";
  }

  function ensureClinicNames() {
    const renamedFrom = "Женская консультация «Вам на сколько?»";
    const renamedTo = "Женская консультация «У вас на сколько?»";
    let renamed = false;
    if (Array.isArray(state?.clinicNames)) {
      state.clinicNames = state.clinicNames.map((name) => {
        if (name !== renamedFrom) return name;
        renamed = true;
        return renamedTo;
      });
    }
    const names = state?.clinicNames;
    const ok = Array.isArray(names)
      && names.length === G.ROAD_STOPS
      && new Set(names).size === G.ROAD_STOPS
      && names.every((name) => G.CLINIC_NAMES.includes(name));
    if (ok) return renamed;
    state.clinicNames = G.pickClinicNames();
    return true;
  }

  function interestsOf(doctorId) {
    const list = state.interests && state.interests[doctorId];
    return Array.isArray(list) ? list : [];
  }

  function interestsKnown(doctorId) {
    return Array.isArray(state.knownInterests) && state.knownInterests.includes(doctorId);
  }

  function ensureInterests() {
    const ids = state.route.flat();
    const bag = state.interests;
    let changed = false;
    if (bag && typeof bag === "object") {
      ids.forEach((id) => {
        const list = bag[id];
        if (!Array.isArray(list) || !list.includes("crossword")) return;
        bag[id] = list.map((hobbyId) => (hobbyId === "crossword" ? "skate" : hobbyId));
        changed = true;
      });
    }
    if (state.rapport) {
      if (Array.isArray(state.rapport.options) && state.rapport.options.includes("crossword")) {
        state.rapport.options = state.rapport.options.map((hobbyId) => (hobbyId === "crossword" ? "skate" : hobbyId));
        changed = true;
      }
      if (state.rapport.pick === "crossword") {
        state.rapport.pick = "skate";
        changed = true;
      }
    }
    const ok = bag && typeof bag === "object" && ids.every((id) => {
      const list = bag[id];
      return Array.isArray(list)
        && list.length === 3
        && new Set(list).size === 3
        && list.every((hobbyId) => G.hobbyById(hobbyId));
    });
    if (!ok) {
      state.interests = G.pickDoctorInterests(ids);
      state.knownInterests = [];
      changed = true;
    }
    if (!Array.isArray(state.knownInterests)) {
      state.knownInterests = [];
      changed = true;
    }
    if (!Number.isFinite(state.interestSpent)) {
      state.interestSpent = 0;
      changed = true;
    }
    return changed;
  }

  function dayClinics() {
    return state.route.map((ids, index) => ({
      slot: index + 1,
      anchor: ids[0],
      title: (state.clinicNames && state.clinicNames[index]) || "Поликлиника",
      points: G.pointsForSlot(index + 1),
      doctors: ids.map((id) => ({
        ...G.doctorById(id),
        slot: index + 1,
        points: G.pointsForSlot(index + 1),
      })),
    }));
  }

  function clinicByAnchor(anchor) {
    return dayClinics().find((clinic) => clinic.anchor === anchor) || null;
  }

  function doctorSeen(id) {
    return state.visited.includes(id);
  }

  function doctorsLeft(clinic) {
    return clinic.doctors.filter((doctor) => !doctorSeen(doctor.id));
  }

  function clinicDone(clinic) {
    return doctorsLeft(clinic).length === 0;
  }

  function clinicEarned(clinic) {
    return state.log
      .filter((item) => clinic.doctors.some((doctor) => doctor.id === item.doctorId))
      .reduce((sum, item) => sum + item.points, 0);
  }

  function totalDoctorSlots() {
    return state.route.length * G.DOCTORS_PER_CLINIC;
  }

  function canStayHere() {
    const clinic = clinicByAnchor(state.position);
    return Boolean(clinic && doctorsLeft(clinic).length && state.minutesLeft >= G.VISIT_MINUTES);
  }

  function dayDoctor(id) {
    for (const clinic of dayClinics()) {
      const found = clinic.doctors.find((doctor) => doctor.id === id);
      if (found) return found;
    }
    return null;
  }

  function hasMove() {
    return dayClinics().some(
      (clinic) => doctorsLeft(clinic).length > 0 && G.visitCost(state.route, state.position, clinic.anchor) <= state.minutesLeft
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
      <li><b>1</b><p>День с 09:00 до 17:00. Время уходит на дорогу и на визит.<span>До поездки видны только время пути и баллы. Врача выбираете по приезде. После визита можно зайти к другому врачу здесь или уехать дальше.</span></p></li>
      <li><b>2</b><p>Пять поликлиник стоят вдоль дороги. В каждой — три врача.<span>От дома: 20 минут и 20 баллов, 40 минут и 40, час и 60, полтора часа и 80, два часа и 100. Каждый визит приносит баллы этой поликлиники. Повторный заход без дороги — ещё 30 минут.</span></p></li>
      <li><b>3</b><p>Препарат по специальности — все баллы уровня.<span>Другая специальность — половина. Нелюбимый препарат — ноль.</span></p></li>
      <li><b>4</b><p>У каждого врача три интереса, заранее их не видно.<span>«Узнать интересы» стоит 15 минут, после этого они на карточке. Перед препаратом можно «Наладить контакт»: верная реплика удваивает баллы визита, неверная срезает их ещё наполовину.</span></p></li>
    </ol>`;
  }

  function setMenuChrome(on) {
    document.querySelector(".shell")?.classList.toggle("is-menu", on);
  }

  function menuSceneHtml() {
    return `<svg class="menu-scene" viewBox="0 0 1200 680" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <radialGradient id="menuSun" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#fff6dc"/>
          <stop offset="42%" stop-color="#ffdc7a"/>
          <stop offset="100%" stop-color="#ffdc7a" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="menuSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#a9ccec"/>
          <stop offset="46%" stop-color="#cfe4f2"/>
          <stop offset="78%" stop-color="#e2eedd"/>
          <stop offset="100%" stop-color="#e9f2df"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="1200" height="680" fill="url(#menuSky)"/>
      <circle cx="1030" cy="118" r="96" fill="url(#menuSun)"/>
      <circle cx="1030" cy="118" r="30" fill="#ffdc7a"/>
      <g fill="#ffffff" opacity="0.92">
        <ellipse cx="250" cy="120" rx="52" ry="20"/>
        <ellipse cx="212" cy="129" rx="29" ry="18"/>
        <ellipse cx="288" cy="129" rx="33" ry="20"/>
        <ellipse cx="640" cy="86" rx="40" ry="16"/>
        <ellipse cx="614" cy="93" rx="23" ry="15"/>
        <ellipse cx="905" cy="156" rx="32" ry="13"/>
      </g>
      <path d="M0 496 C180 466 320 518 520 490 C720 462 900 516 1200 480 V680 H0 Z" fill="#8fb0a2"/>
      <path d="M0 548 C220 520 400 564 600 540 C800 516 980 560 1200 534 V680 H0 Z" fill="#7fb356"/>
      <path d="M0 584 C240 568 440 598 660 580 C880 562 1040 592 1200 578 V680 H0 Z" fill="#9dcc72"/>
      <path d="M-20 574 C240 556 440 592 660 572 C880 552 1040 586 1220 568" fill="none" stroke="#243042" stroke-width="26" stroke-linecap="round"/>
      <path d="M-20 574 C240 556 440 592 660 572 C880 552 1040 586 1220 568" fill="none" stroke="#f3ecdf" stroke-width="2.6" stroke-dasharray="6 18" stroke-linecap="round"/>
      <g transform="translate(150 526)">
        <path d="M0 26 L34 0 L68 26 Z" fill="#e14b3c"/>
        <rect x="10" y="26" width="48" height="30" fill="#f4efe4"/>
        <rect x="26" y="40" width="16" height="16" rx="1" fill="#6b4a34"/>
      </g>
      ${clinicSvg(0, "#0f766e").replace("<svg ", '<svg x="946" y="420" width="116" height="158" ')}
    </svg>`;
  }

  function openRulesModal() {
    if (document.getElementById("rules-modal")) return;
    const el = document.createElement("div");
    el.className = "menu-modal";
    el.id = "rules-modal";
    el.innerHTML = `<div class="menu-modal-card" role="dialog" aria-modal="true" aria-label="Правила">
      <div class="menu-modal-head">
        <h2>Правила</h2>
        <button type="button" class="menu-modal-close" data-action="close-rules" aria-label="Закрыть">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </div>
      ${rulesListHtml()}
    </div>`;
    document.getElementById("app").appendChild(el);
    requestAnimationFrame(() => el.classList.add("is-open"));
  }

  function closeRulesModal() {
    const el = document.getElementById("rules-modal");
    if (!el) return;
    el.classList.remove("is-open");
    setTimeout(() => el.remove(), 220);
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
      ${menuSceneHtml()}
      <button type="button" class="menu-roster-btn" data-action="show-roster" aria-label="Справочник" title="Справочник">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19"/>
          <circle cx="10" cy="8" r="3.2"/>
          <path d="M20 19v-1.5a3.5 3.5 0 0 0-2.6-3.4"/>
          <path d="M15.4 5.2a3.2 3.2 0 0 1 0 5.6"/>
        </svg>
      </button>
      <div class="menu-shell">
        <header class="menu-title">
          <p class="eyebrow">Тренажёр медпредставителя</p>
          <h1>Визитный день</h1>
        </header>
        <div class="menu-card">
          <form id="start-form">
            <label class="field">Как к вам обращаться
              <input id="player-name" name="player" maxlength="24" autocomplete="nickname" placeholder="Имя" value="${esc(save.name)}" />
            </label>
            <p class="error" role="alert"></p>
            <button class="btn" type="submit">Начать день</button>
          </form>
          ${continueBtn}
          <button class="btn secondary" type="button" data-action="menu-rules">Правила</button>
          ${save.best ? `<div class="menu-record"><span class="menu-record-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M17 5h3v2a3 3 0 0 1-3 3"/><path d="M7 5H4v2a3 3 0 0 0 3 3"/></svg></span><span class="menu-record-label">Рекорд</span><strong class="menu-record-value num">${esc(G.formatScore(save.best))}</strong></div>` : ""}
        </div>
      </div>
    </section>`;
    renderPanels();
  }

  function showRoster() {
    stopSkyLoop();
    roadObserver?.disconnect();
    state = null;
    const places = G.CLINIC_NAMES.map((name) => `<p class="roster-place">${esc(name)}</p>`).join("");
    const cards = G.DOCTORS.map((doctor) => {
      const spec = G.specialtyOf(doctor.specialty);
      const { first, last } = nameParts(doctor.name);
      return `<article class="roster-card">
        ${window.MPPortrait(doctor.id)}
        <p class="who"><span class="first">${esc(first)}</span><span class="last">${esc(last)}</span></p>
        <p class="spec" style="color:${spec.color}">${esc(spec.label)}</p>
      </article>`;
    }).join("");
    const lines = G.HOBBIES.map((hobby) => `<article class="roster-line"><b>${esc(hobby.label)}</b><span>${esc(hobby.line)}</span></article>`).join("");
    setMenuChrome(false);
    document.getElementById("app").innerHTML = `<section class="start roster">
      <p class="eyebrow">Справочник</p>
      <h1>Врачи и поликлиники</h1>
      <p class="lead">${G.CLINIC_NAMES.length} лечебных учреждений и ${G.HOBBIES.length} интересов. Каждый день на дорогу попадают пять учреждений, в каждом три врача и три случайных интереса.</p>
      <p class="block-title">Поликлиники</p>
      <div class="roster-places">${places}</div>
      <p class="block-title">Интересы и реплики</p>
      <div class="roster-lines">${lines}</div>
      <p class="block-title">Врачи</p>
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
    if (ensureClinicNames() || ensureInterests()) persist();
    if (state.phase === "travel") {
      state.phase = "confirm";
      state.selectedClinic = state.position;
      state.selectedDoctor = null;
      state.focusDoctor = null;
    }
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
    const doctors = dayClinics().slice().reverse().map(stopHtml).join("");
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

  function stopHtml(clinic) {
    const names = clinic.doctors.map((doctor) => doctor.name).join(", ");
    const accent = G.specialtyOf(clinic.doctors[0].specialty).color;
    return `<article class="stop at-clinic" data-stop="${clinic.anchor}">
      <button type="button" class="clinic-hit" style="--spec:${accent}" data-action="select-clinic" data-id="${clinic.anchor}" aria-label="${esc(clinic.title)}. Врачи: ${esc(names)}">
        <span class="clinic-banner">
          <span class="banner-time" data-meta="travel" hidden>
            <svg class="banner-time-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12.5" r="7.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 8.2v4.8l2.8 1.7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span class="banner-time-val"></span>
          </span>
          <span class="banner-split" aria-hidden="true"></span>
          <span class="banner-pts banner-pts-open">
            <strong class="num" data-meta="pts">${clinic.points}</strong>
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
        <span class="clinic" aria-hidden="true">${clinicSvg(clinic.slot, accent)}</span>
      </button>
      <span class="pin" data-pin="${clinic.anchor}"></span>
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
    dayClinics().forEach((clinic) => {
      const stop = document.querySelector(`[data-stop="${clinic.anchor}"]`);
      if (!stop) return;
      const here = mapPosition();
      const done = clinicDone(clinic);
      const left = doctorsLeft(clinic);
      const earned = Math.round(clinicEarned(clinic));
      const travel = G.travelMinutes(state.route, here, clinic.anchor);
      const affordable = left.length > 0 && travel + G.VISIT_MINUTES <= state.minutesLeft;
      const showingResult = state.phase === "result" && clinic.doctors.some((doctor) => doctor.id === state.lastResult?.doctorId);
      const holdFace = showingResult || flipHold === clinic.anchor;
      stop.classList.toggle("is-current", here === clinic.anchor);
      stop.classList.toggle("is-visited", done && !holdFace);
      stop.classList.toggle("is-locked", !done && !affordable);
      stop.classList.toggle("is-selected", state.phase === "confirm" && state.selectedClinic === clinic.anchor);
      const lastEntry = [...state.log].reverse().find((item) => clinic.doctors.some((doctor) => doctor.id === item.doctorId));
      stop.dataset.outcome = done && lastEntry ? lastEntry.outcome : "";
      const button = stop.querySelector("button");
      if (button) button.disabled = done || !affordable;
      const sealEl = stop.querySelector("[data-meta='seal']");
      const unitEl = stop.querySelector("[data-meta='seal-unit']");
      if (sealEl && done) {
        sealEl.textContent = G.formatScore(earned);
        if (unitEl) unitEl.textContent = G.plural(earned, "балл", "балла", "баллов");
      }
      const travelEl = stop.querySelector("[data-meta='travel']");
      const ptsEl = stop.querySelector("[data-meta='pts']");
      const unitOpen = stop.querySelector("[data-meta='unit']");
      if (unitOpen) unitOpen.textContent = G.plural(clinic.points, "балл", "балла", "баллов");
      if (done) {
        travelEl.hidden = true;
      } else if (here === clinic.anchor || travel === 0) {
        travelEl.hidden = true;
        ptsEl.textContent = G.formatScore(clinic.points);
      } else {
        travelEl.hidden = false;
        const travelText = travelEl.querySelector(".banner-time-val");
        if (travelText) travelText.textContent = formatTravel(travel);
        ptsEl.textContent = G.formatScore(clinic.points);
      }
      const names = left.map((doctor) => doctor.name).join(", ");
      const timeBit = travelEl.hidden ? "" : `, дорога ${formatTravel(travel)}`;
      if (button) {
        if (done) {
          button.setAttribute("aria-label", `${clinic.title}. Закрыта, ${G.formatScore(earned)} баллов.`);
        } else {
          const seenBit = earned ? `, уже ${G.formatScore(earned)}` : "";
          button.setAttribute("aria-label", `${clinic.title}. Можно зайти: ${names}${timeBit}, до ${G.formatScore(clinic.points)} баллов${seenBit}.`);
        }
      }
    });
    document.querySelector('[data-stop="0"]')?.classList.toggle("is-current", mapPosition() === 0);
    syncDayEnd();
  }

  function syncDayEnd() {
    const card = document.getElementById("day-end");
    const game = document.querySelector(".game");
    if (!card || !game || !state) return;
    const show = state.screen === "game" && state.phase === "map" && state.visited.length < totalDoctorSlots() && !hasMove();
    card.hidden = !show;
    game.classList.toggle("has-day-end", show);
    const note = document.getElementById("day-end-note");
    if (!show || !note) return;
    note.textContent = state.minutesLeft <= 0
      ? "Рабочий день закончился."
      : `Осталось ${G.formatDuration(state.minutesLeft)}. На следующую поездку и визит уже не хватает.`;
  }

  function placeIdForSlot(slot) {
    if (!slot) return 0;
    const group = state.route[slot - 1];
    return group ? group[0] : 0;
  }

  function parentPlace(placeId) {
    const slot = G.slotOf(state.route, placeId);
    if (slot <= 0) return null;
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
    const bySlot = new Map(dayClinics().map((clinic) => [clinic.slot, clinic]));
    for (let slot = 1; slot <= G.ROAD_STOPS; slot += 1) {
      const clinic = bySlot.get(slot);
      const el = route.querySelector(`[data-stop="${clinic.anchor}"]`);
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
      const building = el.querySelector(".clinic");
      if (building) building.style.clipPath = clinicClipPath(pinX, roadY, routeW, routeH);
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
    return [0, ...state.route.map((group) => group[0])].map((id) => {
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
    const stamp = `${scroller.clientWidth}x${h}:${state.route.flat().join(",")}`;
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
      let deg = Math.atan2(aim.y, aim.x) * (180 / Math.PI);
      if (aim.x < 0) {
        deg += 180;
        if (deg > 180) deg -= 360;
        token.style.transform = `rotate(${deg}deg) scaleX(-1)`;
      } else {
        token.style.transform = `rotate(${deg}deg)`;
      }
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
    const skyMins = travelMins;
    const travelProgress = (usedBeforeDepart + skyMins) / G.DAY_MINUTES;
    if (!hops.length || motionMs(1) === 0) {
      driving = false;
      document.getElementById("token")?.classList.remove("is-driving");
      applySkyProgress(travelProgress);
      skyMinutesOverride = usedBeforeDepart + skyMins;
      placeToken(toId);
      scrollToStop(toId, "center");
      done();
      return;
    }
    const id = ++driveToken;
    driving = true;
    document.getElementById("token")?.classList.add("is-driving");
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
      document.getElementById("token")?.classList.remove("is-driving");
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
    const contact = contactOpen();
    overlay.classList.toggle("has-contact", contact);
    const visitSheet = `<div class="sheet${contact ? " is-behind" : ""}" role="dialog"${contact ? "" : ' aria-modal="true"'}>${sheetHtml()}</div>`;
    const contactSheet = contact
      ? `<div class="sheet contact-sheet" role="dialog" aria-modal="true">${contactDialogHtml()}</div>`
      : "";
    overlay.innerHTML = visitSheet + contactSheet;
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
    const clinic = clinicByAnchor(state.selectedClinic);
    if (state.position !== clinic.anchor) return tripHtml(clinic);
    return arriveHtml(clinic);
  }

  function tripHtml(clinic) {
    const travel = G.travelMinutes(state.route, state.position, clinic.anchor);
    return `<p class="eyebrow">${esc(clinic.title)}</p>
      <h2>В путь</h2>
      <ul class="outcomes trip-facts">
        <li><span>В пути</span><b class="num">${esc(G.formatDuration(travel))}</b></li>
        <li><span>Баллы за визит</span><b class="num">до ${esc(G.formatScore(clinic.points))}</b></li>
      </ul>
      <div class="stack">
        <button type="button" class="btn" data-action="depart">Поехать · ${esc(G.formatDuration(travel))}</button>
        <button type="button" class="btn secondary" data-action="cancel">Остаться</button>
      </div>`;
  }

  function arriveHtml(clinic) {
    if (state.selectedDoctor) return doctorCardHtml(clinic, dayDoctor(state.selectedDoctor));
    const cards = clinic.doctors.map((person) => {
      const spec = G.specialtyOf(person.specialty);
      const seen = doctorSeen(person.id);
      return `<button type="button" class="doctor-choice${seen ? " is-seen" : ""}" style="--spec:${spec.color}" data-action="choose-doctor" data-id="${person.id}" aria-label="${esc(person.name)}, ${esc(spec.label)}"${seen ? " disabled" : ""}>
        ${window.MPPortrait(person.id)}
        <span class="spec">${seen ? "Уже были" : esc(spec.label)}</span>
      </button>`;
    }).join("");
    return `<p class="eyebrow">${esc(clinic.title)}</p>
      <h2>Кого посетить</h2>
      <p class="clock-note">На визит — 30 минут.</p>
      <ul class="outcomes">
        <li><span>Препарат по специальности</span><b>${esc(G.formatScore(clinic.points))}</b></li>
        <li><span>Другая специальность</span><b>${esc(G.formatScore(clinic.points / 2))}</b></li>
        <li><span>Нелюбимый препарат</span><b>0</b></li>
      </ul>
      <p class="sub">Занимательная беседа по интересам удваивает баллы, если врачу не интересно — лишь половина баллов.</p>
      <div class="doctor-pick">${cards}</div>
      <button type="button" class="btn secondary" data-action="cancel">Уехать дальше</button>`;
  }

  function interestChips(doctorId) {
    if (!interestsKnown(doctorId)) return "";
    const items = interestsOf(doctorId).map((id) => `<li>${esc(G.hobbyById(id).label)}</li>`).join("");
    return `<ul class="interests-row">${items}</ul>`;
  }

  function doctorCardHtml(clinic, doctor) {
    const spec = G.specialtyOf(doctor.specialty);
    const dislike = doctor.dislike ? G.drugById(doctor.dislike) : null;
    const { first, last } = nameParts(doctor.name);
    const total = G.VISIT_MINUTES;
    const canEnter = state.minutesLeft >= total;
    const left = Math.max(0, state.minutesLeft - total);
    const known = interestsKnown(doctor.id);
    const canScout = state.minutesLeft >= G.INTEREST_MINUTES;
    const scout = known ? interestChips(doctor.id) : "";
    const timeNote = canEnter
      ? `На визит — 30 минут. Останется ${G.formatDuration(left)}.`
      : `На визит — 30 минут. Сейчас осталось ${G.formatDuration(state.minutesLeft)}.`;
    const scoutTime = esc(G.formatDuration(G.INTEREST_MINUTES));
    const visitTime = esc(G.formatDuration(total));
    const learn = known
      ? ""
      : `<button type="button" class="btn scout btn-split" data-action="learn-interests"${canScout ? "" : " disabled"}><span class="btn-title">Узнать интересы</span><span class="btn-time">${scoutTime}</span></button>`;
    const enter = `<button type="button" class="btn btn-split" data-action="depart"${canEnter ? "" : " disabled"}><span class="btn-title">Зайти</span><span class="btn-time">${visitTime}</span></button>`;
    return `<p class="eyebrow">${esc(clinic.title)}</p>
      <p class="clock-note">${esc(timeNote)}</p>
      <div class="doctor-card">
        ${window.MPPortrait(doctor.id)}
        <div>
          <h2><span class="first">${esc(first)}</span><span class="last">${esc(last)}</span></h2>
          <p class="spec" style="--spec:${spec.color}">${esc(spec.label)}</p>
        </div>
      </div>
      ${dislike ? `<p class="gold-banner">Не назначает <b>${esc(dislike.name)}</b>.</p>` : `<p class="gold-chip">Назначает любой препарат из портфеля.</p>`}
      ${scout}
      <div class="stack">
        ${learn ? `<div class="action-row">${learn}${enter}</div>` : enter}
        <button type="button" class="btn secondary" data-action="back-doctors">К выбору врача</button>
      </div>`;
  }

  function contactOpen() {
    const rapport = state?.rapport;
    return Boolean(
      state?.phase === "visit"
      && rapport
      && rapport.doctorId === state.focusDoctor
      && !rapport.closed
    );
  }

  function visitContactHtml(doctor) {
    const rapport = state.rapport && state.rapport.doctorId === doctor.id ? state.rapport : null;
    if (rapport && rapport.pick && rapport.closed) {
      const reaction = voicedReaction(doctor, rapport);
      const outcome = rapport.hit ? "Баллы удваиваются." : "Только половина баллов.";
      return `<p class="comic-note${rapport.hit ? " is-hit" : " is-miss"}"><span class="comic-line">${esc(reaction)}</span><b class="comic-result">${outcome}</b></p>`;
    }
    return `<button type="button" class="btn interest" data-action="open-rapport">Наладить контакт</button>`;
  }

  function voicedReaction(doctor, rapport) {
    const female = Boolean(doctor && doctor.female);
    if (G.reactionAgrees(rapport.reaction, female)) return rapport.reaction;
    rapport.reaction = G.doctorReaction(Boolean(rapport.hit), female);
    persist();
    return rapport.reaction;
  }

  function contactDialogHtml() {
    const doctor = dayDoctor(state.focusDoctor);
    const rapport = state.rapport;
    if (rapport.pick && !G.reactionAgrees(rapport.reaction, Boolean(doctor.female))) {
      rapport.hit = interestsOf(rapport.doctorId).includes(rapport.pick);
      rapport.reaction = G.doctorReaction(rapport.hit, Boolean(doctor.female));
      persist();
    }
    const { first, last } = nameParts(doctor.name);
    if (rapport.pick) {
      const hobby = G.hobbyById(rapport.pick);
      return `<div class="contact-face">${window.MPPortrait(doctor.id)}
          <div class="comic-bubble${rapport.hit ? " is-hit" : " is-miss"}" role="status">${esc(rapport.reaction)}</div>
        </div>
        <p class="contact-name"><span>${esc(first)}</span> <span>${esc(last)}</span></p>
        <p class="player-line">${esc(hobby.line)}</p>
        <button type="button" class="btn" data-action="close-contact">К препарату</button>`;
    }
    const buttons = rapport.options.map((id) => {
      const hobby = G.hobbyById(id);
      return `<button type="button" class="reply" data-action="pick-reply" data-hobby="${hobby.id}">${esc(hobby.line)}</button>`;
    }).join("");
    return `<div class="contact-face">${window.MPPortrait(doctor.id)}</div>
      <p class="contact-name"><span>${esc(first)}</span> <span>${esc(last)}</span></p>
      <div class="replies">${buttons}</div>`;
  }

  function visitHtml() {
    const doctor = dayDoctor(state.focusDoctor);
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
          <p class="sub">Визит занял 30 минут, осталось ${esc(G.formatDuration(state.minutesLeft))}.</p>
        </div>
      </div>
      ${visitContactHtml(doctor)}
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
    let detail = texts[entry.outcome];
    if (entry.rapport === "hit" && entry.drugPoints > 0) detail += " Реплика попала в интересы, баллы удвоены.";
    else if (entry.rapport === "miss" && entry.drugPoints > 0) detail += " Реплика мимо интересов, баллы срезаны ещё наполовину.";
    else if (entry.rapport === "hit") detail += " Реплика попала в интересы.";
    else if (entry.rapport === "miss") detail += " Реплика мимо интересов.";
    const cap = entry.rapport ? "" : `из ${G.formatScore(entry.maxPoints)} · `;
    const allDone = state.visited.length >= totalDoctorSlots();
    const nextLabel = allDone ? "К итогам дня" : "Дальше по маршруту";
    const actions = !allDone && canStayHere()
      ? `<div class="stack">
          <button type="button" class="btn" data-action="stay-clinic">Ещё врач здесь</button>
          <button type="button" class="btn secondary" data-action="continue-day">Уехать дальше</button>
        </div>`
      : `<button type="button" class="btn" data-action="continue-day">${nextLabel}</button>`;
    return `<div class="result-head">
        <div>
          <p class="eyebrow">${esc(drug.name)}</p>
          <h2>${titles[entry.outcome]}</h2>
        </div>
        <div class="stamp ${entry.outcome}">${stamps[entry.outcome]}</div>
      </div>
      <p class="result-points ${entry.outcome} num">+${esc(G.formatScore(entry.points))}</p>
      <p class="sub">${esc(cap + detail)}</p>
      <p class="clock-note">Счёт ${esc(G.formatScore(state.score))}. На часах ${G.formatClock(minutesUsed())}, ещё ${esc(G.formatDuration(state.minutesLeft))}.</p>
      ${actions}`;
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
      <p class="clock-note">Сейчас ${esc(G.formatScore(state.score))} баллов, визитов ${state.visited.length} из ${totalDoctorSlots()}. Осталось ${esc(G.formatDuration(state.minutesLeft))}.</p>
      <div class="stack">
        <button type="button" class="btn" data-action="finish-day">К итогам</button>
        <button type="button" class="btn secondary" data-action="cancel">Ещё визиты</button>
      </div>`;
  }

  function selectClinic(id) {
    if (!state || (state.phase !== "map" && state.phase !== "confirm")) return;
    const clinic = clinicByAnchor(Number(id));
    if (!clinic || clinicDone(clinic)) return;
    if (G.visitCost(state.route, state.position, clinic.anchor) > state.minutesLeft) return;
    state.selectedClinic = clinic.anchor;
    state.selectedDoctor = null;
    state.phase = "confirm";
    updateStops();
    renderOverlay();
  }

  function chooseDoctor(id) {
    if (!state || state.phase !== "confirm" || state.position !== state.selectedClinic) return;
    const clinic = clinicByAnchor(state.selectedClinic);
    const doctorId = Number(id);
    if (!clinic || doctorSeen(doctorId) || !clinic.doctors.some((doctor) => doctor.id === doctorId)) return;
    state.selectedDoctor = doctorId;
    renderOverlay();
    updateStops();
  }

  function backToDoctors() {
    if (!state || state.phase !== "confirm" || !state.selectedDoctor) return;
    state.selectedDoctor = null;
    renderOverlay();
    updateStops();
  }

  function closeSoft() {
    if (!state || !["confirm", "help", "finish"].includes(state.phase)) return;
    state.phase = "map";
    state.selectedDoctor = null;
    state.selectedClinic = null;
    updateStops();
    renderOverlay();
  }

  function depart() {
    if (state.phase !== "confirm") return;
    const clinic = clinicByAnchor(state.selectedClinic);
    if (!clinic || clinicDone(clinic)) return;
    if (state.position === clinic.anchor) {
      enterVisit();
      return;
    }
    const travel = G.travelMinutes(state.route, state.position, clinic.anchor);
    if (travel + G.VISIT_MINUTES > state.minutesLeft) return;
    const from = state.position;
    const usedBefore = minutesUsed();
    state.minutesLeft -= travel;
    state.travelSpent += travel;
    state.pending = { travel };
    state.focusDoctor = null;
    state.selectedDoctor = null;
    state.travelFrom = from;
    state.position = clinic.anchor;
    state.selectedClinic = clinic.anchor;
    state.phase = "travel";
    skyMinutesOverride = usedBefore;
    persist();
    updateHud();
    updateStops();
    renderOverlay();
    layoutRoad();
    driveCar(from, clinic.anchor, travel, usedBefore, () => {
      if (!state || state.phase !== "travel") return;
      state.travelFrom = null;
      state.phase = "confirm";
      state.selectedClinic = clinic.anchor;
      state.selectedDoctor = null;
      skyMinutesOverride = null;
      persist();
      updateHud();
      updateStops();
      renderOverlay();
    });
  }

  function enterVisit() {
    const clinic = clinicByAnchor(state.selectedClinic);
    const doctor = dayDoctor(state.selectedDoctor);
    if (!clinic || state.position !== clinic.anchor || !doctor || doctorSeen(doctor.id)) return;
    if (state.minutesLeft < G.VISIT_MINUTES) return;
    const travel = state.pending && state.pending.doctorId == null ? state.pending.travel || 0 : 0;
    state.minutesLeft -= G.VISIT_MINUTES;
    state.visitSpent += G.VISIT_MINUTES;
    state.pending = { doctorId: doctor.id, travel };
    state.focusDoctor = doctor.id;
    state.selectedDrug = null;
    state.rapport = null;
    state.selectedDoctor = null;
    state.selectedClinic = null;
    state.phase = "visit";
    skyMinutesOverride = null;
    persist();
    updateHud();
    updateStops();
    renderOverlay();
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

  function learnInterests() {
    if (!state || state.phase !== "confirm" || state.position !== state.selectedClinic) return;
    const doctorId = state.selectedDoctor;
    if (!doctorId || interestsKnown(doctorId) || doctorSeen(doctorId)) return;
    if (state.minutesLeft < G.INTEREST_MINUTES) return;
    state.minutesLeft -= G.INTEREST_MINUTES;
    state.interestSpent += G.INTEREST_MINUTES;
    state.knownInterests.push(doctorId);
    persist();
    updateHud();
    updateStops();
    const sheet = document.querySelector(".overlay > .sheet");
    if (!sheet || motionMs(1) === 0) {
      renderOverlay();
      return;
    }
    revealInterests(sheet, doctorId);
  }

  function revealInterests(sheet, doctorId) {
    const row = sheet.querySelector(".action-row");
    const scout = row && row.querySelector(".btn.scout");
    const enter = row && row.querySelector("[data-action='depart']");
    const stack = sheet.querySelector(".stack");
    if (!row || !scout || !enter || !stack) {
      renderOverlay();
      return;
    }
    const note = sheet.querySelector(".clock-note");
    if (note) {
      const total = G.VISIT_MINUTES;
      const left = Math.max(0, state.minutesLeft - total);
      note.textContent = state.minutesLeft >= total
        ? `На визит — 30 минут. Останется ${G.formatDuration(left)}.`
        : `На визит — 30 минут. Сейчас осталось ${G.formatDuration(state.minutesLeft)}.`;
    }
    if (state.minutesLeft < G.VISIT_MINUTES) enter.disabled = true;

    const list = document.createElement("ul");
    list.className = "interests-row is-pop";
    list.innerHTML = interestsOf(doctorId).map((id) => `<li>${esc(G.hobbyById(id).label)}</li>`).join("");
    list.style.overflow = "hidden";
    list.style.maxHeight = "0px";
    list.style.marginTop = "0px";
    list.style.marginBottom = "0px";
    stack.before(list);
    const fullHeight = list.scrollHeight;

    const scoutWidth = scout.getBoundingClientRect().width;
    const clip = document.createElement("div");
    clip.className = "scout-clip";
    row.insertBefore(clip, scout);
    clip.appendChild(scout);
    scout.disabled = true;
    scout.style.flex = "0 0 auto";
    scout.style.width = `${scoutWidth}px`;

    sheet.getBoundingClientRect();
    requestAnimationFrame(() => {
      list.style.transition = "max-height .4s cubic-bezier(.16, 1, .3, 1), margin-top .4s ease, margin-bottom .4s ease";
      list.style.maxHeight = `${fullHeight}px`;
      list.style.marginTop = "-4px";
      list.style.marginBottom = "10px";
      row.classList.add("is-push");
    });
    window.clearTimeout(interestRevealTimer);
    window.setTimeout(() => {
      if (list.isConnected) list.style.overflow = "visible";
    }, 420);
    interestRevealTimer = window.setTimeout(() => {
      interestRevealTimer = 0;
      if (!state || state.phase !== "confirm" || state.selectedDoctor !== doctorId || !interestsKnown(doctorId)) return;
      renderOverlay();
    }, 1200);
  }

  function openRapport() {
    if (state.phase !== "visit" || !state.focusDoctor) return;
    if (state.rapport && state.rapport.doctorId === state.focusDoctor) {
      if (state.rapport.closed && state.rapport.pick) return;
      if (!state.rapport.closed) return;
    }
    const hobbies = interestsOf(state.focusDoctor);
    if (hobbies.length !== 3) return;
    state.rapport = {
      doctorId: state.focusDoctor,
      options: G.rapportOptions(hobbies),
      pick: null,
      hit: null,
      reaction: null,
      closed: false,
    };
    persist();
    renderOverlay();
  }

  function pickReply(id) {
    const rapport = state.rapport;
    if (!contactOpen() || rapport.pick) return;
    if (!rapport.options.includes(id) || !G.hobbyById(id)) return;
    const hit = interestsOf(rapport.doctorId).includes(id);
    state.rapport = {
      ...rapport,
      pick: id,
      hit,
      reaction: G.doctorReaction(hit, Boolean(dayDoctor(rapport.doctorId).female)),
    };
    persist();
    const sheet = document.querySelector(".contact-sheet");
    if (!sheet || motionMs(1) === 0) {
      renderOverlay();
      return;
    }
    revealContactReply(sheet);
  }

  function revealContactReply(sheet) {
    const rapport = state.rapport;
    const hobby = G.hobbyById(rapport.pick);
    const replies = sheet.querySelector(".replies");
    const face = sheet.querySelector(".contact-face");
    if (!replies || !face || !hobby) {
      renderOverlay();
      return;
    }
    replies.querySelectorAll(".reply").forEach((button) => {
      button.disabled = true;
      button.classList.add("is-out");
    });
    const bubble = document.createElement("div");
    bubble.className = `comic-bubble${rapport.hit ? " is-hit" : " is-miss"} is-pop`;
    bubble.setAttribute("role", "status");
    bubble.textContent = rapport.reaction;
    face.appendChild(bubble);
    const after = document.createElement("div");
    after.className = "contact-after";
    after.innerHTML = `<p class="player-line">${esc(hobby.line)}</p><button type="button" class="btn" data-action="close-contact">К препарату</button>`;
    after.style.overflow = "hidden";
    after.style.maxHeight = "0px";
    after.style.opacity = "0";
    replies.after(after);
    const afterHeight = after.scrollHeight;
    replies.style.overflow = "hidden";
    replies.style.maxHeight = `${replies.offsetHeight}px`;
    sheet.getBoundingClientRect();
    requestAnimationFrame(() => {
      replies.style.transition = "max-height .42s ease, opacity .26s ease, margin .42s ease";
      replies.style.maxHeight = "0px";
      replies.style.opacity = "0";
      replies.style.margin = "0";
      after.style.transition = "max-height .42s ease, opacity .34s ease .06s";
      after.style.maxHeight = `${afterHeight}px`;
      after.style.opacity = "1";
      bubble.classList.add("is-in");
    });
    window.clearTimeout(contactReplyTimer);
    contactReplyTimer = window.setTimeout(() => {
      contactReplyTimer = 0;
      if (!contactOpen() || !state.rapport?.pick) return;
      const current = document.querySelector(".contact-sheet");
      const height = current ? current.offsetHeight : 0;
      renderOverlay();
      const next = document.querySelector(".contact-sheet");
      if (!next || !height) return;
      const target = next.offsetHeight;
      if (Math.abs(target - height) < 3) return;
      next.style.height = `${height}px`;
      next.style.transition = "height .22s ease";
      requestAnimationFrame(() => {
        next.style.height = `${target}px`;
      });
      window.setTimeout(() => {
        if (!next.isConnected) return;
        next.style.height = "";
        next.style.transition = "";
      }, 260);
    }, 480);
  }

  function closeContact() {
    if (!contactOpen()) return;
    if (!state.rapport.pick) state.rapport = null;
    else state.rapport = { ...state.rapport, closed: true };
    persist();
    renderOverlay();
  }

  function present() {
    if (state.phase !== "visit" || !state.selectedDrug) return;
    skyMinutesOverride = null;
    const doctor = dayDoctor(state.focusDoctor);
    const drug = G.drugById(state.selectedDrug);
    const result = G.scoreVisit(doctor, drug.id);
    const rapport = state.rapport && state.rapport.doctorId === doctor.id && state.rapport.pick
      ? (interestsOf(doctor.id).includes(state.rapport.pick) ? "hit" : "miss")
      : null;
    const points = G.applyRapport(result.points, rapport);
    state.score += points;
    if (!state.visited.includes(doctor.id)) state.visited.push(doctor.id);
    const entry = {
      doctorId: doctor.id,
      drugId: drug.id,
      points,
      drugPoints: result.points,
      maxPoints: doctor.points,
      outcome: result.outcome,
      rapport,
      travel: state.pending?.travel ?? G.travelMinutes(state.route, 0, clinicByAnchor(state.position)?.anchor ?? 0),
    };
    state.log.push(entry);
    state.lastResult = entry;
    state.pending = null;
    state.selectedDrug = null;
    state.rapport = null;
    state.phase = "result";
    persist();
    updateHud();
    updateStops();
    renderOverlay();
    renderPanels();
    const live = document.getElementById("live");
    if (live) live.textContent = `${doctor.name}: ${points} баллов. Счёт ${state.score}.`;
  }

  function stayClinic() {
    if (state.phase !== "result" || !canStayHere()) return;
    state.phase = "confirm";
    state.selectedClinic = state.position;
    state.selectedDoctor = null;
    state.lastResult = null;
    state.focusDoctor = null;
    persist();
    renderOverlay();
    updateHud();
    updateStops();
    renderPanels();
  }

  function continueDay() {
    if (state.phase !== "result") return;
    const clinic = clinicByAnchor(state.position);
    const finishedClinic = clinic && clinicDone(clinic) ? clinic.anchor : null;
    const allDone = state.visited.length >= totalDoctorSlots();
    flipHold = finishedClinic;
    state.phase = "map";
    state.lastResult = null;
    state.focusDoctor = null;
    persist();
    renderOverlay();
    updateHud();
    updateStops();
    if (finishedClinic != null) flipFinishedCard(finishedClinic, allDone);
    else if (allDone && state.screen === "game") showSummary();
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
    stopSkyLoop();
    setMenuChrome(true);
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
    return state.log.reduce((sum, item) => {
      const drugPoints = Number.isFinite(item.drugPoints) ? item.drugPoints : item.points;
      return sum + Math.max(0, item.maxPoints - drugPoints);
    }, 0);
  }

  function coaching() {
    const tips = [];
    if (state.log.some((item) => item.outcome === "dislike")) {
      tips.push("Перед презентацией смотрите, какой препарат врач не назначает.");
    }
    if (state.log.some((item) => item.rapport === "miss")) {
      tips.push("Реплика мимо интересов срезает баллы ещё наполовину. Интересы можно узнать за 15 минут до визита.");
    }
    if (state.log.some((item) => item.outcome === "half")) {
      tips.push("Половина баллов — препарат не той специальности. Терапевт — Тералин, гинеколог — Феморин, невролог — Невролекс, хирург — Регенокс.");
    }
    if (state.visited.length < totalDoctorSlots() && hasMove()) {
      tips.push("День закрыт раньше 17:00, в поликлиниках ещё оставались врачи.");
    } else if (state.visited.length < totalDoctorSlots() && state.minutesLeft > 0) {
      tips.push("Время ещё осталось, но его не хватило на следующий визит. Повторный заход в той же поликлинике — 30 минут и без дороги.");
    } else if (state.visited.length < totalDoctorSlots()) {
      tips.push("День закрылся по времени. В одной поликлинике можно обойти нескольких врачей подряд: каждый следующий визит — 30 минут.");
    }
    if (state.log.length && state.log.every((item) => item.outcome === "full")) {
      tips.push("Все визиты с полными баллами: препарат совпал со специальностью.");
    }
    return tips;
  }

  function summaryHtml() {
    const grade = G.grade(state.score);
    const save = loadSave();
    const missed = dayClinics()
      .map((clinic) => ({ ...clinic, left: doctorsLeft(clinic) }))
      .filter((clinic) => clinic.left.length);
    const tips = coaching();
    const rows = [
      ["Визиты", `${state.visited.length} / ${totalDoctorSlots()}`],
      ["В пути", G.formatDuration(state.travelSpent)],
      ["На визитах", G.formatDuration(state.visitSpent)],
    ];
    if (state.interestSpent) rows.push(["На интересы", G.formatDuration(state.interestSpent)]);
    rows.push(
      ["Не использовано", G.formatDuration(state.minutesLeft)],
      ["Потеряно на препарате", G.formatScore(lostPoints())],
    );
    const stats = rows.map(([label, value]) => `<li><span>${esc(label)}</span><b class="num">${esc(value)}</b></li>`).join("");
    const record = save.best
      ? `<div class="menu-record"><span class="menu-record-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M17 5h3v2a3 3 0 0 1-3 3"/><path d="M7 5H4v2a3 3 0 0 0 3 3"/></svg></span><span class="menu-record-label">${summaryBest ? "Новый рекорд" : "Рекорд"}</span><strong class="menu-record-value num">${esc(G.formatScore(save.best))}</strong></div>`
      : "";
    const tipBlock = tips.length
      ? `<p class="summary-kicker">На следующий день</p><ul class="summary-tips">${tips.map((tip) => `<li>${esc(tip)}</li>`).join("")}</ul>`
      : "";
    const journal = state.log.length
      ? `<div class="log summary-log">${state.log.map(logCard).join("")}</div>`
      : `<p class="summary-empty">Визитов не было.</p>`;
    const missedLine = missed.length
      ? `<p class="summary-miss"><b>Не посетили.</b> ${missed.map((clinic) => clinic.left.map((doctor) => esc(doctor.name)).join(", ")).join("; ")}.</p>`
      : "";
    return `<section class="start menu summary-menu">
      ${menuSceneHtml()}
      <button type="button" class="menu-roster-btn" data-action="show-roster" aria-label="Справочник" title="Справочник">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19"/>
          <circle cx="10" cy="8" r="3.2"/>
          <path d="M20 19v-1.5a3.5 3.5 0 0 0-2.6-3.4"/>
          <path d="M15.4 5.2a3.2 3.2 0 0 1 0 5.6"/>
        </svg>
      </button>
      <div class="menu-shell">
        <header class="menu-title">
          <p class="eyebrow">${esc(state.name)}</p>
          <h1>${esc(grade.title)}</h1>
          <p class="lead">${esc(grade.text)}</p>
        </header>
        <div class="menu-card">
          <div class="summary-body">
            <p class="summary-score"><b class="num">${esc(G.formatScore(state.score))}</b><span>баллы из ${esc(G.formatScore(G.totalPoints()))}</span></p>
            ${record}
            <ul class="summary-stats">${stats}</ul>
            ${tipBlock}
            <p class="summary-kicker">Журнал</p>
            ${journal}
            ${missedLine}
          </div>
          <button type="button" class="btn" data-action="new-day">Новый день</button>
        </div>
      </div>
    </section>`;
  }

  function logCard(entry) {
    const doctor = G.doctorById(entry.doctorId);
    const drug = G.drugById(entry.drugId);
    const spec = G.specialtyOf(doctor.specialty);
    const rapportBit = entry.rapport === "hit" ? " · контакт ×2" : entry.rapport === "miss" ? " · контакт мимо" : "";
    return `<article>
      <b>${esc(doctor.name)}</b>
      <span>${esc(spec.label)} · ${esc(drug.name)} · дорога ${entry.travel} мин${esc(rapportBit)}</span>
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
          <li>Пять поликлиник, в каждой три врача. До поездки видны время пути и баллы, врача выбираете по приезде. От дома 20, 40, 60, 90 и 120 минут — и 20, 40, 60, 80, 100 баллов за визит.</li>
        <li>Своя специальность — 100% баллов, чужая — 50%, нелюбимый препарат — 0.</li>
        <li>Интересы врача скрыты. Узнать их — 15 минут. Верная реплика удваивает баллы, неверная срезает ещё наполовину.</li>
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
    else if (action === "select-clinic") selectClinic(button.dataset.id);
    else if (action === "choose-doctor") chooseDoctor(button.dataset.id);
    else if (action === "back-doctors") backToDoctors();
    else if (action === "cancel") closeSoft();
    else if (action === "depart") depart();
    else if (action === "learn-interests") learnInterests();
    else if (action === "open-rapport") openRapport();
    else if (action === "pick-reply") pickReply(button.dataset.hobby);
    else if (action === "close-contact") closeContact();
    else if (action === "pick-drug") pickDrug(button.dataset.drug);
    else if (action === "present") present();
    else if (action === "stay-clinic") stayClinic();
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
    }     else if (action === "finish-day") showSummary();
    else if (action === "new-day") showStart();
    else if (action === "menu-rules") openRulesModal();
    else if (action === "close-rules") closeRulesModal();
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
    if (event.target.id === "rules-modal") {
      closeRulesModal();
      return;
    }
    if (event.target.id === "overlay") {
      if (contactOpen()) closeContact();
      else if (state?.phase === "confirm" && state.selectedDoctor) backToDoctors();
      else closeSoft();
      return;
    }
    onClick(event);
  });
  document.getElementById("app").addEventListener("submit", onSubmit);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (document.getElementById("rules-modal")) closeRulesModal();
      else if (document.querySelector(".roster")) showStart();
      else if (contactOpen()) closeContact();
      else if (state?.phase === "confirm" && state.selectedDoctor) backToDoctors();
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
