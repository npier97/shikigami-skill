// Browser checks for one page, run as-is with the in-app browser's javascript tool (or the
// DevTools console). Returns a JSON summary: lowest text contrasts, small targets, horizontal
// overflow, justified text, skip link. Colors go through a canvas, so oklch(), color-mix()
// and friends are measured as the browser paints them. Run it once per theme (light / dark)
// at 1280 px, and once at 320 px for reflow.
(() => {
  const AA = 4.5, AA_LARGE = 3, LARGE_PX = 24, LARGE_BOLD_PX = 18.5, MIN_TARGET = 24;
  const cv = document.createElement("canvas");
  cv.width = cv.height = 1;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  const rgb = (c) => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, 1, 1);
    ctx.fillStyle = c; ctx.fillRect(0, 0, 1, 1);
    return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
  };
  const lum = (c) => {
    const [r, g, b] = rgb(c).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const transparent = (c) => !c || c === "transparent" || /^rgba\(.*,\s*0\)$/.test(c);
  // Nearest painted background; images and gradients are not measured (flagged instead).
  const bgOf = (el) => {
    for (; el; el = el.parentElement) {
      const cs = getComputedStyle(el);
      if (cs.backgroundImage !== "none") return { color: null, image: true };
      if (!transparent(cs.backgroundColor)) return { color: cs.backgroundColor };
    }
    return { color: "#fff" };
  };
  const visible = (e) => e.getClientRects().length && getComputedStyle(e).visibility !== "hidden";
  const ownText = (e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());

  const pairs = new Map();
  let onImage = 0;
  for (const e of document.querySelectorAll("body *")) {
    if (!ownText(e) || !visible(e)) continue;
    const cs = getComputedStyle(e);
    const bg = bgOf(e);
    if (bg.image) { onImage++; continue; }
    const L1 = lum(cs.color), L2 = lum(bg.color);
    const ratio = +((Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)).toFixed(2);
    const px = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700;
    const large = px >= LARGE_PX || (bold && px >= LARGE_BOLD_PX);
    const key = `${rgb(cs.color)} on ${rgb(bg.color)} ${large ? "large" : "normal"}`;
    const p = pairs.get(key) ?? { ratio, need: large ? AA_LARGE : AA, size: cs.fontSize, weight: cs.fontWeight, example: e.textContent.trim().slice(0, 40), count: 0 };
    p.count++;
    pairs.set(key, p);
  }
  const contrast = [...pairs.entries()].map(([pair, p]) => ({ pair, ...p })).sort((a, b) => a.ratio / a.need - b.ratio / b.need);

  const targets = [...document.querySelectorAll("a[href], button, input, select, textarea, summary, [role=button], [tabindex='0']")]
    .filter(visible)
    .map((e) => ({ e, r: e.getBoundingClientRect() }))
    .filter(({ e, r }) => (r.width < MIN_TARGET || r.height < MIN_TARGET) && getComputedStyle(e).display !== "inline")
    .map(({ e, r }) => `${(e.getAttribute("aria-label") || e.textContent || e.name || e.tagName).trim().slice(0, 30)} ${Math.round(r.width)}×${Math.round(r.height)}`);

  // On a phone (or mobile emulation) too-wide content stretches the layout viewport itself,
  // so innerWidth grows past the device width instead of the page scrolling: check both.
  const width = Math.min(innerWidth, screen.width || innerWidth);
  const overflow = document.documentElement.scrollWidth > width + 1;
  const wide = overflow
    ? [...document.querySelectorAll("body *")].filter((e) => e.getBoundingClientRect().right > width + 1 && ![...e.children].some((c) => c.getBoundingClientRect().right > width + 1))
        .slice(0, 6).map((e) => `${e.tagName.toLowerCase()}${e.className ? "." + String(e.className).split(" ")[0] : ""} → ${Math.round(e.getBoundingClientRect().right)}px`)
    : [];
  const skip = [...document.querySelectorAll("a[href^='#']")].find((a) => a.compareDocumentPosition(document.querySelector("main") ?? document.body) & Node.DOCUMENT_POSITION_FOLLOWING);

  return {
    url: location.pathname,
    viewport: `${innerWidth}×${innerHeight} (screen ${screen.width})`,
    dark: matchMedia("(prefers-color-scheme: dark)").matches,
    contrastBelowThreshold: contrast.filter((p) => p.ratio < p.need).slice(0, 10),
    lowestContrasts: contrast.slice(0, 3),
    textOnImageNotMeasured: onImage,
    smallTargets: targets.slice(0, 12),
    horizontalOverflow: overflow ? { width, scrollWidth: document.documentElement.scrollWidth, culprits: wide } : false,
    justifiedText: [...document.querySelectorAll("p, li, div")].filter((e) => ownText(e) && getComputedStyle(e).textAlign === "justify").length,
    skipLink: skip ? { text: skip.textContent.trim(), href: skip.getAttribute("href") } : null,
  };
})();
