(function () {
  const root = document.getElementById("admin");
  const G = window.MPGame;
  const tokenKey = "mp-admin-password";
  const rateOptions = [
    [100, "Все баллы"],
    [50, "Половина"],
    [25, "Четверть"],
    [0, "Ноль"],
  ];
  const clinicMarkup = `<svg x="937" y="420" width="135" height="158" viewBox="-10 0 144 168" preserveAspectRatio="xMidYMax meet"><polygon points="100,24 89,16 109,16 120,24" fill="#eff6f9"/><polygon points="100,24 89,16 89,128 100,136" fill="#a2aaac"/><polygon points="22,36 11,28 93,28 104,36" fill="#fcfcfa"/><polygon points="22,36 11,28 11,152 22,160" fill="#b6b4ae"/><polygon points="18,29 7,21 95,21 106,29" fill="#a4cbc8"/><polygon points="18,29 7,21 7,30 18,38" fill="#2f6961"/><polygon points="46,12 35,4 69,4 80,12" fill="#f6f9fa"/><polygon points="46,12 35,4 35,22 46,30" fill="#adafae"/><polygon points="4,96 -7,88 17,88 28,96" fill="#f9fafa"/><polygon points="4,96 -7,88 -7,124 4,132" fill="#b1b1ae"/><polygon points="2,92 -9,84 19,84 30,92" fill="#a4cbc8"/><polygon points="2,92 -9,84 -9,89 2,97" fill="#2f6961"/><polygon points="40,124 29,116 75,116 86,124" fill="#a4cbc8"/><polygon points="40,124 29,116 29,121.5 40,129.5" fill="#2f6961"/><rect x="4" y="96" width="24" height="36" fill="#eef2f3"/><rect x="2" y="92" width="28" height="5" fill="#0f766e"/><rect x="22" y="36" width="82" height="124" fill="#f7f6f3"/><rect x="22" y="36" width="7" height="124" fill="#e3e0d8"/><rect x="100" y="24" width="20" height="112" fill="#d5e6f0"/><rect x="100" y="24" width="20" height="4" fill="#0f766e"/><rect x="108.5" y="28" width="1.1" height="108" fill="#ffffff" opacity="0.5"/><rect x="100" y="42" width="20" height="1.1" fill="#ffffff" opacity="0.72"/><rect x="100" y="58" width="20" height="1.1" fill="#ffffff" opacity="0.72"/><rect x="100" y="74" width="20" height="1.1" fill="#ffffff" opacity="0.72"/><rect x="100" y="90" width="20" height="1.1" fill="#ffffff" opacity="0.72"/><rect x="100" y="106" width="20" height="1.1" fill="#ffffff" opacity="0.72"/><rect x="100" y="122" width="20" height="1.1" fill="#ffffff" opacity="0.72"/><rect x="20" y="32" width="84" height="6" fill="#fbfaf7"/><rect x="18" y="29" width="88" height="3.5" fill="#0f766e"/><rect x="46" y="12" width="34" height="18" rx="1" fill="#e7eef3"/><rect x="46" y="12" width="34" height="3" fill="#c5d3dc"/><rect x="58" y="17" width="8" height="9" fill="#f7fbfd" stroke="#b7c9d6" stroke-width="0.5"/><circle cx="63" cy="50" r="10.5" fill="#fff" stroke="#f0d2d0" stroke-width="0.7"/><rect x="61.1" y="42.5" width="3.8" height="15" rx="0.5" fill="#e23b38"/><rect x="55.5" y="48.1" width="15" height="3.8" rx="0.5" fill="#e23b38"/><g><rect x="33" y="64" width="11" height="12" rx="0.5" fill="#f6e3b2" stroke="#b7c9d6" stroke-width="0.65"/><path d="M38.5 64 v12 M33 69.04 h11" stroke="#d4e2ec" stroke-width="0.4"/><rect x="32.7" y="76" width="11.6" height="1.4" fill="#cfc7bb"/></g><g><rect x="49" y="64" width="11" height="12" rx="0.5" fill="#f7fbfd" stroke="#b7c9d6" stroke-width="0.65"/><path d="M54.5 64 v12 M49 69.04 h11" stroke="#d4e2ec" stroke-width="0.4"/><rect x="48.7" y="76" width="11.6" height="1.4" fill="#cfc7bb"/></g><g><rect x="65" y="64" width="11" height="12" rx="0.5" fill="#f7fbfd" stroke="#b7c9d6" stroke-width="0.65"/><path d="M70.5 64 v12 M65 69.04 h11" stroke="#d4e2ec" stroke-width="0.4"/><rect x="64.7" y="76" width="11.6" height="1.4" fill="#cfc7bb"/></g><g><rect x="81" y="64" width="11" height="12" rx="0.5" fill="#f7fbfd" stroke="#b7c9d6" stroke-width="0.65"/><path d="M86.5 64 v12 M81 69.04 h11" stroke="#d4e2ec" stroke-width="0.4"/><rect x="80.7" y="76" width="11.6" height="1.4" fill="#cfc7bb"/></g><g><rect x="33" y="84" width="11" height="12" rx="0.5" fill="#f7fbfd" stroke="#b7c9d6" stroke-width="0.65"/><path d="M38.5 84 v12 M33 89.04 h11" stroke="#d4e2ec" stroke-width="0.4"/><rect x="32.7" y="96" width="11.6" height="1.4" fill="#cfc7bb"/></g><g><rect x="49" y="84" width="11" height="12" rx="0.5" fill="#f6e3b2" stroke="#b7c9d6" stroke-width="0.65"/><path d="M54.5 84 v12 M49 89.04 h11" stroke="#d4e2ec" stroke-width="0.4"/><rect x="48.7" y="96" width="11.6" height="1.4" fill="#cfc7bb"/></g><g><rect x="65" y="84" width="11" height="12" rx="0.5" fill="#f7fbfd" stroke="#b7c9d6" stroke-width="0.65"/><path d="M70.5 84 v12 M65 89.04 h11" stroke="#d4e2ec" stroke-width="0.4"/><rect x="64.7" y="96" width="11.6" height="1.4" fill="#cfc7bb"/></g><g><rect x="81" y="84" width="11" height="12" rx="0.5" fill="#f7fbfd" stroke="#b7c9d6" stroke-width="0.65"/><path d="M86.5 84 v12 M81 89.04 h11" stroke="#d4e2ec" stroke-width="0.4"/><rect x="80.7" y="96" width="11.6" height="1.4" fill="#cfc7bb"/></g><g><rect x="33" y="104" width="11" height="12" rx="0.5" fill="#f7fbfd" stroke="#b7c9d6" stroke-width="0.65"/><path d="M38.5 104 v12 M33 109.04 h11" stroke="#d4e2ec" stroke-width="0.4"/><rect x="32.7" y="116" width="11.6" height="1.4" fill="#cfc7bb"/></g><g><rect x="49" y="104" width="11" height="12" rx="0.5" fill="#f7fbfd" stroke="#b7c9d6" stroke-width="0.65"/><path d="M54.5 104 v12 M49 109.04 h11" stroke="#d4e2ec" stroke-width="0.4"/><rect x="48.7" y="116" width="11.6" height="1.4" fill="#cfc7bb"/></g><g><rect x="65" y="104" width="11" height="12" rx="0.5" fill="#f6e3b2" stroke="#b7c9d6" stroke-width="0.65"/><path d="M70.5 104 v12 M65 109.04 h11" stroke="#d4e2ec" stroke-width="0.4"/><rect x="64.7" y="116" width="11.6" height="1.4" fill="#cfc7bb"/></g><g><rect x="81" y="104" width="11" height="12" rx="0.5" fill="#f7fbfd" stroke="#b7c9d6" stroke-width="0.65"/><path d="M86.5 104 v12 M81 109.04 h11" stroke="#d4e2ec" stroke-width="0.4"/><rect x="80.7" y="116" width="11.6" height="1.4" fill="#cfc7bb"/></g><g><rect x="9" y="104" width="12" height="11" rx="0.5" fill="#f6e3b2" stroke="#b7c9d6" stroke-width="0.65"/><path d="M15 104 v11 M9 108.62 h12" stroke="#d4e2ec" stroke-width="0.4"/><rect x="8.7" y="115" width="12.6" height="1.4" fill="#cfc7bb"/></g><g><rect x="30" y="136" width="10" height="12" rx="0.5" fill="#f7fbfd" stroke="#b7c9d6" stroke-width="0.65"/><path d="M35 136 v12 M30 141.04 h10" stroke="#d4e2ec" stroke-width="0.4"/><rect x="29.7" y="148" width="10.6" height="1.4" fill="#cfc7bb"/></g><g><rect x="86" y="136" width="10" height="12" rx="0.5" fill="#f6e3b2" stroke="#b7c9d6" stroke-width="0.65"/><path d="M91 136 v12 M86 141.04 h10" stroke="#d4e2ec" stroke-width="0.4"/><rect x="85.7" y="148" width="10.6" height="1.4" fill="#cfc7bb"/></g><rect x="22" y="128" width="82" height="28" fill="#efeae3"/><rect x="40" y="124" width="46" height="5.5" rx="0.4" fill="#0f766e"/><rect x="49" y="130" width="28" height="30" rx="0.8" fill="#24343c"/><rect x="51.5" y="132.5" width="10" height="20" fill="#d7eef8"/><rect x="63.5" y="132.5" width="10" height="20" fill="#c5e4f4"/><rect x="22" y="158" width="82" height="4" fill="#d3ccc0"/><rect x="46" y="162" width="34" height="2.5" fill="#e6dfd4"/></svg>`;

  function sceneHtml() {
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
      <g class="menu-house" transform="translate(184 582)">
        <g transform="scale(1.22) translate(-32 -74)">
          <ellipse cx="32" cy="72" rx="26" ry="2.8" fill="#5f8a45" opacity="0.32"/>
          <rect x="10" y="68" width="44" height="4" fill="#d9cdb8"/>
          <rect x="14" y="71.2" width="36" height="2" fill="#c9bba4"/>
          <rect x="12" y="32" width="40" height="37" fill="#fbf6ee"/>
          <rect x="12" y="32" width="4" height="37" fill="#efe6d8"/>
          <polygon points="6,34 32,10 58,34" fill="#c4533f"/>
          <polygon points="6,34 32,10 32,15 11,35" fill="#a84434"/>
          <rect x="46" y="16" width="6" height="16" fill="#8d5a45"/>
          <rect x="44" y="14" width="10" height="3" fill="#6e4636"/>
          <rect x="16" y="40" width="12" height="10" rx="0.5" fill="#f6e3b2" stroke="#9bb0c2" stroke-width="0.7"/>
          <rect x="36" y="40" width="12" height="10" rx="0.5" fill="#f7fbff" stroke="#9bb0c2" stroke-width="0.7"/>
          <path d="M22 40 v10 M16 45 h12 M42 40 v10 M36 45 h12" stroke="#d5e2ec" stroke-width="0.6"/>
          <rect x="27" y="52" width="10" height="18" rx="0.5" fill="#4a4038"/>
          <rect x="28.2" y="53.2" width="3.4" height="8" fill="#6d5c4e"/>
          <rect x="32.4" y="53.2" width="3.4" height="8" fill="#5c4d42"/>
          <circle cx="35" cy="61" r="0.8" fill="#e6d7c4"/>
        </g>
      </g>
      ${clinicMarkup}
    </svg>`;
  }

  let view = "catalog";
  let claimDrug = "";
  let catalog = null;
  let catalogStatus = null;
  let players = [];
  let playersStatus = null;

  function esc(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function password() {
    return sessionStorage.getItem(tokenKey) || "";
  }

  function nameParts(full) {
    const parts = String(full).trim().split(/\s+/);
    const first = parts[0] || "";
    const last = parts.slice(1).join(" ");
    return { first, last: last || first };
  }

  function frame(cardHtml, mode) {
    const corner = mode === "login"
      ? `<a class="admin-corner" href="/">К игре</a>`
      : `<button type="button" class="admin-corner" data-action="logout">Выйти</button>`;
    const wide = mode === "roster" ? " is-roster" : mode === "login" ? " is-login" : "";
    root.innerHTML = `<section class="start menu admin-menu${wide}">
      ${sceneHtml()}
      ${corner}
      <div class="menu-shell">
        <header class="menu-title">
          <p class="eyebrow">Визитный день</p>
          <h1>Админка</h1>
        </header>
        <div class="menu-card">${cardHtml}</div>
      </div>
    </section>`;
    root.querySelector("[data-action='logout']")?.addEventListener("click", logout);
  }

  function paintLogin(message) {
    frame(`<form id="login-form">
        <label class="field">Пароль
          <input name="password" type="password" autocomplete="current-password" required>
        </label>
        <p class="admin-status${message ? " is-bad" : ""}" role="status">${message ? esc(message) : ""}</p>
        <button class="btn" type="submit">Войти</button>
      </form>`, "login");
    const input = root.querySelector('input[name="password"]');
    input.focus();
    root.querySelector("#login-form").addEventListener("submit", enter);
  }

  async function enter(event) {
    event.preventDefault();
    const input = root.querySelector('input[name="password"]');
    const value = input.value;
    const button = root.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const response = await fetch("/api/catalog", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: value }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        paintLogin(data.error || "Неверный пароль.");
        return;
      }
      sessionStorage.setItem(tokenKey, value);
      await boot();
    } catch (error) {
      paintLogin("Нет связи с сервером.");
    }
  }

  function logout(event) {
    event.preventDefault();
    sessionStorage.removeItem(tokenKey);
    view = "catalog";
    paintLogin("");
  }

  function shell(body) {
    const tabs = [
      ["catalog", "Каталог"],
      ["claims", "Утверждения"],
      ["players", "Участники"],
      ["roster", "Справочник"],
    ];
    const tabHtml = tabs.map(([id, label]) =>
      `<button type="button" class="${view === id ? "is-on" : ""}" data-view="${id}" role="tab" aria-selected="${view === id ? "true" : "false"}">${label}</button>`
    ).join("");
    frame(`<div class="board-tabs" role="tablist">${tabHtml}</div><div class="admin-body">${body}</div>`, view);
    root.querySelectorAll("[data-view]").forEach((button) => {
      button.addEventListener("click", () => openView(button.dataset.view));
    });
  }

  function openView(next) {
    if (next === view && next !== "players") return;
    readOpenForm();
    view = next;
    if (next === "players") loadPlayers();
    else render();
  }

  function render() {
    if (view === "players") renderPlayers();
    else if (view === "roster") renderRoster();
    else if (view === "claims") renderClaims();
    else renderCatalog();
  }

  function renderCatalog() {
    const current = catalog || G.currentCatalog();
    const specs = current.specialties.map((spec) => `
      <label><span><i class="admin-swatch" style="background:${esc(spec.color)}"></i>${esc(spec.label)}</span>
        <input name="spec" data-id="${esc(spec.id)}" value="${esc(spec.label)}" maxlength="40" required>
      </label>`).join("");
    const drugs = current.drugs.map((drug) => `
      <label><span>Препарат</span>
        <input name="drug" data-id="${esc(drug.id)}" value="${esc(drug.name)}" maxlength="40" required>
      </label>`).join("");
    const head = current.drugs.map((drug) => `<th data-drug="${esc(drug.id)}">${esc(drug.name)}</th>`).join("");
    const body = current.specialties.map((spec) => {
      const cells = current.drugs.map((drug) => {
        const rate = current.rates[spec.id][drug.id];
        const options = rateOptions.map(([value, label]) =>
          `<option value="${value}"${value === rate ? " selected" : ""}>${label}</option>`
        ).join("");
        return `<td><select data-spec="${esc(spec.id)}" data-drug="${esc(drug.id)}">${options}</select></td>`;
      }).join("");
      return `<tr><th data-spec="${esc(spec.id)}">${esc(spec.label)}</th>${cells}</tr>`;
    }).join("");
    const tone = catalogStatus && catalogStatus.ok ? "is-ok" : "is-bad";
    shell(`<form id="catalog-form">
        <section class="admin-card">
          <h2>Специальности</h2>
          <div class="admin-names">${specs}</div>
        </section>
        <section class="admin-card">
          <h2>Препараты</h2>
          <div class="admin-names">${drugs}</div>
        </section>
        <section class="admin-card">
          <h2>Проценты</h2>
          <p class="admin-note">Строка — специальность врача, столбец — препарат. Если врач не назначает препарат, визит всё равно даёт 0, даже когда в клетке не ноль. Специальность на день назначается случайно, имена врачей не меняются.</p>
          <div class="admin-table-wrap">
            <table class="admin-table">
              <thead><tr><th></th>${head}</tr></thead>
              <tbody>${body}</tbody>
            </table>
          </div>
        </section>
        <div class="admin-actions">
          <p class="admin-status ${catalogStatus ? tone : ""}" role="status">${catalogStatus ? esc(catalogStatus.text) : ""}</p>
          <button class="btn" type="submit">Сохранить</button>
        </div>
      </form>`);
    root.querySelector("#catalog-form").addEventListener("submit", save);
    root.querySelectorAll('input[name="spec"], input[name="drug"]').forEach((input) => {
      input.addEventListener("input", syncHeadings);
    });
  }

  function ensureCatalog() {
    if (!catalog) catalog = G.currentCatalog();
    return catalog;
  }

  function readOpenForm() {
    if (view === "catalog") readCatalogForm();
    else if (view === "claims") readClaimsForm();
  }

  function readCatalogForm() {
    const current = ensureCatalog();
    if (!root.querySelector("#catalog-form")) return;
    current.specialties = current.specialties.map((spec) => {
      const input = root.querySelector(`input[name="spec"][data-id="${spec.id}"]`);
      return input ? { ...spec, label: input.value } : spec;
    });
    current.drugs = current.drugs.map((drug) => {
      const input = root.querySelector(`input[name="drug"][data-id="${drug.id}"]`);
      return input ? { ...drug, name: input.value } : drug;
    });
    const rates = {};
    current.specialties.forEach((spec) => {
      rates[spec.id] = {};
      current.drugs.forEach((drug) => {
        const select = root.querySelector(`select[data-spec="${spec.id}"][data-drug="${drug.id}"]`);
        const previous = current.rates && current.rates[spec.id] ? current.rates[spec.id][drug.id] : 0;
        rates[spec.id][drug.id] = select ? Number(select.value) : previous;
      });
    });
    current.rates = rates;
  }

  function readClaimsForm() {
    const current = ensureCatalog();
    if (!root.querySelector("#claims-form")) return;
    const claims = {};
    current.drugs.forEach((drug) => {
      const list = root.querySelector(`[data-claim-list="${drug.id}"]`);
      claims[drug.id] = list
        ? [...list.querySelectorAll('input[name="drug-claim"]')].map((field) => field.value)
        : (current.claims && current.claims[drug.id]) || [];
    });
    current.claims = claims;
    const wrongList = root.querySelector('[data-claim-list="wrong"]');
    if (wrongList) {
      current.wrongClaims = [...wrongList.querySelectorAll('input[name="wrong-claim"]')].map((field) => field.value);
    }
  }

  function filledCount(values) {
    return (Array.isArray(values) ? values : []).filter((text) => String(text).trim()).length;
  }

  function renderClaims() {
    const current = ensureCatalog();
    const claims = current.claims || {};
    const wrong = Array.isArray(current.wrongClaims) ? current.wrongClaims : [];
    if (!current.drugs.some((drug) => drug.id === claimDrug)) {
      claimDrug = current.drugs[0] ? current.drugs[0].id : "";
    }
    const options = current.drugs.map((drug) => {
      const name = drug.name || "Препарат";
      return `<option value="${esc(drug.id)}" data-name="${esc(name)}"${drug.id === claimDrug ? " selected" : ""}>${esc(name)} · ${filledCount(claims[drug.id])}</option>`;
    }).join("");
    const panels = current.drugs.map((drug) => {
      const list = Array.isArray(claims[drug.id]) ? claims[drug.id] : [];
      const on = drug.id === claimDrug;
      return `<div class="admin-claim-block${on ? " is-on" : ""}" data-claim-panel="${esc(drug.id)}">
          <p class="admin-claim-empty" data-claim-empty="${esc(drug.id)}"${list.length ? " hidden" : ""}>Верных утверждений пока нет</p>
          <div class="admin-claims" data-claim-list="${esc(drug.id)}">${claimFields("drug-claim", list)}</div>
        </div>`;
    }).join("");
    const tone = catalogStatus && catalogStatus.ok ? "is-ok" : "is-bad";
    shell(`<form id="claims-form">
        <p class="admin-note">В визите одно верное утверждение выбранного препарата и три неверных из общего пула. Пустые строки не сохраняются.</p>
        <div class="claim-split">
          <section class="admin-card">
            <div class="claim-head">
              <h2>Верные</h2>
              <button type="button" class="claim-add" data-add-claim data-correct-add data-list="${esc(claimDrug)}">Добавить</button>
            </div>
            <label class="claim-pick">Препарат
              <select class="claim-select" data-claim-select aria-label="Препарат">${options}</select>
            </label>
            <div class="claim-lists">${panels}</div>
          </section>
          <section class="admin-card">
            <div class="claim-head">
              <h2>Неверные <b class="claim-count" data-wrong-count>${filledCount(wrong)}</b></h2>
              <button type="button" class="claim-add" data-add-claim data-list="wrong">Добавить</button>
            </div>
            <p class="admin-claim-empty" data-claim-empty="wrong"${wrong.length ? " hidden" : ""}>Неверных утверждений пока нет</p>
            <div class="admin-claim-scroll">
              <div class="admin-claims" data-claim-list="wrong">${claimFields("wrong-claim", wrong)}</div>
            </div>
          </section>
        </div>
        <div class="admin-actions">
          <p class="admin-status ${catalogStatus ? tone : ""}" role="status">${catalogStatus ? esc(catalogStatus.text) : ""}</p>
          <button class="btn" type="submit">Сохранить</button>
        </div>
      </form>`);
    const form = root.querySelector("#claims-form");
    form.addEventListener("submit", save);
    form.addEventListener("click", onClaimClick);
    form.addEventListener("input", refreshClaimMeta);
    form.querySelector("[data-claim-select]")?.addEventListener("change", (event) => {
      showClaimDrug(event.target.value);
    });
  }

  function claimFields(name, values) {
    const list = Array.isArray(values) ? values : [];
    return list.map((text) => claimField(name, text)).join("");
  }

  function claimField(name, text) {
    return `<div class="admin-claim">
      <input name="${name}" value="${esc(text)}" maxlength="240" placeholder="Утверждение" title="${esc(text)}" autocomplete="off">
      <button type="button" class="admin-claim-remove" data-remove-claim aria-label="Удалить утверждение">×</button>
    </div>`;
  }

  function showClaimDrug(id) {
    claimDrug = id;
    const add = root.querySelector("[data-correct-add]");
    if (add) add.dataset.list = id;
    const select = root.querySelector("[data-claim-select]");
    if (select && select.value !== id) select.value = id;
    root.querySelectorAll("[data-claim-panel]").forEach((panel) => {
      panel.classList.toggle("is-on", panel.dataset.claimPanel === id);
    });
  }

  function refreshClaimMeta() {
    const select = root.querySelector("[data-claim-select]");
    if (select) {
      [...select.options].forEach((option) => {
        const list = root.querySelector(`[data-claim-list="${option.value}"]`);
        if (!list) return;
        const count = [...list.querySelectorAll("input")].filter((field) => field.value.trim()).length;
        const name = option.dataset.name || "Препарат";
        option.textContent = `${name} · ${count}`;
      });
    }
    const wrong = root.querySelector('[data-claim-list="wrong"]');
    const wrongBadge = root.querySelector("[data-wrong-count]");
    if (wrong && wrongBadge) {
      wrongBadge.textContent = String([...wrong.querySelectorAll("input")].filter((field) => field.value.trim()).length);
    }
    root.querySelectorAll("[data-claim-empty]").forEach((hint) => {
      const list = root.querySelector(`[data-claim-list="${hint.dataset.claimEmpty}"]`);
      hint.hidden = !!(list && list.children.length);
    });
  }

  function onClaimClick(event) {
    const add = event.target.closest("[data-add-claim]");
    if (add) {
      const list = root.querySelector(`[data-claim-list="${add.dataset.list}"]`);
      if (!list) return;
      const name = add.dataset.list === "wrong" ? "wrong-claim" : "drug-claim";
      list.insertAdjacentHTML("beforeend", claimField(name, ""));
      const field = list.lastElementChild && list.lastElementChild.querySelector("input");
      if (field) {
        field.focus();
        field.scrollIntoView({ block: "nearest" });
      }
      refreshClaimMeta();
      return;
    }
    const remove = event.target.closest("[data-remove-claim]");
    if (!remove) return;
    const row = remove.closest(".admin-claim");
    if (!row) return;
    row.remove();
    refreshClaimMeta();
  }

  function syncHeadings() {
    root.querySelectorAll('input[name="spec"]').forEach((input) => {
      const cell = root.querySelector(`th[data-spec="${input.dataset.id}"]`);
      if (cell) cell.textContent = input.value.trim() || "Специальность";
    });
    root.querySelectorAll('input[name="drug"]').forEach((input) => {
      const cell = root.querySelector(`th[data-drug="${input.dataset.id}"]`);
      if (cell) cell.textContent = input.value.trim() || "Препарат";
    });
  }

  function collect() {
    readOpenForm();
    const current = ensureCatalog();
    return {
      token: password(),
      catalog: {
        specialties: current.specialties,
        drugs: current.drugs,
        rates: current.rates,
        claims: current.claims || {},
        wrongClaims: Array.isArray(current.wrongClaims) ? current.wrongClaims : [],
      },
    };
  }

  async function save(event) {
    event.preventDefault();
    const collected = collect();
    const button = root.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const response = await fetch("/api/catalog", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...collected.catalog, password: collected.token }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        sessionStorage.removeItem(tokenKey);
        paintLogin(data.error || "Неверный пароль.");
        return;
      }
      if (!response.ok || !data.catalog) {
        catalog = collected.catalog;
        catalogStatus = { ok: false, text: data.error || "Не удалось сохранить." };
        render();
        return;
      }
      G.applyCatalog(data.catalog);
      catalog = data.catalog;
      catalogStatus = { ok: true, text: "Сохранено в Turso. Игра подхватит таблицу при обновлении." };
      render();
    } catch (error) {
      catalog = collected.catalog;
      catalogStatus = { ok: false, text: "Нет связи с сервером." };
      render();
    }
  }

  async function playerRequest(body) {
    const response = await fetch("/api/players", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${password()}`,
      },
      body: JSON.stringify({ ...body, password: password() }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      sessionStorage.removeItem(tokenKey);
      paintLogin(data.error || "Неверный пароль.");
      return null;
    }
    if (!response.ok) {
      playersStatus = { ok: false, text: data.error || "Не удалось изменить участника." };
      return null;
    }
    return data;
  }

  function renderPlayers() {
    const tone = playersStatus && playersStatus.ok ? "is-ok" : "is-bad";
    const rows = players.length
      ? players.map((player) => `<article class="admin-player">
          <form data-id="${esc(player.id)}">
            <input name="name" value="${esc(player.name)}" maxlength="24" required aria-label="Имя">
            <button class="btn" type="submit">Сохранить имя</button>
          </form>
          <p class="admin-player-meta">${player.days} ${esc(G.plural(player.days, "день", "дня", "дней"))} · лучший ${esc(G.formatScore(player.best))} · сумма ${esc(G.formatScore(player.total))}</p>
          <div class="admin-player-actions">
            <label class="admin-lock"><input type="checkbox" data-lock="${esc(player.id)}"${player.locked ? " checked" : ""}> Запретить смену имени</label>
            <button type="button" class="admin-text" data-delete="${esc(player.id)}">Удалить результаты</button>
          </div>
        </article>`).join("")
      : `<p class="admin-note">Пока никто не начинал день.</p>`;
    shell(`<section class="admin-card">
        <div class="admin-card-head">
          <h2>Участники</h2>
          <button type="button" class="admin-text" data-delete-all${players.some((player) => player.days) ? "" : " disabled"}>Удалить все результаты</button>
        </div>
        <p class="admin-note">Имя в таблице одно на участника. Если смена запрещена, при новом дне останется имя, которое задано здесь. Удаление стирает завершённые дни, само имя и запрет остаются.</p>
        <p class="admin-status ${playersStatus ? tone : ""}" role="status">${playersStatus ? esc(playersStatus.text) : ""}</p>
        <div class="admin-players">${rows}</div>
      </section>`);
    root.querySelectorAll(".admin-player form").forEach((form) => {
      form.addEventListener("submit", renamePlayer);
    });
    root.querySelectorAll("[data-lock]").forEach((input) => {
      input.addEventListener("change", () => lockPlayer(input));
    });
    root.querySelectorAll("[data-delete]").forEach((button) => {
      button.addEventListener("click", () => deletePlayer(button.dataset.delete));
    });
    const wipe = root.querySelector("[data-delete-all]");
    if (wipe) wipe.addEventListener("click", deleteAll);
  }

  async function loadPlayers(keepStatus) {
    view = "players";
    if (!keepStatus) playersStatus = null;
    renderPlayers();
    try {
      const response = await fetch("/api/players", {
        cache: "no-store",
        headers: { authorization: `Bearer ${password()}` },
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        sessionStorage.removeItem(tokenKey);
        paintLogin(data.error || "Неверный пароль.");
        return;
      }
      if (!response.ok) {
        playersStatus = { ok: false, text: data.error || "Не удалось прочитать участников." };
        renderPlayers();
        return;
      }
      players = Array.isArray(data.players) ? data.players : [];
      renderPlayers();
    } catch (error) {
      playersStatus = { ok: false, text: "Нет связи с сервером." };
      renderPlayers();
    }
  }

  async function renamePlayer(event) {
    event.preventDefault();
    const form = event.target;
    const name = form.querySelector("input").value.trim();
    if (!name) return;
    const saved = await playerRequest({ action: "rename", playerId: form.dataset.id, name });
    if (!saved) {
      if (password()) renderPlayers();
      return;
    }
    playersStatus = { ok: true, text: "Имя сохранено. В таблице лидеров оно уже стоит на всех днях этого участника." };
    loadPlayers(true);
  }

  async function lockPlayer(input) {
    const locked = input.checked;
    const saved = await playerRequest({ action: "lock", playerId: input.dataset.lock, locked });
    if (!saved) {
      input.checked = !locked;
      if (password()) renderPlayers();
      return;
    }
    const row = players.find((player) => player.id === input.dataset.lock);
    if (row) row.locked = locked;
    playersStatus = { ok: true, text: locked ? "Смена имени запрещена." : "Игрок снова может сменить имя." };
    renderPlayers();
  }

  async function deletePlayer(id) {
    const row = players.find((player) => player.id === id);
    const name = row ? row.name : "участника";
    if (!window.confirm(`Удалить результаты «${name}»? Завершённые дни исчезнут из таблицы.`)) return;
    const saved = await playerRequest({ action: "delete", playerId: id });
    if (!saved) {
      if (password()) renderPlayers();
      return;
    }
    playersStatus = { ok: true, text: `Результаты «${name}» удалены.` };
    loadPlayers(true);
  }

  async function deleteAll() {
    if (!window.confirm("Удалить результаты всех участников? Завершённые дни исчезнут из таблицы. Это нельзя отменить.")) return;
    const saved = await playerRequest({ action: "delete-all" });
    if (!saved) {
      if (password()) renderPlayers();
      return;
    }
    playersStatus = { ok: true, text: "Результаты всех участников удалены." };
    loadPlayers(true);
  }

  function renderRoster() {
    const places = G.CLINIC_NAMES.map((name) => `<p class="roster-place">${esc(name)}</p>`).join("");
    const named = {};
    G.DOCTORS.forEach((doctor) => {
      named[doctor.id] = { specialty: doctor.specialty };
    });
    G.stampRosterNames(named);
    const cards = G.DOCTORS.map((doctor) => {
      const spec = G.specialtyOf(doctor.specialty);
      const { first, last } = nameParts(named[doctor.id].name);
      return `<article class="roster-card">
        ${window.MPPortrait(doctor.id)}
        <p class="who"><span class="first">${esc(first)}</span><span class="last">${esc(last)}</span></p>
        <p class="spec" style="color:${spec.color}">${esc(spec.label)}</p>
      </article>`;
    }).join("");
    const lines = G.HOBBIES.map((hobby) => `<article class="roster-line"><b>${esc(hobby.label)}</b><span>${esc(hobby.line)}</span></article>`).join("");
    const general = G.generalNames();
    const nameChips = (list) => list.map((name) => `<p class="roster-name">${esc(name)}</p>`).join("");
    shell(`<section class="admin-roster">
        <p class="admin-note">${G.CLINIC_NAMES.length} лечебных учреждений и ${G.HOBBIES.length} интересов. Каждый день на дорогу попадают пять учреждений, в каждом три врача и три случайных интереса.</p>
        <p class="block-title">Поликлиники</p>
        <div class="roster-places">${places}</div>
        <p class="block-title">Интересы и реплики</p>
        <div class="roster-lines">${lines}</div>
        <p class="block-title">Врачи</p>
        <div class="roster-grid">${cards}</div>
        <p class="block-title">Общие имена</p>
        <p class="roster-note">Для любой специальности, кроме невролога, гинеколога, терапевта и хирурга.</p>
        <p class="roster-kicker">Женщины</p>
        <div class="roster-names">${nameChips(general.f)}</div>
        <p class="roster-kicker">Мужчины</p>
        <div class="roster-names">${nameChips(general.m)}</div>
      </section>`);
  }

  async function boot() {
    if (!password()) {
      paintLogin("");
      return;
    }
    const gate = await fetch("/api/catalog", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: password() }),
    }).then((response) => response.ok).catch(() => false);
    if (!gate) {
      sessionStorage.removeItem(tokenKey);
      paintLogin("Неверный пароль.");
      return;
    }
    catalog = G.currentCatalog();
    catalogStatus = null;
    render();
    try {
      const response = await fetch("/api/catalog", { cache: "no-store" });
      if (!response.ok) throw new Error("catalog");
      const data = await response.json();
      if (data.catalog && G.applyCatalog(data.catalog)) {
        catalog = G.currentCatalog();
        const text = data.source === "turso"
          ? "Таблица загружена из Turso."
          : "Показан встроенный набор. После сохранения игра будет брать таблицу из Turso.";
        catalogStatus = { ok: data.source === "turso", text: data.warning || text };
        if (view === "catalog" || view === "claims") render();
      }
    } catch (error) {
      catalogStatus = { ok: false, text: "База не ответила. Показан встроенный набор." };
      if (view === "catalog" || view === "claims") render();
    }
  }

  boot();
})();
