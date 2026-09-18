const LEVELS = {
  1: {
    name: "Уровень I",
    maxPicks: 4,
    next: "1-1",
    field: "pharmacies",
    rules: {
      lead: "У вас есть 4 визита в аптеки.",
      steps: [
        "Над каждой аптекой указано количество денег, которое приносит этот визит.",
        "Соберите визитами максимальное количество денег.",
      ],
    },
  },
  "1-1": {
    name: "Уровень I-I",
    maxPicks: 3,
    field: "pharmacies",
    rules: {
      lead: "У вас есть 3 визита в аптеки.",
      steps: [
        "Над каждой аптекой указано количество денег, которое приносит этот визит.",
        "Соберите визитами максимальное количество денег.",
      ],
    },
  },
  2: {
    name: "Уровень II",
    maxPicks: 4,
    next: "2-1",
    field: "pharmacies",
    traps: true,
    rules: {
      lead: "У вас есть 4 визита в аптеки.",
      steps: [
        "Над каждой аптекой указано количество денег, которое приносит этот визит.",
        "Красный цвет шаров обозначает, что на сетевом складе нет товара.",
        "Соберите визитами максимальное количество денег.",
      ],
    },
  },
  "2-1": {
    name: "Уровень II-I",
    maxPicks: 3,
    field: "pharmacies",
    traps: true,
    rules: {
      lead: "У вас есть 3 визита в аптеки.",
      steps: [
        "Над каждой аптекой указано количество денег, которое приносит этот визит.",
        "Красный цвет шаров обозначает, что на сетевом складе нет товара.",
        "Соберите визитами максимальное количество денег.",
      ],
    },
  },
  3: {
    name: "Уровень III",
    maxPicks: 4,
    next: "3-1",
    field: "pharmacies",
    traps: "single2",
    rules: {
      lead: "У вас есть 4 визита в аптеки.",
      steps: [
        "Над каждой аптекой указано количество денег, которое приносит этот визит.",
        "Красный круг над аптекой обозначает, что данная аптека низкой лояльности.",
        "Соберите визитами максимальное количество денег.",
      ],
    },
  },
  "3-1": {
    name: "Уровень III-I",
    maxPicks: 3,
    field: "pharmacies",
    traps: "single2",
    rules: {
      lead: "У вас есть 3 визита в аптеки.",
      steps: [
        "Над каждой аптекой указано количество денег, которое приносит этот визит.",
        "Красный круг над аптекой обозначает, что данная аптека низкой лояльности.",
        "Соберите визитами максимальное количество денег.",
      ],
    },
  },
};

const ASSET_URLS = ["pharmacy.png", "polyclinic.png", "logo.png"];
const TG_BG = "#d7e4f2";

function preloadAssets(urls) {
  return Promise.all(
    urls.map(
      (url) =>
        new Promise((resolve) => {
          const img = new Image();
          img.decoding = "async";
          img.onload = () => resolve(url);
          img.onerror = () => resolve(url);
          img.src = url;
        })
    )
  );
}

preloadAssets(ASSET_URLS);

function getTelegramWebApp() {
  return window.Telegram?.WebApp || null;
}

function isTelegramWebApp() {
  const tg = getTelegramWebApp();
  if (!tg) return false;
  return Boolean(tg.initData) || Boolean(tg.initDataUnsafe?.user);
}

function syncTelegramViewport(tg) {
  const height = tg.viewportStableHeight || tg.viewportHeight || window.innerHeight;
  document.documentElement.style.setProperty("--tg-viewport-stable-height", `${height}px`);
}

function setupTelegramWebApp() {
  const tg = getTelegramWebApp();
  if (!tg || !isTelegramWebApp()) return null;

  document.documentElement.classList.add("is-telegram");
  document.body.classList.add("is-telegram");

  tg.ready();
  tg.expand();

  try {
    tg.setHeaderColor?.(TG_BG);
    tg.setBackgroundColor?.(TG_BG);
  } catch (_) {
    /* older clients */
  }

  if (typeof tg.disableVerticalSwipes === "function") {
    tg.disableVerticalSwipes();
  }

  syncTelegramViewport(tg);
  tg.onEvent?.("viewportChanged", () => syncTelegramViewport(tg));
  tg.onEvent?.("themeChanged", () => {
    try {
      tg.setHeaderColor?.(TG_BG);
      tg.setBackgroundColor?.(TG_BG);
    } catch (_) {
      /* ignore */
    }
  });

  return tg;
}

