(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.MPGame = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  // Five clinics in one row. Times are the ride from home; edges are the gaps between them.
  const ROAD_STOPS = 5;
  const DOCTORS_PER_CLINIC = 3;
  const TRUNK_STOPS = 5;
  const VISIT_MINUTES = 30;
  const INTEREST_MINUTES = 15;
  const DAY_MINUTES = 8 * 60;
  const DAY_START = 9 * 60;
  // Parent stop of each slot. 0 is home. The row is a single chain.
  const SLOT_PARENT = [0, 0, 1, 2, 3, 4];
  const DEPTH_POINTS = [0, 20, 40, 60, 80, 100];
  // Minutes on the edge from the parent to this slot.
  const EDGE_MINUTES = [0, 20, 20, 20, 30, 30];

  const SPEC_IDS = ["therapist", "gynecologist", "neurologist", "surgeon"];
  const DRUG_IDS = ["teralin", "femorin", "nevral", "regenox"];
  const SLOT_COLORS = ["#0f766e", "#be3a6a", "#3451a3", "#d06a1f"];
  const SCORE_RATES = [100, 50, 25, 0];
  const DRUGS = [];
  const SPECIALTIES = {};
  let catalog = null;

  const DOCTORS = [
    { id: 1, name: "Капелька Пульсова", specialty: "therapist", dislike: null, female: true },
    { id: 2, name: "Скальпель Швов", specialty: "surgeon", dislike: "teralin", female: false },
    { id: 3, name: "Узика Скринингова", specialty: "gynecologist", dislike: null, female: true },
    { id: 4, name: "Рефлекс Синапсов", specialty: "neurologist", dislike: "regenox", female: false },
    { id: 5, name: "Микстура Градусникова", specialty: "therapist", dislike: "nevral", female: true },
    { id: 6, name: "Наркоз Разрезов", specialty: "surgeon", dislike: null, female: false },
    { id: 7, name: "Фолликула Циклова", specialty: "gynecologist", dislike: "teralin", female: true },
    { id: 8, name: "Мигрень Нервова", specialty: "neurologist", dislike: "femorin", female: true },
    { id: 9, name: "Таблетка Давленцева", specialty: "therapist", dislike: null, female: true },
    { id: 10, name: "Шов Зашивин", specialty: "surgeon", dislike: "nevral", female: false },
    { id: 11, name: "Бинтик Перевязов", specialty: "surgeon", dislike: "teralin", female: false },
    { id: 12, name: "Зеркальце Осмотрова", specialty: "gynecologist", dislike: null, female: true },
    { id: 13, name: "Бессонница Дремова", specialty: "neurologist", dislike: "regenox", female: true },
    { id: 14, name: "Сиропчик Отхаркин", specialty: "therapist", dislike: "femorin", female: false },
    { id: 15, name: "Зажим Сосудистов", specialty: "surgeon", dislike: null, female: false },
    { id: 16, name: "Цикл Календарёв", specialty: "gynecologist", dislike: "nevral", female: false },
    { id: 17, name: "Вертиго Кружилина", specialty: "neurologist", dislike: null, female: true },
    { id: 18, name: "Градусник Температуров", specialty: "therapist", dislike: "regenox", female: false },
    { id: 19, name: "Йод Антисептиков", specialty: "surgeon", dislike: "femorin", female: false },
    { id: 20, name: "Гормон Балансов", specialty: "gynecologist", dislike: null, female: false },
    { id: 21, name: "Память Вспоминаева", specialty: "neurologist", dislike: "teralin", female: true },
    { id: 22, name: "Рецепт Выписанов", specialty: "therapist", dislike: null, female: false },
    { id: 23, name: "Пластырь Царапкин", specialty: "surgeon", dislike: "nevral", female: false },
    { id: 24, name: "Кольпоскоп Смотров", specialty: "gynecologist", dislike: "regenox", female: false },
    { id: 25, name: "Тремор Дрожжин", specialty: "neurologist", dislike: null, female: false },
    { id: 26, name: "Капсула Оболочкова", specialty: "therapist", dislike: "femorin", female: true },
    { id: 27, name: "Нитка Кетгутова", specialty: "surgeon", dislike: null, female: true },
    { id: 28, name: "Овуляция Фазова", specialty: "gynecologist", dislike: "teralin", female: true },
    { id: 29, name: "Импульс Проводимов", specialty: "neurologist", dislike: "regenox", female: false },
    { id: 30, name: "Витамин Иммунов", specialty: "therapist", dislike: null, female: false },
  ];

  const DISLIKE_DOCTORS = new Set(
    DOCTORS.filter((doctor) => doctor.dislike).map((doctor) => doctor.id)
  );

  function namesOf(specialty, female) {
    return DOCTORS
      .filter((doctor) => doctor.specialty === specialty && doctor.female === female)
      .map((doctor) => doctor.name);
  }

  const NAME_POOLS = {
    therapist: { f: namesOf("therapist", true), m: namesOf("therapist", false) },
    gynecologist: { f: namesOf("gynecologist", true), m: namesOf("gynecologist", false).concat(["Фолликул Циклов"]) },
    neurologist: { f: namesOf("neurologist", true), m: namesOf("neurologist", false).concat(["Синапс Рефлексов"]) },
    surgeon: {
      f: namesOf("surgeon", true).concat(["Повязка Стерильна", "Кетгут Прочная", "Шовчик Аккуратна"]),
      m: namesOf("surgeon", false),
    },
    general: {
      f: [
        "Дозировка Точнова",
        "Процедура Бережнова",
        "Анамнезка Подробнова",
        "Пальпация Мягкова",
        "Перкуссия Звонкова",
        "Аускультация Яснова",
        "Медкарта Полнова",
        "Выписка Эпикризова",
        "Диспансеризация Годова",
        "Схема Лечебнова",
        "Ампула Стеклянова",
        "Мензурка Мернова",
        "Мазь Целебнова",
        "Доза Расчётнова",
        "Протокол Заполнова",
        "Маска Марлева",
      ],
      m: [
        "Фонендоскоп Трубков",
        "Халат Крахмалев",
        "Тонометр Манжетнов",
        "Шприц Одноразов",
        "Диагноз Рабочев",
        "Синдром Типичнов",
        "Симптом Ведущев",
        "Заключение Обоснованов",
        "Консилиум Согласнов",
        "Обход Утреннев",
        "Дежурство Ночнов",
        "Стационар Планов",
        "Результат Лабораторнов",
        "Направление Профильнов",
        "Журнал Назначений",
        "Жгут Венознов",
        "Штатив Инфузионнов",
        "Пузырь Согревов",
      ],
    },
  };

  function specialtyNameKey(label) {
    const text = cleanLabel(label).toLowerCase().replace(/ё/g, "е");
    if (text === "невролог") return "neurologist";
    if (text === "гинеколог") return "gynecologist";
    if (text === "хирург") return "surgeon";
    if (text === "терапевт" || text === "воп" || text === "врач общей практики") return "therapist";
    return "general";
  }

  function nameIsFemale(name) {
    const last = String(name || "").trim().split(/\s+/).pop().toLowerCase().replace(/ё/g, "е");
    return /[ая]$/.test(last);
  }

  function stampRosterNames(roster) {
    const groups = new Map();
    Object.keys(roster).forEach((key) => {
      const id = Number(key);
      const doctor = doctorById(id);
      const row = roster[key];
      if (!doctor || !row) return;
      const spec = specialtyOf(row.specialty);
      const poolKey = specialtyNameKey(spec ? spec.label : "");
      const groupKey = `${poolKey}:${doctor.female ? "f" : "m"}`;
      if (!groups.has(groupKey)) groups.set(groupKey, []);
      groups.get(groupKey).push(id);
    });
    const used = new Set();
    const ordered = [...groups.entries()].sort((a, b) => {
      const rank = (groupKey) => (groupKey.startsWith("general:") ? 1 : 0);
      return rank(a[0]) - rank(b[0]);
    });
    ordered.forEach(([groupKey, ids]) => {
      const split = groupKey.indexOf(":");
      const gender = groupKey.slice(split + 1);
      const pool = NAME_POOLS[groupKey.slice(0, split)][gender];
      const spare = NAME_POOLS.general[gender];
      ids.sort((a, b) => a - b);
      ids.forEach((id) => {
        const wantFemale = gender === "f";
        const name = [...pool, ...spare].find((candidate) => !used.has(candidate) && nameIsFemale(candidate) === wantFemale);
        used.add(name);
        roster[id].name = name;
      });
    });
    return roster;
  }

  function generalNames() {
    return {
      f: NAME_POOLS.general.f.slice(),
      m: NAME_POOLS.general.m.slice(),
    };
  }

  function cleanLabel(value) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, 40);
  }

  function cleanClaim(value) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, 240);
  }

  function uniqueClaims(list) {
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    const claims = [];
    list.forEach((item) => {
      const text = cleanClaim(typeof item === "string" ? item : item && item.text);
      if (!text || seen.has(text)) return;
      seen.add(text);
      claims.push(text);
    });
    return claims;
  }

  function specialtyMark(label, index) {
    const letter = cleanLabel(label).charAt(0).toUpperCase();
    return letter || String(index + 1);
  }

  function defaultCatalog() {
    const specNames = ["Терапевт", "Гинеколог", "Невролог", "Хирург"];
    const drugNames = ["Тералин", "Феморин", "Невролекс", "Регенокс"];
    const rates = {};
    SPEC_IDS.forEach((specId, specIndex) => {
      rates[specId] = {};
      DRUG_IDS.forEach((drugId, drugIndex) => {
        rates[specId][drugId] = specIndex === drugIndex ? 100 : 50;
      });
    });
    return {
      specialties: SPEC_IDS.map((id, index) => ({
        id,
        label: specNames[index],
        color: SLOT_COLORS[index],
        mark: specialtyMark(specNames[index], index),
      })),
      drugs: DRUG_IDS.map((id, index) => ({ id, name: drugNames[index] })),
      rates,
      claims: Object.fromEntries(DRUG_IDS.map((id) => [id, []])),
      wrongClaims: [],
    };
  }

  function normalizeCatalog(input) {
    if (!input || typeof input !== "object") return null;
    const specialties = [];
    for (let index = 0; index < SPEC_IDS.length; index += 1) {
      const id = SPEC_IDS[index];
      const row = Array.isArray(input.specialties)
        ? input.specialties.find((item) => item && item.id === id)
        : null;
      const label = cleanLabel(row && row.label);
      if (!label) return null;
      specialties.push({
        id,
        label,
        color: SLOT_COLORS[index],
        mark: specialtyMark(label, index),
      });
    }
    const drugs = [];
    for (let index = 0; index < DRUG_IDS.length; index += 1) {
      const id = DRUG_IDS[index];
      const row = Array.isArray(input.drugs)
        ? input.drugs.find((item) => item && item.id === id)
        : null;
      const name = cleanLabel(row && row.name);
      if (!name) return null;
      drugs.push({ id, name });
    }
    const rates = {};
    for (let specIndex = 0; specIndex < SPEC_IDS.length; specIndex += 1) {
      const specId = SPEC_IDS[specIndex];
      const row = input.rates && input.rates[specId];
      rates[specId] = {};
      for (let drugIndex = 0; drugIndex < DRUG_IDS.length; drugIndex += 1) {
        const drugId = DRUG_IDS[drugIndex];
        const rate = Number(row && row[drugId]);
        if (!SCORE_RATES.includes(rate)) return null;
        rates[specId][drugId] = rate;
      }
    }
    const claims = {};
    DRUG_IDS.forEach((drugId) => {
      const row = Array.isArray(input.drugs)
        ? input.drugs.find((item) => item && item.id === drugId)
        : null;
      const raw = input.claims && Object.prototype.hasOwnProperty.call(input.claims, drugId)
        ? input.claims[drugId]
        : row && row.claims;
      claims[drugId] = uniqueClaims(raw);
    });
    return { specialties, drugs, rates, claims, wrongClaims: uniqueClaims(input.wrongClaims) };
  }

  function installCatalog(next) {
    catalog = next;
    DRUGS.splice(0, DRUGS.length, ...next.drugs.map((drug) => ({ id: drug.id, name: drug.name })));
    Object.keys(SPECIALTIES).forEach((key) => delete SPECIALTIES[key]);
    next.specialties.forEach((spec) => {
      SPECIALTIES[spec.id] = { label: spec.label, mark: spec.mark, color: spec.color };
    });
  }

  function applyCatalog(input) {
    const next = normalizeCatalog(input);
    if (!next) return false;
    installCatalog(next);
    return true;
  }

  function currentCatalog() {
    return JSON.parse(JSON.stringify(catalog));
  }

  function usedRates() {
    const found = new Set();
    Object.keys(catalog.rates).forEach((specId) => {
      Object.keys(catalog.rates[specId]).forEach((drugId) => found.add(catalog.rates[specId][drugId]));
    });
    return SCORE_RATES.filter((rate) => found.has(rate));
  }

  function pointsAt(base, rate) {
    return Math.round(Number(base) * Number(rate) / 100);
  }

  installCatalog(defaultCatalog());

  function doctorById(id) {
    return DOCTORS.find((doctor) => doctor.id === id) || null;
  }

  function drugById(id) {
    return DRUGS.find((drug) => drug.id === id) || null;
  }

  function specialtyOf(id) {
    return SPECIALTIES[id];
  }

  const CLINIC_NAMES = [
    "Городская больница «Это не к нам»",
    "Больница скорой помощи «Потерпите»",
    "Консультативный центр «Не наш профиль»",
    "Диспансер «Пересданный анализ»",
    "Поликлиника «Врач на больничном»",
    "Районная поликлиника «Широкий коридор»",
    "Поликлиника «Танометр врёт»",
    "Женская консультация «У вас на сколько?»",
    "Поликлиника «Весёлый главврач»",
    "Травмпункт «Что ж вы так?»",
    "Поликлиника «Рецепт на удачу»",
  ];

  const HOBBIES = [
    { id: "fishing", label: "Рыбалка", line: "Рыбалка в этом сезоне удалась?" },
    { id: "opera", label: "Опера", line: "Опера в этом месяце была?" },
    { id: "chess", label: "Шахматы", line: "Шахматы на перерыве не забросили?" },
    { id: "garden", label: "Огород", line: "Огород в этом году не запустили?" },
    { id: "football", label: "Футбол", line: "Футбол вчера смотрели?" },
    { id: "cooking", label: "Кулинария", line: "Кулинария — есть новый рецепт?" },
    { id: "dogs", label: "Собаки", line: "Собаки дома не скучают?" },
    { id: "cats", label: "Кошки", line: "Кошки снова командуют домом?" },
    { id: "running", label: "Бег", line: "Бег по утрам ещё держите?" },
    { id: "ski", label: "Лыжи", line: "Лыжи в этом году уже доставали?" },
    { id: "detective", label: "Детективы", line: "Детективы новые уже вышли?" },
    { id: "cars", label: "Машины", line: "Машины — новую уже обкатали?" },
    { id: "travel", label: "Путешествия", line: "Путешествия на отпуск уже выбрали?" },
    { id: "photo", label: "Фотография", line: "Фотография по выходным ещё жива?" },
    { id: "yoga", label: "Йога", line: "Йога по утрам не пропускается?" },
    { id: "dacha", label: "Дача", line: "Дача уже открыта в этом сезоне?" },
    { id: "theatre", label: "Театр", line: "Театр — билеты на этот месяц есть?" },
    { id: "coffee", label: "Кофе", line: "Кофе в городе вкусный нашли?" },
    { id: "history", label: "История", line: "История — какую эпоху сейчас читаете?" },
    { id: "bike", label: "Велосипед", line: "Велосипед по набережной ещё катаете?" },
    { id: "knit", label: "Вязание", line: "Успели связать что-нибудь уютное к зиме?" },
    { id: "mushrooms", label: "Грибы", line: "Грибы в лесу уже пошли?" },
    { id: "guitar", label: "Гитара", line: "Гитара по вечерам не пылится?" },
    { id: "pool", label: "Бассейн", line: "В бассейне по выходным поплавать любите?" },
    { id: "skate", label: "Скейтбординг", line: "На скейтборде пойдёте кататься в субботу?" },
    { id: "baking", label: "Выпечка", line: "Выпечка на неделе удалась?" },
    { id: "hiking", label: "Походы", line: "Походы на ближайшие выходные планируете?" },
    { id: "cinema", label: "Кино", line: "Кино на выходных какое-нибудь смотрели?" },
    { id: "aquarium", label: "Аквариум", line: "Аквариум дома не бунтует?" },
    { id: "tennis", label: "Теннис", line: "В теннис по выходным ещё играете?" },
  ];

  function hobbyById(id) {
    return HOBBIES.find((hobby) => hobby.id === id) || null;
  }

  function shuffle(list, rng) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function pickDoctorInterests(doctorIds, random) {
    const rng = random || Math.random;
    const interests = {};
    doctorIds.forEach((id) => {
      interests[id] = shuffle(HOBBIES.map((hobby) => hobby.id), rng).slice(0, 3);
    });
    return interests;
  }

  function rapportOptions(hobbyIds, random) {
    const rng = random || Math.random;
    const owned = hobbyIds.slice();
    const hit = owned[Math.floor(rng() * owned.length)];
    const decoys = shuffle(
      HOBBIES.map((hobby) => hobby.id).filter((id) => !owned.includes(id)),
      rng
    ).slice(0, 3);
    return shuffle([hit].concat(decoys), rng);
  }

  function applyRapport(points, rapport) {
    if (rapport === "hit") return points * 2;
    if (rapport === "miss") return points / 2;
    return points;
  }

  function claimsFor(drugId) {
    return uniqueClaims(catalog && catalog.claims && catalog.claims[drugId]);
  }

  function wrongClaimPool() {
    return uniqueClaims(catalog && catalog.wrongClaims);
  }

  function claimRound(drugId, random) {
    const correct = claimsFor(drugId);
    const wrong = wrongClaimPool();
    if (!correct.length || wrong.length < 3) return null;
    const rng = random || Math.random;
    const hit = correct[Math.floor(rng() * correct.length)];
    const decoys = shuffle(wrong.filter((text) => text !== hit), rng).slice(0, 3);
    if (decoys.length < 3) return null;
    const options = shuffle([hit].concat(decoys), rng);
    return { options, correct: options.indexOf(hit) };
  }

  function finishVisit(drugPoints, rapport, claim) {
    const base = Number(drugPoints);
    if (!Number.isFinite(base) || base <= 0) return 0;
    let value = base;
    if (rapport === "hit") value *= 2;
    else if (rapport === "miss") value /= 2;
    if (claim === "hit") value *= 2;
    return Math.round(value);
  }

  const WARM_REPLIES = [
    { m: "Я как раз об этом думал на обходе.", f: "Я как раз об этом думала на обходе." },
    { m: "Ну надо же. Я вас зауважал.", f: "Ну надо же. Я вас зауважала." },
    { m: "Убедили. Сегодня я добрый.", f: "Убедили. Сегодня я добрая." },
    { m: "Продолжайте. Я даже ручку отложил.", f: "Продолжайте. Я даже ручку отложила." },
    { m: "Редкость. Я такого захода не ждал.", f: "Редкость. Я такого захода не ждала." },
    { m: "Попали. Я даже улыбнулся.", f: "Попали. Я даже улыбнулась." },
    { m: "Приятно. Я уже был готов слушать про скидки.", f: "Приятно. Я уже была готова слушать про скидки." },
    { m: "Хорошо зашли. Я на минуту ваш.", f: "Хорошо зашли. Я на минуту ваша." },
    { m: "Оставьте визитку. Я заинтересовался.", f: "Оставьте визитку. Я заинтересовалась." },
    { m: "Вот это заход. Я даже очередь забыл.", f: "Вот это заход. Я даже очередь забыла." },
    { m: "Совпадение? Не верю. Но я рад.", f: "Совпадение? Не верю. Но я рада." },
    { m: "Можно было и раньше. Я бы дослушал.", f: "Можно было и раньше. Я бы дослушала." },
    { m: "Ладно. Я настроен слушать.", f: "Ладно. Я настроена слушать." },
    { m: "Так, это интересно. Я отложил историю болезни.", f: "Так, это интересно. Я отложила историю болезни." },
    { m: "Наконец-то не с порога. Я даже сел ровнее.", f: "Наконец-то не с порога. Я даже села ровнее." },
    { m: "Хм. Я такого не ожидал.", f: "Хм. Я такого не ожидала." },
    { m: "Садитесь ближе. Я вас почти впустил в тему.", f: "Садитесь ближе. Я вас почти впустила в тему." },
    { m: "Обычно про хобби врут. Сегодня я поверил.", f: "Обычно про хобби врут. Сегодня я поверила." },
  ];

  const COLD_REPLIES = [
    { m: "Мимо. Я даже бровь не поднял.", f: "Мимо. Я даже бровь не подняла." },
    { m: "Не моё. Я этим не увлекался.", f: "Не моё. Я этим не увлекалась." },
    { m: "Наугад. Я это уже слышал.", f: "Наугад. Я это уже слышала." },
    { m: "Нет. Я даже не удивился.", f: "Нет. Я даже не удивилась." },
    { m: "Лучше бы про дозировку. Я уже настроился на дело.", f: "Лучше бы про дозировку. Я уже настроилась на дело." },
    { m: "Улыбка засчитана. Я не повёлся.", f: "Улыбка засчитана. Я не повелась." },
    { m: "Кивну из вежливости. Я не впечатлён.", f: "Кивну из вежливости. Я не впечатлена." },
    { m: "Оставим это. Я ждал препарат.", f: "Оставим это. Я ждала препарат." },
    { m: "Не сегодня. Я закрыл тему.", f: "Не сегодня. Я закрыла тему." },
    { m: "Старались. Я остался холоден.", f: "Старались. Я осталась холодна." },
    { m: "Кабинет не для этого. Я уже открыл карту.", f: "Кабинет не для этого. Я уже открыла карту." },
    { m: "Тема закрыта. Я вспомнил про очередь.", f: "Тема закрыта. Я вспомнила про очередь." },
    { m: "Мимо кассы. Я не заинтересовался.", f: "Мимо кассы. Я не заинтересовалась." },
    { m: "Вы не по адресу. Я таким не жил.", f: "Вы не по адресу. Я таким не жила." },
    { m: "Второй попытки не будет. Я решил.", f: "Второй попытки не будет. Я решила." },
    { m: "Здесь я на это не клюнул.", f: "Здесь я на это не клюнула." },
    { m: "Жаль секунд. Я их уже списал.", f: "Жаль секунд. Я их уже списала." },
    { m: "Брови на месте. Я не купился.", f: "Брови на месте. Я не купилась." },
  ];

  const MALE_MARK = /(?<![\p{L}])(думал|зауважал|добрый|отложил|ждал|улыбнулся|готов|заинтересовался|забыл|рад|дослушал|настроен|ожидал|впустил|поверил|поднял|увлекался|слышал|удивился|настроился|повёлся|впечатлён|открыл|вспомнил|решил|клюнул|списал|купился|жил|холоден|сел)(?![\p{L}])/u;
  const FEMALE_MARK = /(?<![\p{L}])(думала|зауважала|добрая|отложила|ждала|улыбнулась|готова|заинтересовалась|забыла|рада|дослушала|настроена|ожидала|впустила|поверила|подняла|увлекалась|слышала|удивилась|настроилась|повелась|впечатлена|открыла|вспомнила|решила|клюнула|списала|купилась|жила|холодна|села|ваша)(?![\p{L}])/u;

  function doctorReaction(hit, female, random, avoid) {
    const rng = random || Math.random;
    const pool = hit ? WARM_REPLIES : COLD_REPLIES;
    const speak = (line) => (female ? line.f : line.m);
    let choices = pool;
    if (avoid) {
      const rest = pool.filter((line) => speak(line) !== avoid);
      if (rest.length) choices = rest;
    }
    return speak(choices[Math.floor(rng() * choices.length)]);
  }

  function reactionAgrees(text, female) {
    if (!text) return false;
    return female ? !MALE_MARK.test(text) : !FEMALE_MARK.test(text);
  }

  function pickClinicNames(random) {
    const rng = random || Math.random;
    const names = CLINIC_NAMES.slice();
    for (let i = names.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [names[i], names[j]] = [names[j], names[i]];
    }
    return names.slice(0, ROAD_STOPS);
  }

  function pickRoute(random) {
    const rng = random || Math.random;
    const ids = DOCTORS.map((doctor) => doctor.id);
    for (let i = ids.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    const clinics = [];
    for (let slot = 0; slot < ROAD_STOPS; slot += 1) {
      const start = slot * DOCTORS_PER_CLINIC;
      clinics.push(ids.slice(start, start + DOCTORS_PER_CLINIC));
    }
    return clinics;
  }

  function parentSlot(slot) {
    return slot > 0 && slot <= ROAD_STOPS ? SLOT_PARENT[slot] : 0;
  }

  function isTrunk(slot) {
    return slot >= 1 && slot <= TRUNK_STOPS;
  }

  function depthOfSlot(slot) {
    let depth = 0;
    let cursor = slot;
    while (cursor) {
      depth += 1;
      cursor = SLOT_PARENT[cursor];
      if (depth > ROAD_STOPS) return -1;
    }
    return depth;
  }

  function pointsForSlot(slot) {
    const depth = depthOfSlot(slot);
    return depth > 0 ? DEPTH_POINTS[depth] || 0 : 0;
  }

  function routePoints() {
    let sum = 0;
    for (let slot = 1; slot <= ROAD_STOPS; slot += 1) sum += pointsForSlot(slot);
    return sum;
  }

  function slotOf(route, placeId) {
    if (placeId === 0) return 0;
    if (!Array.isArray(route)) return -1;
    const index = route.findIndex((group) => Array.isArray(group) && group[0] === placeId);
    return index === -1 ? -1 : index + 1;
  }

  function slotPath(fromSlot, toSlot) {
    if (fromSlot < 0 || toSlot < 0) return null;
    const up = [];
    let cursor = fromSlot;
    const guard = new Set();
    while (!guard.has(cursor)) {
      guard.add(cursor);
      up.push(cursor);
      if (cursor === 0) break;
      cursor = SLOT_PARENT[cursor];
    }
    const down = [];
    cursor = toSlot;
    const seen = new Set();
    while (!seen.has(cursor)) {
      seen.add(cursor);
      down.push(cursor);
      if (cursor === 0) break;
      cursor = SLOT_PARENT[cursor];
    }
    const downSet = new Set(down);
    let meet = -1;
    const prefix = [];
    up.forEach((slot) => {
      if (meet !== -1) return;
      prefix.push(slot);
      if (downSet.has(slot)) meet = slot;
    });
    if (meet < 0) return null;
    const suffix = [];
    down.some((slot) => {
      if (slot === meet) return true;
      suffix.push(slot);
      return false;
    });
    suffix.reverse();
    return prefix.concat(suffix);
  }

  function placePath(route, fromId, toId) {
    const slots = slotPath(slotOf(route, fromId), slotOf(route, toId));
    if (!slots) return [];
    return slots.map((slot) => (slot === 0 ? 0 : route[slot - 1][0]));
  }

  function edgeMinutes(fromSlot, toSlot) {
    if (parentSlot(toSlot) === fromSlot) return EDGE_MINUTES[toSlot] || 0;
    if (parentSlot(fromSlot) === toSlot) return EDGE_MINUTES[fromSlot] || 0;
    return 0;
  }

  function travelMinutes(route, from, to) {
    const slots = slotPath(slotOf(route, from), slotOf(route, to));
    if (!slots) return Infinity;
    let total = 0;
    for (let i = 1; i < slots.length; i += 1) total += edgeMinutes(slots[i - 1], slots[i]);
    return total;
  }

  function visitCost(route, from, doctorId) {
    return travelMinutes(route, from, doctorId) + VISIT_MINUTES;
  }

  function rateOf(specialtyId, drugId) {
    const row = catalog.rates[specialtyId];
    if (!row || !Object.prototype.hasOwnProperty.call(row, drugId)) return 0;
    return row[drugId];
  }

  function outcomeForRate(rate) {
    if (rate === 100) return "full";
    if (rate === 50) return "half";
    if (rate === 25) return "quarter";
    return "none";
  }

  function bestDrugIds(specialtyId) {
    let best = 0;
    DRUG_IDS.forEach((drugId) => {
      const rate = rateOf(specialtyId, drugId);
      if (rate > best) best = rate;
    });
    if (best <= 0) return [];
    return DRUG_IDS.filter((drugId) => rateOf(specialtyId, drugId) === best);
  }

  function assignRoster(doctorIds, random) {
    const rng = random || Math.random;
    const bag = [];
    while (bag.length < doctorIds.length) bag.push(...shuffle(SPEC_IDS, rng));
    const dealt = bag.slice(0, doctorIds.length);
    const roster = {};
    doctorIds.forEach((id, index) => {
      const specialty = dealt[index];
      let dislike = null;
      if (DISLIKE_DOCTORS.has(id)) {
        const protectedIds = new Set(bestDrugIds(specialty));
        const pool = DRUG_IDS.filter((drugId) => !protectedIds.has(drugId));
        const choices = pool.length ? pool : DRUG_IDS.slice();
        dislike = choices[Math.floor(rng() * choices.length)];
      }
      roster[id] = { specialty, dislike };
    });
    return stampRosterNames(roster);
  }

  function scoreVisit(doctor, drugId) {
    if (doctor.dislike && doctor.dislike === drugId) {
      return { points: 0, outcome: "dislike", rate: 0 };
    }
    const rate = rateOf(doctor.specialty, drugId);
    return {
      points: pointsAt(doctor.points, rate),
      outcome: outcomeForRate(rate),
      rate,
    };
  }

  function plural(n, one, few, many) {
    const n10 = n % 10;
    const n100 = n % 100;
    if (n10 === 1 && n100 !== 11) return one;
    if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return few;
    return many;
  }

  function formatDuration(mins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const parts = [];
    if (h) parts.push(`${h} ${plural(h, "час", "часа", "часов")}`);
    if (m || !h) parts.push(`${m} ${plural(m, "минута", "минуты", "минут")}`);
    return parts.join(" ");
  }

  function formatClock(minutesUsed) {
    const total = DAY_START + minutesUsed;
    const h = Math.floor(total / 60) % 24;
    const m = total % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  function formatScore(n) {
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  }

  function totalPoints() {
    return routePoints() * DOCTORS_PER_CLINIC;
  }

  function grade(score) {
    if (score >= 250) {
      return {
        title: "Сильный день",
        text: "Дальняя часть дороги собрана плотно, препараты почти без потерь.",
      };
    }
    if (score >= 150) {
      return {
        title: "Рабочий день",
        text: "База хорошая. Имеет смысл разобрать визиты, где баллы срезались.",
      };
    }
    if (score >= 80) {
      return {
        title: "Черновик маршрута",
        text: "Дальние врачи дают больше баллов, но только если дорога до них помещается в день.",
      };
    }
    return {
      title: "Разминка",
      text: "Сверяйте препарат со специальностью и не прыгайте через всю дорогу без нужды.",
    };
  }

  function selfCheck() {
    const errors = [];
    if (DOCTORS.length !== 30) errors.push("expected 30 doctors");
    if (new Set(DOCTORS.map((doctor) => doctor.id)).size !== 30) errors.push("ids");
    if (new Set(DOCTORS.map((doctor) => doctor.name)).size !== 30) errors.push("names");
    if (DRUGS.length !== 4) errors.push("expected 4 drugs");
    if (SLOT_PARENT.length !== ROAD_STOPS + 1) errors.push("parents");
    if (DEPTH_POINTS.length !== TRUNK_STOPS + 1) errors.push("depth points");
    DEPTH_POINTS.forEach((points, depth) => {
      if (points % 2 !== 0) errors.push(`odd points depth ${depth}`);
    });

    const trunk = new Set();
    let walk = TRUNK_STOPS;
    while (walk) {
      trunk.add(walk);
      walk = parentSlot(walk);
    }
    if (trunk.size !== TRUNK_STOPS) errors.push("trunk");
    let branches = 0;
    let farthest = 0;
    for (let slot = 1; slot <= ROAD_STOPS; slot += 1) {
      const depth = depthOfSlot(slot);
      if (depth > farthest) farthest = depth;
      if (!trunk.has(slot)) branches += 1;
      if (pointsForSlot(slot) !== DEPTH_POINTS[depth]) errors.push(`points ${slot}`);
    }
    if (farthest !== TRUNK_STOPS) errors.push("farthest depth");
    if (branches !== 0) errors.push("branches");

    const route = [];
    for (let slot = 1; slot <= ROAD_STOPS; slot += 1) {
      const start = (slot - 1) * DOCTORS_PER_CLINIC;
      route.push(DOCTORS.slice(start, start + DOCTORS_PER_CLINIC).map((doctor) => doctor.id));
    }
    const at = (slot) => route[slot - 1][0];
    if (travelMinutes(route, 0, at(1)) !== 20) errors.push("nearest segment");
    if (travelMinutes(route, at(1), at(2)) !== 20) errors.push("between doctors");
    if (travelMinutes(route, at(3), at(4)) !== 30) errors.push("later segment");
    if (travelMinutes(route, 0, at(TRUNK_STOPS)) !== 120) errors.push("farthest");
    if (placePath(route, 0, at(TRUNK_STOPS)).length !== TRUNK_STOPS + 1) errors.push("trunk path");

    if (CLINIC_NAMES.length < ROAD_STOPS) errors.push("clinic names");
    if (new Set(CLINIC_NAMES).size !== CLINIC_NAMES.length) errors.push("clinic names unique");
    const named = pickClinicNames(() => 0);
    if (named.length !== ROAD_STOPS) errors.push("clinic name count");
    if (new Set(named).size !== ROAD_STOPS) errors.push("clinic name draw");
    if (named.some((name) => !CLINIC_NAMES.includes(name))) errors.push("clinic name pool");

    const picked = pickRoute(() => 0);
    const pickedIds = picked.flat();
    if (picked.length !== ROAD_STOPS) errors.push("pick route clinics");
    if (picked.some((group) => !Array.isArray(group) || group.length !== DOCTORS_PER_CLINIC)) errors.push("pick route size");
    if (new Set(pickedIds).size !== ROAD_STOPS * DOCTORS_PER_CLINIC) errors.push("pick route unique");

    const nearest = { ...doctorById(1), points: pointsForSlot(1) };
    if (scoreVisit(nearest, "teralin").outcome !== "full") errors.push("match");
    if (scoreVisit(nearest, "regenox").points !== pointsForSlot(1) / 2) errors.push("half");

    const surgeon = { ...doctorById(2), points: 16 };
    if (scoreVisit(surgeon, "teralin").outcome !== "dislike") errors.push("dislike");
    if (scoreVisit(surgeon, "teralin").points !== 0) errors.push("dislike points");
    if (scoreVisit(surgeon, "regenox").points !== 16) errors.push("surgeon match");
    if (scoreVisit(surgeon, "femorin").points !== 8) errors.push("surgeon half");

    if (pointsAt(80, 25) !== 20) errors.push("quarter");
    if (pointsAt(20, 0) !== 0) errors.push("zero rate");
    if (pointsAt(100, 100) !== 100) errors.push("full rate");
    const seeded = assignRoster([1, 2, 3, 4, 5], () => 0);
    if (seeded[1].specialty !== "gynecologist" || seeded[1].dislike !== null) errors.push("roster open");
    if (seeded[2].specialty !== "neurologist" || seeded[2].dislike !== "teralin") errors.push("roster dislike");
    if (seeded[1].name !== "Узика Скринингова") errors.push("roster gyn name");
    if (!NAME_POOLS.neurologist.m.includes(seeded[2].name)) errors.push("roster neuro name");
    if (Object.keys(assignRoster([1, 2, 3], () => 0.5)).length !== 3) errors.push("roster size");

    const pinned = {};
    DOCTORS.forEach((doctor) => {
      pinned[doctor.id] = { specialty: doctor.specialty };
    });
    stampRosterNames(pinned);
    DOCTORS.forEach((doctor) => {
      if (pinned[doctor.id].name !== doctor.name) errors.push(`pinned name ${doctor.id}`);
    });
    const poolNames = [];
    Object.keys(NAME_POOLS).forEach((key) => {
      poolNames.push(...NAME_POOLS[key].f, ...NAME_POOLS[key].m);
    });
    if (new Set(poolNames).size !== poolNames.length) errors.push("pool names");
    Object.keys(NAME_POOLS).forEach((key) => {
      NAME_POOLS[key].f.forEach((name) => {
        if (!nameIsFemale(name)) errors.push(`female pool ${name}`);
      });
      NAME_POOLS[key].m.forEach((name) => {
        if (nameIsFemale(name)) errors.push(`male pool ${name}`);
      });
    });
    if (NAME_POOLS.general.f.length < 13 || NAME_POOLS.general.m.length < 15) errors.push("general pool");
    const nameRoot = (word) => word.toLowerCase().replace(/ё/g, "е").replace(/(ова|ева|ина|ая|ов|ев|ин)$/g, "");
    const femaleRoots = NAME_POOLS.general.f.flatMap((name) => name.split(" ").map(nameRoot));
    const maleRoots = new Set(NAME_POOLS.general.m.flatMap((name) => name.split(" ").map(nameRoot)));
    femaleRoots.forEach((root) => {
      if (root && maleRoots.has(root)) errors.push(`general overlap ${root}`);
    });
    ["therapist", "gynecologist", "neurologist", "surgeon"].forEach((key) => {
      if (NAME_POOLS[key].f.length < 4 || NAME_POOLS[key].m.length < 4) errors.push(`pool ${key}`);
    });

    const dayRoster = assignRoster(pickedIds, () => 0);
    const dayNames = pickedIds.map((id) => dayRoster[id].name);
    if (dayNames.some((name) => !name) || new Set(dayNames).size !== dayNames.length) errors.push("day names");
    pickedIds.forEach((id) => {
      const doctor = doctorById(id);
      const spec = specialtyOf(dayRoster[id].specialty);
      const pool = NAME_POOLS[specialtyNameKey(spec.label)][doctor.female ? "f" : "m"];
      if (!pool.includes(dayRoster[id].name)) errors.push(`day name ${id}`);
    });

    const aliasCatalog = defaultCatalog();
    aliasCatalog.specialties[0].label = "Врач общей практики";
    aliasCatalog.specialties[1].label = "ВОП";
    aliasCatalog.specialties[2].label = "Председатель ЖЭКа";
    if (!applyCatalog(aliasCatalog)) errors.push("alias catalog");
    const alias = {};
    DOCTORS.forEach((doctor) => {
      alias[doctor.id] = { specialty: doctor.specialty };
    });
    stampRosterNames(alias);
    const aliasNames = DOCTORS.map((doctor) => alias[doctor.id].name);
    if (aliasNames.some((name) => !name) || new Set(aliasNames).size !== aliasNames.length) errors.push("alias names");
    if (alias[1].name !== "Капелька Пульсова") errors.push("alias therapist");
    DOCTORS.filter((doctor) => doctor.specialty === "neurologist").forEach((doctor) => {
      const pool = NAME_POOLS.general[doctor.female ? "f" : "m"];
      if (!pool.includes(alias[doctor.id].name)) errors.push(`general name ${doctor.id}`);
    });
    DOCTORS.filter((doctor) => doctor.specialty === "surgeon").forEach((doctor) => {
      if (alias[doctor.id].name !== doctor.name) errors.push(`alias surgeon ${doctor.id}`);
    });
    if (!applyCatalog(defaultCatalog())) errors.push("restore catalog");

    DOCTORS.forEach((doctor) => {
      if (!SPECIALTIES[doctor.specialty]) errors.push(`specialty ${doctor.id}`);
      if (doctor.dislike && !drugById(doctor.dislike)) errors.push(`dislike drug ${doctor.id}`);
      if (doctor.dislike && rateOf(doctor.specialty, doctor.dislike) === 100) {
        errors.push(`dislike overlaps specialty for ${doctor.id}`);
      }
    });

    let chained = 0;
    let cursor = 0;
    for (let slot = 1; slot <= TRUNK_STOPS; slot += 1) {
      chained += travelMinutes(route, cursor, at(slot));
      cursor = at(slot);
    }
    if (chained !== 120) errors.push(`chained travel ${chained}`);
    const trunkDay = chained + VISIT_MINUTES * TRUNK_STOPS;
    if (trunkDay > DAY_MINUTES) errors.push("ordered day does not fit");
    if (trunkDay !== 270) errors.push(`ordered day ${trunkDay}`);
    const everyDoctor = chained + VISIT_MINUTES * ROAD_STOPS * DOCTORS_PER_CLINIC;
    if (everyDoctor <= DAY_MINUTES) errors.push("every doctor fits");

    if (HOBBIES.length < 12) errors.push("hobbies");
    if (new Set(HOBBIES.map((hobby) => hobby.id)).size !== HOBBIES.length) errors.push("hobby ids");
    if (new Set(HOBBIES.map((hobby) => hobby.label)).size !== HOBBIES.length) errors.push("hobby labels");
    HOBBIES.forEach((hobby) => {
      const spoken = hobby.id === "pool" || hobby.id === "knit" || hobby.id === "tennis" || hobby.id === "skate";
      if (!hobby.line.trim()) errors.push(`hobby line ${hobby.id}`);
      if (!spoken && !hobby.line.startsWith(hobby.label)) errors.push(`hobby line ${hobby.id}`);
    });
    const interestIds = DOCTORS.map((doctor) => doctor.id);
    const drawn = pickDoctorInterests(interestIds, () => 0.3);
    interestIds.forEach((id) => {
      const list = drawn[id];
      if (!list || list.length !== 3 || new Set(list).size !== 3) errors.push(`interests ${id}`);
      if (list && list.some((hobbyId) => !hobbyById(hobbyId))) errors.push(`interest pool ${id}`);
    });
    const sample = drawn[1];
    const options = rapportOptions(sample, () => 0.2);
    if (options.length !== 4 || new Set(options).size !== 4) errors.push("rapport size");
    const hits = options.filter((id) => sample.includes(id));
    if (hits.length !== 1) errors.push("rapport hit");
    if (applyRapport(100, "hit") !== 200) errors.push("rapport double");
    if (applyRapport(50, "hit") !== 100) errors.push("rapport double half");
    if (applyRapport(100, "miss") !== 50) errors.push("rapport miss");
    if (applyRapport(50, "miss") !== 25) errors.push("rapport miss again");
    if (applyRapport(0, "hit") !== 0 || applyRapport(0, "miss") !== 0) errors.push("rapport zero");
    if (applyRapport(100, null) !== 100) errors.push("rapport skip");
    const claimed = defaultCatalog();
    claimed.claims.teralin = ["Верно про Тералин", "Ещё одно верное", "Верно про Тералин"];
    claimed.wrongClaims = ["Мимо один", "Мимо два", "Мимо три", "Мимо четыре", "  ", "Мимо два"];
    const storedClaims = normalizeCatalog(claimed);
    if (!storedClaims || storedClaims.claims.teralin.length !== 2) errors.push("claim unique");
    if (!storedClaims || storedClaims.wrongClaims.length !== 4) errors.push("wrong unique");
    const legacy = defaultCatalog();
    delete legacy.claims;
    delete legacy.wrongClaims;
    const legacyStored = normalizeCatalog(legacy);
    if (!legacyStored || legacyStored.claims.femorin.length !== 0 || legacyStored.wrongClaims.length !== 0) {
      errors.push("legacy claims");
    }
    if (!applyCatalog(claimed)) errors.push("claims catalog");
    const round = claimRound("teralin", () => 0);
    if (!round || round.options.length !== 4 || new Set(round.options).size !== 4) errors.push("claim round");
    if (!round || round.options[round.correct] !== "Верно про Тералин") errors.push("claim hit");
    if (round && round.options.filter((text) => text.startsWith("Мимо")).length !== 3) errors.push("claim decoys");
    if (claimRound("femorin", () => 0)) errors.push("claim empty");
    if (finishVisit(0, "hit", "hit") !== 0) errors.push("zero stays zero");
    if (finishVisit(80, null, null) !== 80) errors.push("plain visit");
    if (finishVisit(80, "hit", null) !== 160) errors.push("rapport only");
    if (finishVisit(80, null, "hit") !== 160) errors.push("claim only");
    if (finishVisit(80, "miss", null) !== 40) errors.push("rapport miss only");
    if (finishVisit(80, null, "miss") !== 80) errors.push("claim miss only");
    if (finishVisit(80, "hit", "hit") !== 320) errors.push("both double");
    if (finishVisit(80, "miss", "miss") !== 40) errors.push("claim miss keeps rapport half");
    if (finishVisit(80, "hit", "miss") !== 160) errors.push("claim miss keeps rapport double");
    if (finishVisit(80, "miss", "hit") !== 80) errors.push("miss then hit");
    if (finishVisit(13, "miss", "miss") !== 7) errors.push("round once");
    if (finishVisit(scoreVisit(surgeon, "teralin").points, "hit", "hit") !== 0) errors.push("dislike ignores factors");
    if (!applyCatalog(defaultCatalog())) errors.push("restore after claims");
    if (WARM_REPLIES.length < 12 || COLD_REPLIES.length < 12) errors.push("reactions");
    [WARM_REPLIES, COLD_REPLIES].forEach((pool) => {
      pool.forEach((line) => {
        if (!line.m || !line.f || line.m === line.f) errors.push("reaction pair");
        if (!reactionAgrees(line.m, false) || !reactionAgrees(line.f, true)) errors.push(`reaction gender ${line.m}`);
      });
    });
    if (new Set(WARM_REPLIES.map((line) => line.m)).size !== WARM_REPLIES.length) errors.push("warm unique");
    if (new Set(COLD_REPLIES.map((line) => line.f)).size !== COLD_REPLIES.length) errors.push("cold unique");
    if (doctorReaction(true, false, () => 0) !== WARM_REPLIES[0].m) errors.push("warm male");
    if (doctorReaction(true, true, () => 0) !== WARM_REPLIES[0].f) errors.push("warm female");
    if (doctorReaction(false, false, () => 0) !== COLD_REPLIES[0].m) errors.push("cold male");
    if (doctorReaction(false, true, () => 0) !== COLD_REPLIES[0].f) errors.push("cold female");
    if (doctorReaction(true, false, () => 0, WARM_REPLIES[0].m) !== WARM_REPLIES[1].m) errors.push("warm next");
    if (doctorReaction(false, true, () => 0, COLD_REPLIES[0].f) !== COLD_REPLIES[1].f) errors.push("cold next");
    if (doctorById(17).female !== true || doctorById(2).female !== false) errors.push("doctor gender");
    const women = DOCTORS.filter((doctor) => doctor.female).length;
    const men = DOCTORS.filter((doctor) => doctor.female === false).length;
    if (women + men !== 30) errors.push("gender flags");

    return errors;
  }

  return {
    ROAD_STOPS,
    DOCTORS_PER_CLINIC,
    TRUNK_STOPS,
    VISIT_MINUTES,
    INTEREST_MINUTES,
    DAY_MINUTES,
    DAY_START,
    DRUGS,
    DOCTORS,
    SPECIALTIES,
    SCORE_RATES,
    doctorById,
    drugById,
    specialtyOf,
    defaultCatalog,
    normalizeCatalog,
    applyCatalog,
    currentCatalog,
    usedRates,
    pointsAt,
    assignRoster,
    stampRosterNames,
    generalNames,
    rateOf,
    CLINIC_NAMES,
    HOBBIES,
    hobbyById,
    pickDoctorInterests,
    rapportOptions,
    applyRapport,
    claimsFor,
    wrongClaimPool,
    claimRound,
    finishVisit,
    doctorReaction,
    reactionAgrees,
    pickClinicNames,
    pickRoute,
    pointsForSlot,
    slotOf,
    parentSlot,
    isTrunk,
    depthOfSlot,
    placePath,
    travelMinutes,
    visitCost,
    scoreVisit,
    plural,
    formatDuration,
    formatClock,
    formatScore,
    totalPoints,
    grade,
    selfCheck,
  };
});
