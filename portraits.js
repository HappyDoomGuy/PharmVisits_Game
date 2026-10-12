(function (root) {
  function eyes(color, y, skin) {
    const lid = (cx) => `<ellipse class="face-lid" cx="${cx}" cy="${y}" rx="3.8" ry="2.7" fill="${skin}"/>`;
    return `<ellipse cx="31" cy="${y}" rx="3.4" ry="2.3" fill="#fff"/>
      <ellipse cx="49" cy="${y}" rx="3.4" ry="2.3" fill="#fff"/>
      <g class="face-look">
        <circle cx="31.7" cy="${y + 0.2}" r="1.55" fill="${color}"/>
        <circle cx="49.7" cy="${y + 0.2}" r="1.55" fill="${color}"/>
        <circle cx="32.3" cy="${y - 0.2}" r="0.45" fill="#fff"/>
        <circle cx="50.3" cy="${y - 0.2}" r="0.45" fill="#fff"/>
      </g>
      ${lid(31)}${lid(49)}`;
  }

  function brows(color, y, thick) {
    const h = thick ? 2.2 : 1.4;
    return `<g class="face-brow">
      <path d="M25 ${y + 2} Q31 ${y - 3} 37 ${y + 1}" fill="none" stroke="${color}" stroke-width="${h}" stroke-linecap="round"/>
      <path d="M43 ${y + 1} Q49 ${y - 3} 55 ${y + 2}" fill="none" stroke="${color}" stroke-width="${h}" stroke-linecap="round"/>
    </g>`;
  }

  function smile(y) {
    return `<path d="M33 ${y} Q40 ${y + 3.5} 47 ${y}" fill="none" stroke="#a85b62" stroke-width="1.5" stroke-linecap="round"/>`;
  }

  function glasses(kind) {
    if (kind === "rect") {
      return `<g fill="none" stroke="#243042" stroke-width="1.5">
        <rect x="24" y="37.5" width="15" height="10" rx="2"/>
        <rect x="41" y="37.5" width="15" height="10" rx="2"/>
        <path d="M39 42.5 H41 M24 42 H19 M56 42 H61" stroke-linecap="round"/>
      </g>`;
    }
    if (kind === "round") {
      return `<g fill="none" stroke="#243042" stroke-width="1.5">
        <circle cx="31.5" cy="42.5" r="6.2"/>
        <circle cx="48.5" cy="42.5" r="6.2"/>
        <path d="M37.6 42.5 H42.4 M25.3 41 H19 M54.7 41 H61" stroke-linecap="round"/>
      </g>`;
    }
    return "";
  }

  function portrait(p) {
    return `<svg class="portrait" viewBox="0 0 80 100" aria-hidden="true">
      <rect width="80" height="100" rx="18" fill="${p.bg}"/>
      ${p.back || ""}
      <path d="M8 100 V74 C8 64 20 62 30 66 L40 78 L50 66 C60 62 72 64 72 74 V100 Z" fill="#fbf8f3"/>
      <path d="M36 67 h8 l1.5 33 h-11 z" fill="${p.collar}"/>
      <rect x="33" y="58" width="14" height="16" rx="6" fill="${p.skin}"/>
      ${p.ears === false ? "" : `<ellipse cx="19" cy="44" rx="3.6" ry="5.5" fill="${p.skin}"/><ellipse cx="61" cy="44" rx="3.6" ry="5.5" fill="${p.skin}"/>`}
      <ellipse cx="40" cy="40" rx="18" ry="22" fill="${p.skin}"/>
      ${p.front || ""}
      <ellipse cx="29" cy="50" rx="4" ry="2.2" fill="${p.blush}" opacity="0.35"/>
      <ellipse cx="51" cy="50" rx="4" ry="2.2" fill="${p.blush}" opacity="0.35"/>
      ${brows(p.brow, p.browY, p.thick)}
      ${eyes(p.eye, p.eyeY, p.skin)}
      <path d="M40 44 q2.2 5.5 0 8" fill="none" stroke="${p.nose}" stroke-width="1.3" stroke-linecap="round"/>
      ${p.beard || ""}
      ${smile(p.mouth)}
      ${glasses(p.glasses)}
    </svg>`;
  }

  const people = {
    1: portrait({
      bg: "#d5ebe3",
      skin: "#f3c7a6",
      collar: "#0f766e",
      blush: "#e0897a",
      brow: "#3a2418",
      browY: 34,
      thick: false,
      eye: "#3d4f3a",
      eyeY: 42,
      nose: "#d9a888",
      mouth: 55,
      open: true,
      back: `<path d="M20 38 C16 54 22 70 28 74 L31 58 C26 50 24 44 26 38 Z" fill="#3a2418"/>
        <path d="M60 38 C64 54 58 70 52 74 L49 58 C54 50 56 44 54 38 Z" fill="#3a2418"/>`,
      front: `<path d="M22 34 C22 14 30 8 40 8 C52 8 60 16 60 36 C55 22 48 18 40 18 C31 18 25 24 22 34 Z" fill="#3a2418"/>
        <path d="M26 30 Q40 38 54 30 Q48 24 40 24 Q32 24 26 30 Z" fill="#2c1810"/>`,
    }),
    2: portrait({
      bg: "#f6e2d4",
      skin: "#e8b892",
      collar: "#d06a1f",
      blush: "#d9846a",
      brow: "#1a1a1a",
      browY: 33,
      thick: true,
      eye: "#2c3a4a",
      eyeY: 42,
      nose: "#c99678",
      mouth: 56,
      open: false,
      beard: `<path d="M27 54 C29 66 51 66 53 54 C48 60 32 60 27 54 Z" fill="#1a1a1a" opacity="0.55"/>`,
      front: `<path d="M23 32 C23 14 31 8 40 8 C51 8 59 16 59 33 C54 22 47 18 40 18 C32 18 26 24 23 32 Z" fill="#1a1a1a"/>`,
    }),
    3: portrait({
      bg: "#f8dce8",
      skin: "#f6d0b4",
      collar: "#be3a6a",
      blush: "#e48b9a",
      brow: "#1c120e",
      browY: 34,
      thick: false,
      eye: "#4a3428",
      eyeY: 42,
      nose: "#e0b498",
      mouth: 55,
      open: true,
      ears: false,
      back: `<path d="M16 46 C12 70 18 98 30 100 L34 74 C26 64 22 54 24 44 Z" fill="#1c120e"/>
        <path d="M64 46 C68 70 62 98 50 100 L46 74 C54 64 58 54 56 44 Z" fill="#1c120e"/>`,
      front: `<path d="M24 32 C24 12 32 6 40 6 C50 6 58 14 58 34 C52 20 46 16 40 16 C32 16 26 22 24 32 Z" fill="#1c120e"/>
        <path d="M30 22 Q40 30 50 22" fill="none" stroke="#3a241c" stroke-width="1.2"/>`,
    }),
    4: portrait({
      bg: "#dce4f6",
      skin: "#d9a27c",
      collar: "#3451a3",
      blush: "#c9846e",
      brow: "#5c5854",
      browY: 33,
      thick: true,
      eye: "#2a3344",
      eyeY: 42,
      nose: "#c48e6c",
      mouth: 56,
      open: false,
      glasses: "rect",
      front: `<path d="M24 30 C24 14 32 9 40 9 C50 9 58 16 58 32 C52 22 46 18 40 18 C33 18 27 22 24 30 Z" fill="#8a8682"/>`,
    }),
    5: portrait({
      bg: "#e7f0dc",
      skin: "#f7d7b8",
      collar: "#0f766e",
      blush: "#e7a08a",
      brow: "#a07840",
      browY: 34,
      thick: false,
      eye: "#3e6a48",
      eyeY: 42,
      nose: "#e2b898",
      mouth: 55,
      open: true,
      back: `<path d="M18 42 C14 62 22 82 30 86 L33 64 C26 56 24 48 26 40 Z" fill="#d4b06a"/>
        <path d="M62 42 C66 62 58 82 50 86 L47 64 C54 56 56 48 54 40 Z" fill="#d4b06a"/>`,
      front: `<path d="M22 34 C20 14 30 7 40 7 C52 7 62 16 60 36 C56 22 48 16 40 16 C30 16 24 24 22 34 Z" fill="#e2c27a"/>
        <path d="M26 28 C34 36 48 34 56 26 C50 20 44 18 40 20 C34 18 28 22 26 28 Z" fill="#c9a45a"/>`,
    }),
    6: portrait({
      bg: "#f3ddc8",
      skin: "#c98b62",
      collar: "#d06a1f",
      blush: "#b86a52",
      brow: "#241811",
      browY: 33,
      thick: true,
      eye: "#2a2420",
      eyeY: 42,
      nose: "#b67a58",
      mouth: 55,
      open: false,
      beard: `<path d="M28 51 C30 67 50 67 52 51 C48 61 32 61 28 51 Z" fill="#241811"/>
        <path d="M33 52 Q40 57 47 52 Q40 55 33 52 Z" fill="#1a120e"/>`,
      front: `<path d="M22 31 C22 13 31 7 40 7 C51 7 60 15 60 32 C54 20 47 16 40 16 C31 16 25 22 22 31 Z" fill="#241811"/>`,
    }),
    7: portrait({
      bg: "#f6d6e6",
      skin: "#f0c8a8",
      collar: "#be3a6a",
      blush: "#e09098",
      brow: "#8d8884",
      browY: 35,
      thick: false,
      eye: "#3a4558",
      eyeY: 43,
      nose: "#d9a888",
      mouth: 57,
      open: false,
      glasses: "rect",
      back: `<circle cx="58" cy="24" r="10" fill="#c8c4be"/>
        <circle cx="58" cy="24" r="6" fill="#b0aaa4"/>`,
      front: `<path d="M24 34 C24 16 32 10 40 10 C50 10 58 18 56 34 C50 22 46 18 40 18 C32 18 26 24 24 34 Z" fill="#c8c4be"/>`,
    }),
    8: portrait({
      bg: "#dde6f8",
      skin: "#e7b48a",
      collar: "#3451a3",
      blush: "#d4846c",
      brow: "#2a1c14",
      browY: 34,
      thick: false,
      eye: "#243044",
      eyeY: 42,
      nose: "#c99674",
      mouth: 55,
      open: true,
      ears: false,
      glasses: "round",
      back: `<path d="M16 44 C12 68 18 98 30 100 L34 74 C26 64 22 54 24 42 Z" fill="#2a1c14"/>
        <path d="M64 44 C68 68 62 98 50 100 L46 74 C54 64 58 54 56 42 Z" fill="#2a1c14"/>`,
      front: `<path d="M22 34 C20 14 30 8 40 8 C52 8 62 16 60 36 C56 22 48 16 40 16 C30 16 24 24 22 34 Z" fill="#2a1c14"/>
        <circle cx="24" cy="28" r="5" fill="#3a281c"/>
        <circle cx="56" cy="26" r="5.5" fill="#3a281c"/>
        <circle cx="32" cy="16" r="4" fill="#3a281c"/>
        <circle cx="48" cy="14" r="4.5" fill="#3a281c"/>`,
    }),
    9: portrait({
      bg: "#e4efe8",
      skin: "#f4cbb0",
      collar: "#0f766e",
      blush: "#e08a78",
      brow: "#6b2e2a",
      browY: 34,
      thick: false,
      eye: "#5a4030",
      eyeY: 42,
      nose: "#e0b090",
      mouth: 55,
      open: true,
      front: `<path d="M23 33 C22 14 31 8 40 8 C51 8 60 16 59 35 C54 22 47 17 40 17 C32 17 26 23 23 33 Z" fill="#8a3a34"/>
        <path d="M24 36 C22 48 26 58 30 60 C30 48 28 40 26 34 Z" fill="#8a3a34"/>
        <path d="M56 36 C58 48 54 58 50 60 C50 48 52 40 54 34 Z" fill="#8a3a34"/>`,
    }),
    10: portrait({
      bg: "#efe0cf",
      skin: "#c9845c",
      collar: "#d06a1f",
      blush: "#b86e52",
      brow: "#6e6a66",
      browY: 33,
      thick: true,
      eye: "#2c2824",
      eyeY: 42,
      nose: "#b47858",
      mouth: 56,
      open: false,
      beard: `<path d="M33 51 Q40 56 47 51 Q43 54 40 54 Q37 54 33 51 Z" fill="#9a9692"/>`,
      front: `<path d="M26 28 C28 16 34 12 40 12 C48 12 56 18 56 30 C50 22 44 20 40 22 C34 20 28 22 26 28 Z" fill="#9a9692"/>`,
    }),
  };

  const FEMALE = new Set([12, 13, 17, 21, 26, 27, 28]);

  function generatedPortrait(id) {
    const female = FEMALE.has(id);
    const skins = ["#f3c7a6", "#e8b892", "#f6d0b4", "#d9a27c", "#f7d7b8", "#c98b62", "#f0c8a8", "#e7b48a", "#f4cbb0", "#e0b090", "#c9845c", "#f8d4bc"];
    const hairs = ["#3a2418", "#1a1a1a", "#5c4030", "#8a8682", "#c9a45a", "#241811", "#6b2e2a", "#2a1c14", "#4a3428", "#1c120e", "#d4b06a", "#3d2b22"];
    const eyesC = ["#3d4f3a", "#2c3a4a", "#4a3428", "#2a3344", "#3e6a48", "#243044", "#5a4030", "#2c2824", "#1e3a5f", "#4a3030"];
    const bgs = ["#d5ebe3", "#f6e2d4", "#f8dce8", "#dce4f6", "#e7f0dc", "#f3ddc8", "#f6d6e6", "#dde6f8", "#e4efe8", "#efe0cf", "#e7eef8", "#f8ead8"];
    const collars = ["#0f766e", "#d06a1f", "#be3a6a", "#3451a3"];
    const n = id * 17 + 3;
    const hair = hairs[(n >> 2) % hairs.length];
    const hairStyle = female ? 2 : 3;
    let front = "";
    let back = "";
    let ears = true;
    if (hairStyle === 0) {
      front = `<path d="M22 34 C22 14 30 8 40 8 C52 8 60 16 60 36 C55 22 48 18 40 18 C31 18 25 24 22 34 Z" fill="${hair}"/>`;
    } else if (hairStyle === 1) {
      front = `<path d="M24 32 C24 14 32 8 40 8 C50 8 58 16 58 33 C52 20 46 16 40 16 C32 16 26 22 24 32 Z" fill="${hair}"/>`;
      back = `<path d="M18 40 C14 62 22 78 30 82 L33 62 C26 54 24 46 26 38 Z" fill="${hair}"/>
        <path d="M62 40 C66 62 58 78 50 82 L47 62 C54 54 56 46 54 38 Z" fill="${hair}"/>`;
    } else if (hairStyle === 2) {
      ears = false;
      front = `<path d="M23 33 C22 14 31 8 40 8 C51 8 60 16 59 35 C54 22 47 17 40 17 C32 17 26 23 23 33 Z" fill="${hair}"/>`;
      back = `<path d="M16 46 C12 70 18 98 30 100 L34 74 C26 64 22 54 24 44 Z" fill="${hair}"/>
        <path d="M64 46 C68 70 62 98 50 100 L46 74 C54 64 58 54 56 44 Z" fill="${hair}"/>`;
    } else {
      front = `<path d="M26 30 C28 16 34 11 40 11 C48 11 56 18 56 32 C50 22 44 18 40 20 C34 18 28 22 26 30 Z" fill="${hair}"/>`;
    }
    const glassesKind = ["", "rect", "round", ""][n % 4];
    const beard = female
      ? ""
      : `<path d="M28 54 C30 66 50 66 52 54 C47 60 33 60 28 54 Z" fill="${hair}" opacity="0.55"/>`;
    return portrait({
      bg: bgs[(n >> 1) % bgs.length],
      skin: skins[n % skins.length],
      collar: collars[id % collars.length],
      blush: "#e0897a",
      brow: hair,
      browY: 33 + (n % 3),
      thick: !female && id % 2 === 0,
      eye: eyesC[(n >> 4) % eyesC.length],
      eyeY: 42,
      nose: "#d9a888",
      mouth: 55,
      open: n % 3 !== 0,
      glasses: glassesKind,
      beard,
      front,
      back,
      ears,
    });
  }

  for (let id = 11; id <= 30; id += 1) people[id] = generatedPortrait(id);

  root.MPPortrait = function (id) {
    const svg = people[id] || generatedPortrait(id);
    const n = Number(id) || 1;
    const beat = ((n * 0.83) % 5).toFixed(2);
    const pace = (6.2 + (n % 4) * 0.45).toFixed(2);
    return svg.replace(
      'class="portrait"',
      `class="portrait" style="--face-delay:${beat}s;--face-pace:${pace}s"`
    );
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