const telegramApp = setupTelegramWebApp();

function getTelegramUserName() {
  const user = telegramApp?.initDataUnsafe?.user;
  if (!user) return "";
  return [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
}

const screens = {
  welcome: document.getElementById("welcome"),
  dashboard: document.getElementById("dashboard"),
  levels: document.getElementById("levels"),
  briefing: document.getElementById("briefing"),
  play: document.getElementById("play"),
  results: document.getElementById("results"),
};

const form = document.getElementById("start-form");
const nameInput = document.getElementById("player-name");
const greeting = document.getElementById("greeting");
const backBtn = document.getElementById("back-btn");
const toLevelsBtn = document.getElementById("to-levels-btn");
const playLevelTitle = document.getElementById("play-level-title");
const playArena = document.getElementById("play-arena");
const playSky = document.getElementById("play-sky");
const playRoutes = document.getElementById("play-routes");
const playRunner = document.getElementById("play-runner");
const playPolyclinic = document.getElementById("play-polyclinic");
const playPointsValue = document.getElementById("play-points-value");
const playTimerValue = document.getElementById("play-timer-value");
const playTimerBox = document.querySelector(".play-timer");
const resultsLevel = document.getElementById("results-level");
const resultsScore = document.getElementById("results-score");
const resultsAgainBtn = document.getElementById("results-again-btn");
const resultsNextBtn = document.getElementById("results-next-btn");
const resultsLevelsBtn = document.getElementById("results-levels-btn");
const briefingLevel = document.getElementById("briefing-level");
const briefingText = document.getElementById("briefing-text");
const briefingStartBtn = document.getElementById("briefing-start-btn");
const briefingBackBtn = document.getElementById("briefing-back-btn");

const LEVEL_TIME = 15;
const SVG_NS = "http://www.w3.org/2000/svg";

let playerName = "";
let currentLevel = null;
let totalPoints = 0;
let timeLeft = LEVEL_TIME;
let timerId = null;
let roundActive = false;
let pickCount = 0;
let finishWhenRunnerIdle = false;
let resultsShown = false;

let runnerQueue = [];
let runnerBusy = false;
let runnerAnchor = null;
let runnerAnim = null;

function getMaxPicks() {
  return LEVELS[currentLevel]?.maxPicks ?? Number.POSITIVE_INFINITY;
}

function showScreen(name) {
  Object.entries(screens).forEach(([key, el]) => {
    const active = key === name;
    el.classList.toggle("is-active", active);
    el.hidden = !active;
  });
}

function stopTimer() {
  if (timerId !== null) {
    clearInterval(timerId);
    timerId = null;
  }
  roundActive = false;
}

function updateTimerView() {
  playTimerValue.textContent = String(timeLeft);
  playTimerBox.classList.toggle("is-urgent", timeLeft <= 5);
}

function lockRemainingPharmacies() {
  playSky.querySelectorAll(".play-pharmacy:not(.is-picked)").forEach((btn) => {
    btn.disabled = true;
    btn.classList.add("is-locked");
  });
}

function getTelegramUserId() {
  const id = Number(telegramApp?.initDataUnsafe?.user?.id);
  return Number.isFinite(id) && id > 0 ? id : null;
}

async function saveLevelScore({ level, points, name }) {
  const telegramId = getTelegramUserId();
  if (!telegramId) return;

  const apiUrl = window.PHARM_CONFIG?.scoreApiUrl || "/api/score";

  try {
    await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        telegramId,
        name: name || "",
        level: String(level),
        points: Number(points) || 0,
      }),
      keepalive: true,
    });
  } catch (error) {
    console.warn("[PharmConsilium] failed to save score", error);
  }
}

function finishRound() {
  if (resultsShown) return;
  resultsShown = true;
  finishWhenRunnerIdle = false;
  stopTimer();
  lockRemainingPharmacies();

  const meta = LEVELS[currentLevel];
  resultsLevel.textContent = meta ? meta.name : "";
  resultsScore.textContent = String(totalPoints);

  const nextKey = meta?.next;
  const nextMeta = nextKey != null ? LEVELS[nextKey] : null;
  const hasNext = Boolean(nextMeta);

  resultsNextBtn.hidden = !hasNext;
  resultsAgainBtn.hidden = hasNext;
  resultsLevelsBtn.hidden = false;

  if (hasNext) {
    resultsNextBtn.textContent = `Перейти к ${nextMeta.name}`;
  }

  void saveLevelScore({
    level: currentLevel,
    points: totalPoints,
    name: playerName,
  });

  showScreen("results");
}

