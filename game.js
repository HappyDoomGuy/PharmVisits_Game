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
  const DAY_MINUTES = 8 * 60;
  const DAY_START = 9 * 60;
  // Parent stop of each slot. 0 is home. The row is a single chain.
  const SLOT_PARENT = [0, 0, 1, 2, 3, 4];
  const DEPTH_POINTS = [0, 20, 40, 60, 80, 100];
  // Minutes on the edge from the parent to this slot.
  const EDGE_MINUTES = [0, 20, 20, 20, 30, 30];

  const DRUGS = [
    { id: "teralin", name: "Тералин", specialty: "therapist", audience: "терапевтов" },
    { id: "femorin", name: "Феморин", specialty: "gynecologist", audience: "гинекологов" },
    { id: "nevral", name: "Невролекс", specialty: "neurologist", audience: "неврологов" },
    { id: "regenox", name: "Регенокс", specialty: "surgeon", audience: "хирургов" },
  ];

  const SPECIALTIES = {
    therapist: { label: "Терапевт", mark: "Т", color: "#0f766e" },
    gynecologist: { label: "Гинеколог", mark: "Г", color: "#be3a6a" },
    neurologist: { label: "Невролог", mark: "Н", color: "#3451a3" },
    surgeon: { label: "Хирург", mark: "Х", color: "#d06a1f" },
  };

  const DOCTORS = [
    { id: 1, name: "Капелька Пульсова", specialty: "therapist", dislike: null },
    { id: 2, name: "Скальпель Швов", specialty: "surgeon", dislike: "teralin" },
    { id: 3, name: "Узика Скринингова", specialty: "gynecologist", dislike: null },
    { id: 4, name: "Рефлекс Синапсов", specialty: "neurologist", dislike: "regenox" },
    { id: 5, name: "Микстура Градусникова", specialty: "therapist", dislike: "nevral" },
    { id: 6, name: "Наркоз Разрезов", specialty: "surgeon", dislike: null },
    { id: 7, name: "Фолликула Циклова", specialty: "gynecologist", dislike: "teralin" },
    { id: 8, name: "Мигрень Нервова", specialty: "neurologist", dislike: "femorin" },
    { id: 9, name: "Таблетка Давленцева", specialty: "therapist", dislike: null },
    { id: 10, name: "Шов Зашивин", specialty: "surgeon", dislike: "nevral" },
    { id: 11, name: "Бинтик Перевязов", specialty: "surgeon", dislike: "teralin" },
    { id: 12, name: "Зеркальце Осмотрова", specialty: "gynecologist", dislike: null },
    { id: 13, name: "Бессонница Дремова", specialty: "neurologist", dislike: "regenox" },
    { id: 14, name: "Сиропчик Отхаркин", specialty: "therapist", dislike: "femorin" },
    { id: 15, name: "Зажим Сосудистов", specialty: "surgeon", dislike: null },
    { id: 16, name: "Цикл Календарёв", specialty: "gynecologist", dislike: "nevral" },
    { id: 17, name: "Вертиго Кружилина", specialty: "neurologist", dislike: null },
    { id: 18, name: "Градусник Температуров", specialty: "therapist", dislike: "regenox" },
    { id: 19, name: "Йод Антисептиков", specialty: "surgeon", dislike: "femorin" },
    { id: 20, name: "Гормон Балансов", specialty: "gynecologist", dislike: null },
    { id: 21, name: "Память Вспоминаева", specialty: "neurologist", dislike: "teralin" },
    { id: 22, name: "Рецепт Выписанов", specialty: "therapist", dislike: null },
    { id: 23, name: "Пластырь Царапкин", specialty: "surgeon", dislike: "nevral" },
    { id: 24, name: "Кольпоскоп Смотров", specialty: "gynecologist", dislike: "regenox" },
    { id: 25, name: "Тремор Дрожжин", specialty: "neurologist", dislike: null },
    { id: 26, name: "Капсула Оболочкова", specialty: "therapist", dislike: "femorin" },
    { id: 27, name: "Нитка Кетгутова", specialty: "surgeon", dislike: null },
    { id: 28, name: "Овуляция Фазова", specialty: "gynecologist", dislike: "teralin" },
    { id: 29, name: "Импульс Проводимов", specialty: "neurologist", dislike: "regenox" },
    { id: 30, name: "Витамин Иммунов", specialty: "therapist", dislike: null },
  ];

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
    "Женская консультация «Вам на сколько?»",
    "Поликлиника «Весёлый главврач»",
    "Травмпункт «Что ж вы так?»",
    "Поликлиника «Рецепт на удачу»",
  ];

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

  function scoreVisit(doctor, drugId) {
    if (doctor.dislike && doctor.dislike === drugId) {
      return { points: 0, outcome: "dislike" };
    }
    const drug = drugById(drugId);
    if (drug && drug.specialty === doctor.specialty) {
      return { points: doctor.points, outcome: "full" };
    }
    return { points: doctor.points / 2, outcome: "half" };
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

    DOCTORS.forEach((doctor) => {
      if (!SPECIALTIES[doctor.specialty]) errors.push(`specialty ${doctor.id}`);
      if (doctor.dislike && drugById(doctor.dislike).specialty === doctor.specialty) {
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

    return errors;
  }

  return {
    ROAD_STOPS,
    DOCTORS_PER_CLINIC,
    TRUNK_STOPS,
    VISIT_MINUTES,
    DAY_MINUTES,
    DAY_START,
    DRUGS,
    DOCTORS,
    SPECIALTIES,
    doctorById,
    drugById,
    specialtyOf,
    CLINIC_NAMES,
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
