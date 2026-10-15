(function () {
  const root = document.getElementById("admin");
  const tokenKey = "mp-admin-password";
  const rateOptions = [
    [100, "Все баллы"],
    [50, "Половина"],
    [25, "Четверть"],
    [0, "Ноль"],
  ];

  function esc(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function password() {
    return sessionStorage.getItem(tokenKey) || "";
  }

  function paintLogin(message) {
    root.innerHTML = `<div class="admin-head">
        <div>
          <p class="eyebrow">Визитный день</p>
          <h1>Админка</h1>
        </div>
        <a class="admin-back" href="/">К игре</a>
      </div>
      <form id="login-form" class="admin-card admin-login">
        <h2>Вход</h2>
        <label class="admin-key">Пароль
          <input name="password" type="password" autocomplete="current-password" required>
        </label>
        <p class="admin-status${message ? " is-bad" : ""}" role="status">${message ? esc(message) : ""}</p>
        <button class="btn" type="submit">Войти</button>
      </form>`;
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

  function paint(catalog, status) {
    const specs = catalog.specialties.map((spec) => `
      <label><span><i class="admin-swatch" style="background:${esc(spec.color)}"></i>${esc(spec.label)}</span>
        <input name="spec" data-id="${esc(spec.id)}" value="${esc(spec.label)}" maxlength="40" required>
      </label>`).join("");
    const drugs = catalog.drugs.map((drug) => `
      <label><span>Препарат</span>
        <input name="drug" data-id="${esc(drug.id)}" value="${esc(drug.name)}" maxlength="40" required>
      </label>`).join("");
    const head = catalog.drugs.map((drug) => `<th data-drug="${esc(drug.id)}">${esc(drug.name)}</th>`).join("");
    const body = catalog.specialties.map((spec) => {
      const cells = catalog.drugs.map((drug) => {
        const current = catalog.rates[spec.id][drug.id];
        const options = rateOptions.map(([rate, label]) =>
          `<option value="${rate}"${rate === current ? " selected" : ""}>${label}</option>`
        ).join("");
        return `<td><select data-spec="${esc(spec.id)}" data-drug="${esc(drug.id)}">${options}</select></td>`;
      }).join("");
      return `<tr><th data-spec="${esc(spec.id)}">${esc(spec.label)}</th>${cells}</tr>`;
    }).join("");
    const tone = status && status.ok ? "is-ok" : "is-bad";
    root.innerHTML = `<div class="admin-head">
        <div>
          <p class="eyebrow">Визитный день</p>
          <h1>Админка</h1>
        </div>
        <a class="admin-back" href="/" data-action="logout">Выйти</a>
      </div>
      <form id="catalog-form">
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
          <p class="admin-status ${status ? tone : ""}" role="status">${status ? esc(status.text) : ""}</p>
          <button class="btn" type="submit">Сохранить</button>
        </div>
      </form>`;
    root.querySelector("#catalog-form").addEventListener("submit", save);
    root.querySelector("[data-action='logout']").addEventListener("click", (event) => {
      event.preventDefault();
      sessionStorage.removeItem(tokenKey);
      paintLogin("");
    });
    root.querySelectorAll('input[name="spec"], input[name="drug"]').forEach((input) => {
      input.addEventListener("input", syncHeadings);
    });
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
    const token = password();
    const base = window.MPGame.currentCatalog();
    const specialties = base.specialties.map((spec) => {
      const input = root.querySelector(`input[name="spec"][data-id="${spec.id}"]`);
      return { ...spec, label: input.value };
    });
    const drugs = base.drugs.map((drug) => {
      const input = root.querySelector(`input[name="drug"][data-id="${drug.id}"]`);
      return { ...drug, name: input.value };
    });
    const rates = {};
    specialties.forEach((spec) => {
      rates[spec.id] = {};
      drugs.forEach((drug) => {
        const select = root.querySelector(`select[data-spec="${spec.id}"][data-drug="${drug.id}"]`);
        rates[spec.id][drug.id] = Number(select.value);
      });
    });
    return { token, catalog: { specialties, drugs, rates } };
  }

  async function save(event) {
    event.preventDefault();
    const { token, catalog } = collect();
    const button = root.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const response = await fetch("/api/catalog", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...catalog, password: token }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        sessionStorage.removeItem(tokenKey);
        paintLogin(data.error || "Неверный пароль.");
        return;
      }
      if (!response.ok || !data.catalog) {
        paint(catalog, { ok: false, text: data.error || "Не удалось сохранить." });
        return;
      }
      window.MPGame.applyCatalog(data.catalog);
      paint(data.catalog, { ok: true, text: "Сохранено в Turso. Игра подхватит таблицу при обновлении." });
    } catch (error) {
      paint(catalog, { ok: false, text: "Нет связи с сервером." });
    }
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
    paint(window.MPGame.currentCatalog(), null);
    try {
      const response = await fetch("/api/catalog", { cache: "no-store" });
      if (!response.ok) throw new Error("catalog");
      const data = await response.json();
      if (data.catalog && window.MPGame.applyCatalog(data.catalog)) {
        const text = data.source === "turso"
          ? "Таблица загружена из Turso."
          : "Показан встроенный набор. После сохранения игра будет брать таблицу из Turso.";
        paint(window.MPGame.currentCatalog(), { ok: data.source === "turso", text: data.warning || text });
      }
    } catch (error) {
      paint(window.MPGame.currentCatalog(), { ok: false, text: "База не ответила. Показан встроенный набор." });
    }
  }

  boot();
})();