function maybeFinishAfterPicks() {
  if (pickCount < getMaxPicks()) return;
  lockRemainingPharmacies();
  roundActive = false;
  if (timerId !== null) {
    clearInterval(timerId);
    timerId = null;
  }
  finishWhenRunnerIdle = true;
  if (!runnerBusy && runnerQueue.length === 0) {
    finishRound();
  }
}

function startTimer() {
  stopTimer();
  timeLeft = LEVEL_TIME;
  roundActive = true;
  resultsShown = false;
  finishWhenRunnerIdle = false;
  updateTimerView();

  timerId = setInterval(() => {
    timeLeft -= 1;
    updateTimerView();
    if (timeLeft <= 0) {
      finishRound();
    }
  }, 1000);
}

function formatName(raw) {
  return raw.trim().replace(/\s+/g, " ");
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function overlaps(a, b, hitW = 26, hitH = 30) {
  return Math.abs(a.left - b.left) < hitW && Math.abs(a.top - b.top) < hitH;
}

function shuffle(list) {
  const items = [...list];
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function buildCandidatePool() {
  const pool = [];

  // Irregular staggered lattice — many options, not a 3×2 grid
  for (let row = 0; row < 6; row += 1) {
    const cols = row % 2 === 0 ? 5 : 4;
    for (let col = 0; col < cols; col += 1) {
      const left =
        row % 2 === 0
          ? 10 + col * ((80) / (cols - 1))
          : 18 + col * ((64) / Math.max(cols - 1, 1));
      const top = 10 + row * 11;
      if (top > 68) continue;
      pool.push({
        left: left + rand(-4, 4),
        top: top + rand(-3, 3),
      });
    }
  }

  // Extra pure-random candidates
  for (let i = 0; i < 40; i += 1) {
    pool.push({
      left: rand(10, 90),
      top: rand(8, 66),
    });
  }

  return shuffle(pool);
}

function buildLevel1Positions() {
  const above = { left: 50, top: 86, isAbove: true };
  const others = [];

  const canPlace = (candidate, hitW, hitH) => {
    // Keep clear space directly above the bottom pharmacy
    if (Math.abs(candidate.left - above.left) < 14 && candidate.top > 64) {
      return false;
    }
    if (overlaps(candidate, above, hitW, hitH)) return false;
    return !others.some((pos) => overlaps(pos, candidate, hitW, hitH));
  };

  // Pass 1: normal spacing from a mixed random pool
  for (const slot of buildCandidatePool()) {
    if (others.length >= 6) break;
    const candidate = {
      left: Math.min(90, Math.max(10, slot.left)),
      top: Math.min(66, Math.max(8, slot.top)),
      isAbove: false,
    };
    if (canPlace(candidate, 26, 30)) others.push(candidate);
  }

  // Pass 2: looser spacing if still short
  if (others.length < 6) {
    for (const slot of buildCandidatePool()) {
      if (others.length >= 6) break;
      const candidate = {
        left: Math.min(90, Math.max(10, slot.left)),
        top: Math.min(66, Math.max(8, slot.top)),
        isAbove: false,
      };
      if (canPlace(candidate, 22, 26)) others.push(candidate);
    }
  }

  // Pass 3: spiral fill with looser hitbox
  let angle = Math.random() * Math.PI * 2;
  let guard = 0;
  while (others.length < 6 && guard < 120) {
    guard += 1;
    const radius = 16 + (guard % 5) * 8;
    const candidate = {
      left: Math.min(90, Math.max(10, 50 + Math.cos(angle) * radius)),
      top: Math.min(66, Math.max(8, 36 + Math.sin(angle) * (radius * 0.75))),
      isAbove: false,
    };
    angle += 1.7;
    if (canPlace(candidate, 18, 22)) others.push(candidate);
  }

  // Pass 4: emergency slots — still always reach 6
  if (others.length < 6) {
    const emergency = shuffle([
      { left: 14, top: 12 },
      { left: 50, top: 10 },
      { left: 86, top: 12 },
      { left: 20, top: 40 },
      { left: 80, top: 40 },
      { left: 36, top: 58 },
      { left: 64, top: 58 },
      { left: 12, top: 58 },
      { left: 88, top: 58 },
    ]);
    for (const slot of emergency) {
      if (others.length >= 6) break;
      const candidate = { ...slot, isAbove: false };
      if (canPlace(candidate, 16, 20)) others.push(candidate);
    }
  }

  while (others.length < 6) {
    others.push({
      left: 12 + others.length * 13,
      top: 14 + (others.length % 4) * 14,
      isAbove: false,
    });
  }

  return [above, ...others.slice(0, 6)];
}

function setPoints(value) {
  totalPoints = value;
  playPointsValue.textContent = String(totalPoints);
}

function resetRunner() {
  runnerQueue = [];
  runnerBusy = false;
  runnerAnchor = null;
  if (runnerAnim) {
    runnerAnim.cancel();
    runnerAnim = null;
  }
  playRoutes.replaceChildren();
  playRunner.hidden = true;
  playRunner.classList.remove("is-running", "is-flip");
}

function getRoutePoint(el, arenaRect) {
  const rect = el.getBoundingClientRect();
  const isClinic = el === playPolyclinic || el.classList.contains("play-polyclinic");
  return {
    x: rect.left + rect.width / 2 - arenaRect.left,
    y: isClinic
      ? rect.top + rect.height * 0.18 - arenaRect.top
      : rect.top + rect.height * 0.55 - arenaRect.top,
  };
}

function drawRouteLine(from, to) {
  const line = document.createElementNS(SVG_NS, "line");
  line.setAttribute("class", "play-route-line");
  line.setAttribute("x1", String(from.x));
  line.setAttribute("y1", String(from.y));
  line.setAttribute("x2", String(to.x));
  line.setAttribute("y2", String(to.y));
  playRoutes.append(line);
  return line;
}

function runToTarget(targetEl) {
  return new Promise((resolve) => {
    const arenaRect = playArena.getBoundingClientRect();
    playRoutes.setAttribute("viewBox", `0 0 ${arenaRect.width} ${arenaRect.height}`);

    const fromEl = runnerAnchor || playPolyclinic;
    const from = getRoutePoint(fromEl, arenaRect);
    const to = getRoutePoint(targetEl, arenaRect);
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    const duration = Math.min(1600, Math.max(650, distance * 3.2));

    drawRouteLine(from, to);

    playRunner.hidden = false;
    playRunner.classList.toggle("is-flip", to.x < from.x);
    playRunner.classList.add("is-running");
    playRunner.style.left = `${from.x}px`;
    playRunner.style.top = `${from.y}px`;

    if (runnerAnim) runnerAnim.cancel();
    runnerAnim = playRunner.animate(
      [
        { left: `${from.x}px`, top: `${from.y}px` },
        { left: `${to.x}px`, top: `${to.y}px` },
      ],
      {
        duration,
        easing: "ease-in-out",
        fill: "forwards",
      }
    );

    runnerAnim.onfinish = () => {
      playRunner.classList.remove("is-running");
      playRunner.style.left = `${to.x}px`;
      playRunner.style.top = `${to.y}px`;
      runnerAnchor = targetEl;
      runnerAnim = null;
      resolve();
    };
  });
}

async function pumpRunnerQueue() {
  if (runnerBusy) return;
  runnerBusy = true;
  while (runnerQueue.length) {
    const next = runnerQueue.shift();
    await runToTarget(next);
  }
  runnerBusy = false;
  if (finishWhenRunnerIdle) {
    finishRound();
  }
}

function enqueueRunner(targetEl) {
  runnerQueue.push(targetEl);
  pumpRunnerQueue();
}

function addPoints(amount) {
  if (!amount) return;
  setPoints(totalPoints + amount);
  playPointsValue.classList.remove("is-pop");
  void playPointsValue.offsetWidth;
  playPointsValue.classList.add("is-pop");
}

function createPharmacySpot({ left, top, isAbove, score, isTrap = false, trapStyle = "filled" }) {
  const spot = document.createElement("button");
  spot.type = "button";
  spot.className = "play-pharmacy" + (isAbove ? " is-above" : "");
  spot.style.left = `${left}%`;
  spot.style.top = `${top}%`;
  spot.dataset.score = String(score);
  if (isTrap) spot.dataset.trap = "true";
  spot.setAttribute(
    "aria-label",
    isTrap ? `Аптека-ловушка, на экране ${score}, даёт 0 очков` : `Аптека, ${score} очков`
  );
  if (isAbove) spot.dataset.abovePolyclinic = "true";

  const spin = document.createElement("span");
  spin.className = "play-pharmacy-spin";

  const bubble = document.createElement("span");
  bubble.className = "play-score";
  if (isTrap) {
    bubble.classList.add(trapStyle === "ring" ? "is-trap-ring" : "is-trap");
  }
  bubble.dataset.value = String(score);
  bubble.textContent = String(score);

  const img = document.createElement("img");
  img.className = "play-pharmacy-img";
  img.src = "pharmacy.png";
  img.alt = "";
  img.decoding = "async";
  img.loading = "eager";
  img.fetchPriority = "high";

  const label = document.createElement("span");
  label.className = "play-pharmacy-label";
  label.textContent = "Аптека";

  spin.append(bubble, img, label);
  spot.append(spin);

  spot.addEventListener("click", () => {
    if (!roundActive || spot.classList.contains("is-picked")) return;
    if (pickCount >= getMaxPicks()) return;

    spot.classList.add("is-picked");
    spot.disabled = true;
    bubble.textContent = "✓";
    bubble.setAttribute("aria-label", isTrap ? "Ловушка, 0 очков" : "Выбрано");
    pickCount += 1;
    addPoints(isTrap ? 0 : score);
    enqueueRunner(spot);
    maybeFinishAfterPicks();
  });

  return spot;
}

function markTrapScores(positions, mode) {
  if (mode === "single2") {
    const twos = positions.filter((pos) => pos.score === 2);
    if (twos.length) {
      const trap = shuffle(twos)[0];
      trap.isTrap = true;
      trap.trapStyle = "ring";
    }
    return;
  }

  // Level II style: one trap with 2 and one with 3
  const twos = positions.filter((pos) => pos.score === 2);
  const threes = positions.filter((pos) => pos.score === 3);
  if (twos.length) {
    const trap = shuffle(twos)[0];
    trap.isTrap = true;
    trap.trapStyle = "filled";
  }
  if (threes.length) {
    const trap = shuffle(threes)[0];
    trap.isTrap = true;
    trap.trapStyle = "filled";
  }
}

function buildPharmaciesField() {
  const positions = buildLevel1Positions();
  const meta = LEVELS[currentLevel] || {};

  // Top pharmacy (highest on screen) = 5, bottom above polyclinic = 1
  let topIndex = -1;
  for (let i = 0; i < positions.length; i += 1) {
    if (positions[i].isAbove) continue;
    if (topIndex < 0 || positions[i].top < positions[topIndex].top) {
      topIndex = i;
    }
  }

  const midScores = shuffle([2, 2, 2, 3, 4]);
  let midCursor = 0;

  positions.forEach((pos, index) => {
    pos.isTrap = false;
    if (pos.isAbove) {
      pos.score = 1;
    } else if (index === topIndex) {
      pos.score = 5;
    } else {
      pos.score = midScores[midCursor];
      midCursor += 1;
    }
  });

  if (meta.traps) {
    markTrapScores(positions, meta.traps);
  }

  playSky.replaceChildren(
    ...shuffle(positions).map((pos) => createPharmacySpot(pos))
  );
}

function buildPlaceholderField() {
  const note = document.createElement("p");
  note.className = "play-placeholder";
  note.textContent = "Этот уровень появится позже.";
  playSky.replaceChildren(note);
}

function escapeBriefingHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderBriefingRules(rules) {
  if (!rules) {
    return `<p class="briefing-lead">Внимательно выполните задание уровня, чтобы набрать максимальный результат.</p>`;
  }

  if (typeof rules === "string") {
    return `<p class="briefing-lead">${escapeBriefingHtml(rules)}</p>`;
  }

  const lead = rules.lead
    ? `<p class="briefing-lead">${escapeBriefingHtml(rules.lead)}</p>`
    : "";
  const steps = Array.isArray(rules.steps) && rules.steps.length
    ? `<ul class="briefing-steps">${rules.steps
        .map((step) => `<li>${escapeBriefingHtml(step)}</li>`)
        .join("")}</ul>`
    : "";

  return `${lead}${steps}`;
}

function openBriefing(level) {
  const meta = LEVELS[level];
  if (!meta) return;

  currentLevel = level;
  stopTimer();
  briefingLevel.textContent = meta.name;
  briefingText.innerHTML = renderBriefingRules(meta.rules);

  showScreen("briefing");
}

function beginLevel() {
  const meta = LEVELS[currentLevel];
  if (!meta) return;

  playLevelTitle.textContent = meta.name;
  setPoints(0);
  pickCount = 0;
  resetRunner();

  if (meta.field === "pharmacies") {
    buildPharmaciesField();
  } else {
    buildPlaceholderField();
  }

  showScreen("play");
  startTimer();
}

function startLevel(level) {
  openBriefing(level);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const value = formatName(nameInput.value);
  if (!value) {
    nameInput.focus();
    return;
  }

  const startBtn = document.getElementById("ignition-start");
  if (startBtn?.disabled) return;

  playerName = value;
  greeting.textContent = `Здравствуйте, ${playerName}`;
  sessionStorage.setItem("pharmconsilium-name", playerName);

  if (startBtn) {
    startBtn.disabled = true;
    startBtn.setAttribute("aria-busy", "true");
  }
  nameInput.disabled = true;

  try {
    if (typeof window.pharmIgnitionBurst === "function") {
      await window.pharmIgnitionBurst(600);
    } else {
      await new Promise((resolve) => window.setTimeout(resolve, 600));
    }
  } finally {
    if (startBtn) {
      startBtn.disabled = false;
      startBtn.removeAttribute("aria-busy");
    }
    nameInput.disabled = false;
  }

  showScreen("levels");
});

backBtn.addEventListener("click", () => {
  stopTimer();
  showScreen("welcome");
  nameInput.focus();
});

document.querySelectorAll(".level").forEach((button) => {
  button.addEventListener("click", () => {
    const level = button.dataset.level;
    const key = Number.isNaN(Number(level)) ? level : Number(level);
    if (!LEVELS[key]) return;
    startLevel(key);
  });
});

function goToLevels() {
  stopTimer();
  showScreen("levels");
}

toLevelsBtn.addEventListener("click", goToLevels);
resultsLevelsBtn.addEventListener("click", goToLevels);
resultsAgainBtn.addEventListener("click", () => {
  if (currentLevel != null) openBriefing(currentLevel);
});
resultsNextBtn.addEventListener("click", () => {
  const next = LEVELS[currentLevel]?.next;
  if (next && LEVELS[next]) openBriefing(next);
});
briefingStartBtn.addEventListener("click", beginLevel);
briefingBackBtn.addEventListener("click", goToLevels);

const saved = sessionStorage.getItem("pharmconsilium-name");
if (saved) {
  nameInput.value = saved;
} else {
  const tgName = getTelegramUserName();
  if (tgName) nameInput.value = tgName;
}

nameInput.addEventListener("change", () => {
  const value = formatName(nameInput.value);
  if (value) sessionStorage.setItem("pharmconsilium-name", value);
});

const welcomeLogoBtn = document.getElementById("welcome-logo-btn");
const welcomeLogoMark = document.getElementById("welcome-logo-mark");

function spinWelcomeLogo() {
  if (!welcomeLogoMark) return;
  welcomeLogoMark.classList.remove("is-spinning");
  void welcomeLogoMark.offsetWidth;
  welcomeLogoMark.classList.add("is-spinning");
}

welcomeLogoBtn?.addEventListener("click", () => {
  spinWelcomeLogo();
});

welcomeLogoMark?.addEventListener("animationend", (event) => {
  if (event.animationName !== "logoImpactSpin") return;
  if (!welcomeLogoMark.classList.contains("is-spinning")) return;
  welcomeLogoMark.classList.remove("is-spinning");
});

/* —— Dashboard (results by level) —— */
const DASH_LEVEL_LABELS = {
  1: "I",
  "1-1": "I-I",
  2: "II",
  "2-1": "II-I",
  3: "III",
  "3-1": "III-I",
};
const DASH_LEVEL_ORDER = ["1", "1-1", "2", "2-1", "3", "3-1"];

const welcomeResultsBtn = document.getElementById("welcome-results-btn");
const DASH_ADMIN_TELEGRAM_IDS = new Set([714228956, 6747512147]);

const dashboardBackBtn = document.getElementById("dashboard-back-btn");
const dashboardTabsEl = document.getElementById("dashboard-tabs");
const dashboardPanelEl = document.getElementById("dashboard-panel");
const dashboardMetaEl = document.getElementById("dashboard-meta");
const dashboardRefreshBtn = document.getElementById("dashboard-refresh-btn");
const dashboardClearBtn = document.getElementById("dashboard-clear-btn");
const clearStatsAlert = document.getElementById("clear-stats-alert");
const clearStatsConfirmBtn = document.getElementById("clear-stats-confirm-btn");
const clearStatsCancelBtn = document.getElementById("clear-stats-cancel-btn");

let dashActiveLevel = "1";
let dashStatsCache = null;

function dashLevelLabel(level) {
  return DASH_LEVEL_LABELS[String(level)] || String(level);
}

function dashLevelTitle(level) {
  return `Уровень ${dashLevelLabel(level)}`;
}

function dashFormatDate(value) {
  if (!value) return "—";
  const normalized = String(value).includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function dashEscapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function dashMedalClass(index) {
  if (index === 0) return "is-gold";
  if (index === 1) return "is-silver";
  if (index === 2) return "is-bronze";
  return "";
}

async function fetchDashboardStats() {
  const apiUrl = window.PHARM_CONFIG?.statsApiUrl || "/api/stats";
  const response = await fetch(apiUrl, { method: "GET" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Ошибка ${response.status}`);
  }
  return data;
}

function renderDashboardTabs(byLevel) {
  const levels = DASH_LEVEL_ORDER.filter((level) => (byLevel[level] || []).length > 0);
  const extra = Object.keys(byLevel).filter((level) => !DASH_LEVEL_ORDER.includes(level));
  const all = [...levels, ...extra.sort()];

  if (!all.length) {
    dashboardTabsEl.innerHTML = "";
    dashActiveLevel = "";
    return;
  }

  if (!all.includes(dashActiveLevel)) dashActiveLevel = all[0];

  dashboardTabsEl.innerHTML = all
    .map((level) => {
      const count = (byLevel[level] || []).length;
      const selected = level === dashActiveLevel ? "is-active" : "";
      return `<button class="dashboard-tab ${selected}" type="button" data-level="${level}" role="tab" aria-selected="${level === dashActiveLevel}">
        <span class="dashboard-tab-label">${dashEscapeHtml(dashLevelLabel(level))}</span>
        <span class="dashboard-tab-count">${count}</span>
      </button>`;
    })
    .join("");
}

function renderDashboardPanel(byLevel) {
  if (!dashActiveLevel) {
    dashboardPanelEl.innerHTML = `<div class="dashboard-empty">
      <p class="dashboard-empty-title">Пока пусто</p>
      <p class="dashboard-empty-text">Результаты появятся после прохождения уровней в Telegram.</p>
    </div>`;
    return;
  }

  const rows = byLevel[dashActiveLevel] || [];
  if (!rows.length) {
    dashboardPanelEl.innerHTML = `<div class="dashboard-empty">
      <p class="dashboard-empty-title">Нет результатов</p>
      <p class="dashboard-empty-text">Для ${dashEscapeHtml(dashLevelTitle(dashActiveLevel))} ещё нет записей.</p>
    </div>`;
    return;
  }

  dashboardPanelEl.innerHTML = `
    <div class="dashboard-level-head">
      <p class="dashboard-level-kicker">Рейтинг</p>
      <h2 class="dashboard-level-title">${dashEscapeHtml(dashLevelTitle(dashActiveLevel))}</h2>
    </div>
    <ul class="dashboard-list" role="list">
      ${rows
        .map(
          (row, index) => `
        <li class="dashboard-row ${dashMedalClass(index)}">
          <span class="dashboard-rank" aria-hidden="true">${index + 1}</span>
          <div class="dashboard-row-main">
            <p class="dashboard-name">${dashEscapeHtml(row.player_name || "Игрок")}</p>
            <p class="dashboard-date">${dashEscapeHtml(dashFormatDate(row.played_at))}</p>
          </div>
          <div class="dashboard-score-block">
            <span class="dashboard-score">${dashEscapeHtml(row.points)}</span>
            <span class="dashboard-score-unit">очков</span>
          </div>
        </li>`
        )
        .join("")}
    </ul>
  `;
}

function renderDashboardStats(data) {
  dashStatsCache = data;
  const byLevel = data.byLevel || {};
  const total = (data.rows || []).length;
  dashboardMetaEl.textContent = total ? `${total} записей` : "Записей пока нет";
  renderDashboardTabs(byLevel);
  renderDashboardPanel(byLevel);
}

async function loadDashboard() {
  dashboardMetaEl.textContent = "Загрузка…";
  dashboardRefreshBtn.classList.add("is-spinning");
  dashboardPanelEl.innerHTML = `<div class="dashboard-empty">
    <p class="dashboard-empty-title">Загрузка…</p>
    <p class="dashboard-empty-text">Собираем результаты игроков</p>
  </div>`;

  try {
    const data = await fetchDashboardStats();
    renderDashboardStats(data);
  } catch (error) {
    dashboardMetaEl.textContent = "Ошибка загрузки";
    dashboardPanelEl.innerHTML = `<div class="dashboard-empty">
      <p class="dashboard-empty-title">Не удалось загрузить</p>
      <p class="dashboard-empty-text">${dashEscapeHtml(error.message || "Попробуйте обновить")}</p>
    </div>`;
  } finally {
    dashboardRefreshBtn.classList.remove("is-spinning");
  }
}

function canClearDashboardStats() {
  const telegramId = getTelegramUserId();
  return telegramId != null && DASH_ADMIN_TELEGRAM_IDS.has(telegramId);
}

function syncDashboardAdminControls() {
  dashboardClearBtn.hidden = !canClearDashboardStats();
  if (dashboardClearBtn.hidden) closeClearStatsAlert();
}

function openDashboard() {
  document.body.classList.add("welcome-settled");
  syncDashboardAdminControls();
  showScreen("dashboard");
  void loadDashboard();
}

welcomeResultsBtn.addEventListener("click", () => {
  openDashboard();
});

dashboardBackBtn.addEventListener("click", () => {
  showScreen("welcome");
  nameInput.focus();
});

dashboardTabsEl.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-level]");
  if (!btn || !dashStatsCache) return;
  dashActiveLevel = btn.dataset.level;
  renderDashboardTabs(dashStatsCache.byLevel || {});
  renderDashboardPanel(dashStatsCache.byLevel || {});
});

dashboardRefreshBtn.addEventListener("click", () => {
  void loadDashboard();
});

function openClearStatsAlert() {
  clearStatsAlert.hidden = false;
  clearStatsConfirmBtn.focus();
}

function closeClearStatsAlert() {
  clearStatsAlert.hidden = true;
}

async function clearAllStats() {
  if (!canClearDashboardStats()) {
    dashboardMetaEl.textContent = "Недостаточно прав";
    closeClearStatsAlert();
    return;
  }

  const apiUrl = window.PHARM_CONFIG?.clearStatsApiUrl || "/api/clear-stats";
  clearStatsConfirmBtn.disabled = true;
  clearStatsConfirmBtn.textContent = "Удаление…";

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telegramId: getTelegramUserId() }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `Ошибка ${response.status}`);
    }
    closeClearStatsAlert();
    await loadDashboard();
  } catch (error) {
    dashboardMetaEl.textContent = error.message || "Не удалось очистить";
  } finally {
    clearStatsConfirmBtn.disabled = false;
    clearStatsConfirmBtn.textContent = "Подтвердить";
  }
}

dashboardClearBtn.addEventListener("click", () => {
  if (!canClearDashboardStats()) return;
  openClearStatsAlert();
});

clearStatsCancelBtn.addEventListener("click", () => {
  closeClearStatsAlert();
});

clearStatsConfirmBtn.addEventListener("click", () => {
  void clearAllStats();
});

clearStatsAlert.addEventListener("click", (event) => {
  if (event.target === clearStatsAlert) closeClearStatsAlert();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !clearStatsAlert.hidden) {
    closeClearStatsAlert();
  }
});

if (location.hash === "#dashboard") {
  openDashboard();
  history.replaceState(null, "", location.pathname + location.search);
}

window.setTimeout(() => {
  document.body.classList.add("welcome-settled");
}, 4500);
