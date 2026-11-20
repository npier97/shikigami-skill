// Character sprites, as editable pixel grids (16 px wide, top-down 3/4 chibi).
// One letter = one pixel; the palette below maps letters to colors per agent.
// Legs and hands are drawn in code (they animate), so the grids stop at the waist.
//
//   o outline   h hair   H hair shadow   l hair highlight
//   s skin      S skin shadow   b blush   m mouth
//   w eye glint i iris   e iris shadow
//   c clothes   C clothes shadow   k collar   p pants
(() => {
  const HEAD_FRONT = [
    "......oooo......",
    "....oohhhhoo....",
    "...ohhhhhllho...",
    "..ohhhhhhhhlho..",
    "..ohhhhhhhhhho..",
    ".ohhhhhhhhhhhho.",
    ".ohhhHhhhhHhhho.",
    ".ohhssHhhHsshho.",
    ".ohssssssssssho.",
    ".ohsoossssoosho.",
    ".ohswisssswisho.",
    ".ohseesssseesho.",
    ".oHsbbssssbbsHo.",
    "..oHsssmmsssHo..",
    "...ooSssssSoo...",
    "......oSSo......",
  ];

  const HEAD_BACK = [
    ...HEAD_FRONT.slice(0, 6),
    ".ohhhhhhhhhhhho.",
    ".ohhhHhhhhHhhho.",
    ".ohhhhhhhhhhhho.",
    ".ohhhhhhhhhhhho.",
    ".ohhHhhhhhhhHho.",
    ".ohhhhhhhhhhhho.",
    ".oHhhhhhhhhhhHo.",
    "..oHhhhhhhhhHo..",
    "...ooHhhhhHoo...",
    "......oSSo......",
  ];

  // Facing right; facing left is drawn mirrored.
  const HEAD_SIDE = [
    ".....oooo.......",
    "...oohhhhoo.....",
    "..ohhhhhhllo....",
    ".ohhhhhhhhhlo...",
    ".ohhhhhhhhhhho..",
    "ohhhhhhhhhhhho..",
    "ohhhhhhhhhHhho..",
    "ohhhhhhhhsssho..",
    "ohhhhhhhssssso..",
    "ohhhhhhhsssooo..",
    "ohhhhhhhssswio..",
    "ohhhhhhhssseeo..",
    "oHhhhhhhsbbsso..",
    ".oHhhhhhssssmo..",
    "..ooHhhhSSSoo...",
    "......oSSo......",
  ];

  const BODY_FRONT = [
    "....occkkcco....",
    "...occcCCccco...",
    "...occcCCccco...",
    "...occcCCccco...",
    "....oppppppo....",
  ];

  const BODY_BACK = [
    "....occcccco....",
    "...occcCCccco...",
    "...occcCCccco...",
    "...occcCCccco...",
    "....oppppppo....",
  ];

  // Face rows 9–11 (eyes) swapped for blinking and the happy ^ ^ face.
  const withEyes = (head, rows) => head.map((r, j) => (rows[j - 9] ? `${r.slice(0, 3)}${rows[j - 9]}${r.slice(13)}` : r));
  const BLINK = ["ssssssssss", "ssssssssss", "soossssoos"];
  const HAPPY = ["ssssssssss", "soossssoos", "ossossosso"];
  const SIDE_BLINK = (head) => head.map((r, j) => (j === 10 || j === 11 ? `${r.slice(0, 8)}${j === 11 ? "sssooo" : "ssssso"}${r.slice(14)}` : j === 9 ? `${r.slice(0, 8)}ssssso${r.slice(14)}` : r));

  const GRIDS = {
    down: [...HEAD_FRONT, ...BODY_FRONT],
    blink: [...withEyes(HEAD_FRONT, BLINK), ...BODY_FRONT],
    happy: [...withEyes(HEAD_FRONT, HAPPY), ...BODY_FRONT],
    up: [...HEAD_BACK, ...BODY_BACK],
    side: [...HEAD_SIDE, ...BODY_BACK],
    sideBlink: [...SIDE_BLINK(HEAD_SIDE), ...BODY_BACK],
  };

  // One character per pair of audit themes, matching how the skill splits the audit. The
  // first and last names are Japanese words for the two themes they check. `themes` are
  // the words matched (accent-free, lowercase) in the agent's description, in this order:
  // the first character whose word appears gets the agent.
  const LOOKS = [
    { name: "Fumi Kaku", meaning: "文 l'écrit, 書く écrire", themes: ["contenu", "texte", "donnee", "formulaire", "commerce"], hair: "#5b8dff", iris: "#2a9d8f", clothes: "#2f5d7c", acc: "glasses" },
    { name: "Tsuna Hikari", meaning: "綱 le lien, 光 la lumière", themes: ["lien", "identification", "contact", "image", "media", "video"], hair: "#ff6fa8", iris: "#7a4cff", clothes: "#4a3f7a", acc: "headphones" },
    { name: "Michi Iro", meaning: "道 le chemin, 色 la couleur", themes: ["navigation", "presentation", "couleur", "contraste", "design"], hair: "#6fd6a0", iris: "#2563eb", clothes: "#3f6e55", acc: "ears" },
    { name: "Mamo Kumo", meaning: "守る protéger, 雲 le nuage", themes: ["securite", "serveur", "perf", "structure", "code"], hair: "#4fcfe0", iris: "#9333ea", clothes: "#35656b", acc: "beanie" },
    // Spare looks for a fifth agent and beyond, or a theme no character above covers.
    { name: "Yorozu", meaning: "万, toutes sortes de choses", themes: [], hair: "#3b3a4a", iris: "#0e7490", clothes: "#3f4a5c", acc: "hachimaki", blush: false },
    { name: "Sora", meaning: "空, le ciel", themes: [], hair: "#b38cff", iris: "#db2777", clothes: "#5b3f7a", acc: "ponytail" },
    { name: "Hoshi", meaning: "星, l'étoile", themes: [], hair: "#ffb347", iris: "#c2410c", clothes: "#7a4a3f", acc: "clip" },
    { name: "Taiyo", meaning: "太陽, le soleil", themes: [], hair: "#f2cf4a", iris: "#b45309", clothes: "#6b5b2f", acc: "ahoge" },
  ];

  // The main session: hands out the work, watches from the whiteboard, merges the copies.
  const LEAD = { name: "Kantoku", meaning: "監督, la direction", themes: [], hair: "#e4dcff", iris: "#e11d48", clothes: "#3d3566", acc: "headset" };

  const plain = (s) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

  // Character for an agent label such as "Opquast · Navigation": the first unused look whose
  // theme word appears in it, otherwise the first unused spare look (Yorozu first, for
  // miscellaneous work), otherwise any unused look, otherwise wrap around.
  const lookIndexFor = (label, taken) => {
    const text = plain(label);
    const free = (i) => !taken.has(i);
    const byTheme = LOOKS.findIndex((l, i) => free(i) && l.themes.some((t) => text.includes(t)));
    if (byTheme >= 0) return byTheme;
    const spare = LOOKS.findIndex((l, i) => free(i) && !l.themes.length);
    if (spare >= 0) return spare;
    const next = LOOKS.findIndex((_, i) => free(i));
    return next >= 0 ? next : taken.size % LOOKS.length;
  };

  const FIXED = {
    o: "#2b2440", s: "#ffe2cc", S: "#f2c1a5", b: "#ff9fb2", m: "#c0607a",
    w: "#ffffff", k: "#f4f1fb", p: "#3a3550",
  };

  const mix = (hex, amt) => {
    const n = parseInt(hex.slice(1), 16);
    const ch = [n >> 16, (n >> 8) & 255, n & 255].map((c) => Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt));
    return `#${ch.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
  };

  const paletteFor = (look) => ({
    ...FIXED,
    b: look.blush === false ? FIXED.s : FIXED.b,
    h: look.hair, H: mix(look.hair, -0.28), l: mix(look.hair, 0.45),
    i: look.iris, e: mix(look.iris, -0.4),
    c: look.clothes, C: mix(look.clothes, -0.25),
  });

  const render = (rows, pal) => {
    const cv = document.createElement("canvas");
    cv.width = 16; cv.height = rows.length;
    const x = cv.getContext("2d");
    rows.forEach((r, j) => [...r].forEach((ch, i) => {
      if (!pal[ch]) return;
      x.fillStyle = pal[ch];
      x.fillRect(i, j, 1, 1);
    }));
    return cv;
  };

  // Builds every frame once for a look (or a LOOKS index); drawing is then a plain drawImage.
  const framesFor = (lookOrIndex) => {
    const look = typeof lookOrIndex === "number" ? LOOKS[lookOrIndex % LOOKS.length] : lookOrIndex;
    const pal = paletteFor(look);
    const frames = Object.fromEntries(Object.entries(GRIDS).map(([k, rows]) => [k, render(rows, pal)]));
    return { ...frames, look, pal };
  };

  window.SPRITES = { GRIDS, LOOKS, LEAD, framesFor, lookIndexFor, mix, OUTLINE: FIXED.o, SKIN: FIXED.s, SKIN_SHADOW: FIXED.S, PANTS: FIXED.p };
})();
