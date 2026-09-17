const LEVEL_LABELS = {
  1: "I",
  "1-1": "I-I",
  2: "II",
  "2-1": "II-I",
  3: "III",
  "3-1": "III-I",
};

const LEVEL_ORDER = ["1", "1-1", "2", "2-1", "3", "3-1"];

const tabsEl = document.getElementById("dashboard-tabs");
const panelEl = document.getElementById("dashboard-panel");
const metaEl = document.getElementById("dashboard-meta");
const refreshBtn = document.getElementById("dashboard-refresh-btn");

let activeLevel = "1";
let statsCache = null;

function setupTelegramWebApp() {
  const tg = window.Telegram?.WebApp;
  if (!tg) return null;
  try {
    tg.ready();
    tg.expand();
    if (typeof tg.setHeaderColor === "function") tg.setHeaderColor("#dce6f0");
    if (typeof tg.setBackgroundColor === "function") tg.setBackgroundColor("#dce6f0");
    document.documentElement.classList.add("is-telegram");
    document.body.classList.add("is-telegram");
  } catch {
    /* ignore */
  }
  return tg;
}

function formatDate(value) {
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

function levelLabel(level) {
  return LEVEL_LABELS[String(level)] || String(level);
}

function levelTitle(level) {
  return `Уровень ${levelLabel(level)}`;
}

async function fetchStats() {
  const apiUrl = window.PHARM_CONFIG?.statsApiUrl || "/api/stats";
  const response = await fetch(apiUrl, { method: "GET" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Ошибка ${response.status}`);
  }
  return data;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderTabs(byLevel) {
  const levels = LEVEL_ORDER.filter((level) => (byLevel[level] || []).length > 0);
  const extra = Object.keys(byLevel).filter((level) => !LEVEL_ORDER.includes(level));
  const all = [...levels, ...extra.sort()];

  if (!all.length) {
    tabsEl.innerHTML = "";
    activeLevel = "";
    return;
  }

  if (!all.includes(activeLevel)) activeLevel = all[0];

  tabsEl.innerHTML = all
    .map((level) => {
      const count = (byLevel[level] || []).length;
      const selected = level === activeLevel ? "is-active" : "";
      return `<button class="dashboard-tab ${selected}" type="button" data-level="${level}" role="tab" aria-selected="${level === activeLevel}">
        <span class="dashboard-tab-label">${escapeHtml(levelLabel(level))}</span>
        <span class="dashboard-tab-count">${count}</span>
      </button>`;
    })
    .join("");
}

function medalClass(index) {
  if (index === 0) return "is-gold";
  if (index === 1) return "is-silver";
  if (index === 2) return "is-bronze";
  return "";
}

function renderPanel(byLevel) {
  if (!activeLevel) {
    panelEl.innerHTML = `<div class="dashboard-empty">
      <p class="dashboard-empty-title">Пока пусто</p>
      <p class="dashboard-empty-text">Результаты появятся после прохождения уровней в Telegram.</p>
    </div>`;
    return;
  }

  const rows = byLevel[activeLevel] || [];
  if (!rows.length) {
    panelEl.innerHTML = `<div class="dashboard-empty">
      <p class="dashboard-empty-title">Нет результатов</p>
      <p class="dashboard-empty-text">Для ${escapeHtml(levelTitle(activeLevel))} ещё нет записей.</p>
    </div>`;
    return;
  }

  panelEl.innerHTML = `
    <div class="dashboard-level-head">
      <p class="dashboard-level-kicker">Рейтинг</p>
      <h2 class="dashboard-level-title">${escapeHtml(levelTitle(activeLevel))}</h2>
    </div>
    <ul class="dashboard-list" role="list">
      ${rows
        .map(
          (row, index) => `
        <li class="dashboard-row ${medalClass(index)}">
          <span class="dashboard-rank" aria-hidden="true">${index + 1}</span>
          <div class="dashboard-row-main">
            <p class="dashboard-name">${escapeHtml(row.player_name || "Игрок")}</p>
            <p class="dashboard-date">${escapeHtml(formatDate(row.played_at))}</p>
          </div>
          <div class="dashboard-score-block">
            <span class="dashboard-score">${escapeHtml(row.points)}</span>
            <span class="dashboard-score-unit">очков</span>
          </div>
        </li>`
        )
        .join("")}
    </ul>
  `;
}

function renderStats(data) {
  statsCache = data;
  const byLevel = data.byLevel || {};
  const total = (data.rows || []).length;
  metaEl.textContent = total ? `${total} записей` : "Записей пока нет";
  renderTabs(byLevel);
  renderPanel(byLevel);
}

async function loadDashboard() {
  metaEl.textContent = "Загрузка…";
  refreshBtn.classList.add("is-spinning");
  panelEl.innerHTML = `<div class="dashboard-empty">
    <p class="dashboard-empty-title">Загрузка…</p>
    <p class="dashboard-empty-text">Собираем результаты игроков</p>
  </div>`;

  try {
    const data = await fetchStats();
    renderStats(data);
  } catch (error) {
    metaEl.textContent = "Ошибка загрузки";
    panelEl.innerHTML = `<div class="dashboard-empty">
      <p class="dashboard-empty-title">Не удалось загрузить</p>
      <p class="dashboard-empty-text">${escapeHtml(error.message || "Попробуйте обновить")}</p>
    </div>`;
  } finally {
    refreshBtn.classList.remove("is-spinning");
  }
}

tabsEl.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-level]");
  if (!btn || !statsCache) return;
  activeLevel = btn.dataset.level;
  renderTabs(statsCache.byLevel || {});
  renderPanel(statsCache.byLevel || {});
});

refreshBtn.addEventListener("click", () => {
  void loadDashboard();
});

setupTelegramWebApp();
void loadDashboard();
