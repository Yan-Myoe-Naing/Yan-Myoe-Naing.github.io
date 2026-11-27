/* =========================================================
   Project previews + interactive demos
   - Each card gets a small live "peek" (chart, image or animation).
   - "Try it" opens a modal and lazy-loads demos/<slug>.js.
   - ECharts and anime.js are self-hosted in /vendor and only
     downloaded when a preview or demo needs them.
   ========================================================= */
(function () {
  const VERSION = "17";
  const BASE = "demos/";
  const COLORS = {
    blue: "#7db6ec", deep: "#3d8fdc", pale: "#d9eafb", ink: "#141419", ink2: "#1f1f27",
    paper: "#fbfbfc", grey: "#8a8a96", orange: "#ff6b2c", cream: "#ffd9c2", green: "#2f9e6b", amber: "#e3a008", red: "#e2475b",
  };
  const FONT_UI = '"Space Grotesk", system-ui, sans-serif';
  const FONT_MONO = '"Space Mono", ui-monospace, monospace';
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- loading helpers ----------
  const scriptCache = {};
  function loadScript(src) {
    if (!scriptCache[src]) {
      scriptCache[src] = new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = src + (src.includes("?") ? "" : "?v=" + VERSION);
        s.onload = resolve;
        s.onerror = () => { delete scriptCache[src]; reject(new Error("Could not load " + src)); };
        document.head.appendChild(s);
      });
    }
    return scriptCache[src];
  }
  const jsonCache = {};
  function loadJSON(name) {
    if (!jsonCache[name]) {
      jsonCache[name] = fetch(BASE + "data/" + name + "?v=" + VERSION).then((r) => {
        if (!r.ok) throw new Error(name + " " + r.status);
        return r.json();
      }).catch((e) => { delete jsonCache[name]; throw e; });
    }
    return jsonCache[name];
  }
  const getECharts = () => loadScript("vendor/echarts.custom.min.js").then(() => window.echarts);
  const getAnime = () => loadScript("vendor/anime.umd.min.js").then(() => window.anime);

  // ---------- shared chart styling ----------
  function baseOption(dark) {
    const text = dark ? "#c9c9d1" : "#3a3a44";
    const line = dark ? "rgba(255,255,255,.12)" : "#e4e4ea";
    return {
      textStyle: { fontFamily: FONT_UI, color: text },
      color: [COLORS.deep, COLORS.orange, COLORS.blue, COLORS.ink, COLORS.green, COLORS.amber],
      grid: { left: 52, right: 18, top: 28, bottom: 36, containLabel: false },
      tooltip: {
        backgroundColor: COLORS.ink, borderColor: COLORS.ink, padding: [8, 10],
        textStyle: { color: "#fff", fontFamily: FONT_UI, fontSize: 12 },
      },
      xAxisDefaults: { axisLine: { lineStyle: { color: line } }, axisLabel: { color: text, fontFamily: FONT_MONO, fontSize: 10 }, splitLine: { lineStyle: { color: line } } },
    };
  }
  function axis(extra, dark) {
    const b = baseOption(dark).xAxisDefaults;
    return Object.assign({ axisLine: b.axisLine, axisLabel: Object.assign({}, b.axisLabel), splitLine: { show: true, lineStyle: b.splitLine.lineStyle }, axisTick: { show: false }, nameTextStyle: { fontFamily: FONT_MONO, fontSize: 10, color: b.axisLabel.color } }, extra || {});
  }

  // Create a chart that resizes with its box and is disposed later.
  function makeChart(echarts, el, option, registry, dark) {
    const chart = echarts.init(el, null, { renderer: "canvas" });
    const b = baseOption(dark);
    chart.setOption(Object.assign({ animationDuration: reduceMotion ? 0 : 900, animationEasing: "cubicOut", textStyle: b.textStyle, color: b.color, tooltip: b.tooltip }, option));
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(el);
    if (registry) registry.push(() => { ro.disconnect(); chart.dispose(); });
    return chart;
  }

  // Count a number up smoothly (falls back to instant when motion is reduced)
  function tweenNumber(el, to, format, state) {
    const from = state && typeof state.value === "number" ? state.value : 0;
    if (state) state.value = to;
    if (reduceMotion || !window.anime) { el.textContent = format(to); return; }
    const obj = { v: from };
    window.anime.animate(obj, { v: to, duration: 600, ease: "out(3)", onUpdate: () => { el.textContent = format(obj.v); } });
  }

  const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---------- registry ----------
  const demos = {};
  window.Demos = {
    register(slug, def) { demos[slug] = def; },
    colors: COLORS, fonts: { ui: FONT_UI, mono: FONT_MONO }, reduceMotion, esc,
  };

  // ---------- card colours ----------
  // Cards cycle through three backgrounds (dark / light blue / mid blue).
  // Every preview asks this helper which colours read well on its card.
  function cardTone(el) {
    const art = el.closest(".post__art");
    const bg = art && art.classList.contains("post__art--blue") ? "blue" : art && art.classList.contains("post__art--mid") ? "mid" : "dark";
    return {
      bg,
      main: bg === "blue" ? COLORS.ink : bg === "mid" ? "#a9cff3" : COLORS.blue,                 // primary marks
      deep: bg === "blue" ? COLORS.ink : bg === "mid" ? "#d9eafb" : COLORS.deep,                 // bars / strong marks
      soft: bg === "blue" ? "rgba(20,20,25,.58)" : bg === "mid" ? "rgba(217,234,251,.55)" : "rgba(125,182,236,.55)",
      faint: bg === "blue" ? "rgba(20,20,25,.13)" : bg === "mid" ? "rgba(255,255,255,.16)" : "rgba(255,255,255,.14)",
    };
  }

  /* =========================================================
     CARD PREVIEWS ("peeks")
     ========================================================= */
  const PREVIEWS = {
    "house-price": { kind: "chart", dark: false, async build(el, ec, tone) {
      const d = await loadJSON("previews.json").then((p) => p.house);
      return makeChart(ec, el, {
        grid: { left: 6, right: 6, top: 8, bottom: 6 }, tooltip: { show: false },
        xAxis: { type: "value", show: false, min: 150, max: 1650 }, yAxis: { type: "value", show: false, min: 0 },
        series: [
          { type: "scatter", data: d.points, symbolSize: 5, itemStyle: { color: tone.main, opacity: 0.75 }, silent: true },
          { type: "line", data: d.line, symbol: "none", lineStyle: { color: COLORS.orange, width: 3 }, silent: true },
        ],
      }, null);
    } },
    "machine-failure": { kind: "chart", dark: true, async build(el, ec, tone) {
      const d = await loadJSON("previews.json").then((p) => p.machine);
      return makeChart(ec, el, {
        grid: { left: 6, right: 6, top: 8, bottom: 6 }, tooltip: { show: false },
        xAxis: { type: "value", show: false, scale: true }, yAxis: { type: "value", show: false, scale: true },
        series: [
          { type: "scatter", data: d.ok, symbolSize: 3, itemStyle: { color: tone.main, opacity: 0.45 }, silent: true },
          { type: "scatter", data: d.fail, symbolSize: 5, itemStyle: { color: COLORS.orange }, silent: true },
        ],
      }, null, true);
    } },
    "customer-clustering": { kind: "chart", dark: false, async build(el, ec, tone) {
      const d = await loadJSON("previews.json").then((p) => p.clusters);
      const cols = [tone.main, COLORS.orange];
      return makeChart(ec, el, {
        grid: { left: 8, right: 8, top: 8, bottom: 8 }, tooltip: { show: false },
        xAxis: { type: "value", show: false, scale: true }, yAxis: { type: "value", show: false, scale: true },
        series: [0, 1].map((k) => ({ type: "scatter", data: d.points.filter((p) => p[2] === k).map((p) => [p[0], p[1]]), symbolSize: 7, itemStyle: { color: cols[k], opacity: 0.85 }, silent: true }))
          .concat([{ type: "scatter", data: d.centers, symbol: "diamond", symbolSize: 16, itemStyle: { color: "#fff", borderColor: COLORS.ink, borderWidth: 2 }, silent: true }]),
      }, null);
    } },
    "energy-forecasting": { kind: "chart", dark: true, async build(el, ec, tone) {
      const d = await loadJSON("previews.json").then((p) => p.energy);
      const n = d.history.length;
      const hist = d.history.map((v, i) => [i, v]);
      const fc = d.fc.map((v, i) => [n + i, v]);
      return makeChart(ec, el, {
        grid: { left: 4, right: 4, top: 10, bottom: 4 }, tooltip: { show: false },
        xAxis: { type: "value", show: false, min: 0, max: n + d.fc.length }, yAxis: { type: "value", show: false, scale: true },
        series: [
          { type: "line", data: hist, symbol: "none", lineStyle: { color: tone.main, width: 1.4 }, silent: true },
          { type: "line", data: d.lo.map((v, i) => [n + i, v]), symbol: "none", lineStyle: { opacity: 0 }, stack: "band", silent: true },
          { type: "line", data: d.hi.map((v, i) => [n + i, v - d.lo[i]]), symbol: "none", lineStyle: { opacity: 0 }, stack: "band", areaStyle: { color: "rgba(255,107,44,.25)" }, silent: true },
          { type: "line", data: fc, symbol: "none", lineStyle: { color: COLORS.orange, width: 2.2 }, silent: true },
        ],
      }, null, true);
    } },
    "job-market": { kind: "chart", dark: false, async build(el, ec, tone) {
      const d = await loadJSON("previews.json").then((p) => p.jobs);
      return makeChart(ec, el, {
        grid: { left: 6, right: 10, top: 8, bottom: 6, containLabel: false }, tooltip: { show: false },
        xAxis: { type: "value", show: false }, yAxis: { type: "category", show: false, data: d.titles, inverse: true },
        series: [{ type: "bar", data: d.salary, barWidth: "62%", itemStyle: { color: (p) => (p.dataIndex < 3 ? COLORS.orange : tone.deep), borderRadius: [0, 4, 4, 0] }, silent: true }],
      }, null);
    } },
    "graduate-outcomes": { kind: "chart", dark: true, async build(el, ec, tone) {
      const d = await loadJSON("previews.json").then((p) => p.graduates);
      return makeChart(ec, el, {
        grid: { left: 6, right: 6, top: 14, bottom: 6 }, tooltip: { show: false },
        xAxis: { type: "category", show: false, data: d.years, boundaryGap: false }, yAxis: { type: "value", show: false, min: 60, max: 95 },
        series: [
          { type: "line", data: d.male, smooth: true, symbolSize: 5, lineStyle: { color: tone.main, width: 2.5 }, itemStyle: { color: tone.main }, silent: true },
          { type: "line", data: d.female, smooth: true, symbolSize: 5, lineStyle: { color: COLORS.orange, width: 2.5 }, itemStyle: { color: COLORS.orange }, areaStyle: { color: "rgba(255,107,44,.12)" }, silent: true },
        ],
      }, null, true);
    } },
    "emnist": { kind: "anim", build: (el) => letterPeek(el) },
    "pendulum-dqn": { kind: "anim", build: (el) => pendulumPeek(el) },
    "catch-and-go": { kind: "anim", build: (el) => catchAndGoPeek(el) },
    "burmese-poetry": { kind: "anim", build: (el) => burmesePoetryPeek(el) },
    "library-pipeline": { kind: "anim", build: (el) => pipelinePeek(el) },
    "library-database": { kind: "image", src: "demos/img/library-erd.webp", alt: "Entity-relationship diagram of the library database" },
    "wellness-game": { kind: "anim", build: (el) => cityPeek(el) },
    "clarity": { kind: "anim", build: (el) => agentsPeek(el) },
    "q-ai": { kind: "anim", build: (el) => verdictPeek(el) },
  };

  function pendulumPeek(el) {
    el.innerHTML = `<svg class="peek-schematic" viewBox="0 0 300 160" aria-hidden="true">
      <circle cx="150" cy="80" r="58" fill="none" stroke="currentColor" opacity=".28" stroke-dasharray="3 5"/>
      <path d="M150 80V22M150 80H220M150 80H80" fill="none" stroke="currentColor" opacity=".28" stroke-dasharray="3 5"/>
      <circle cx="150" cy="22" r="7" fill="none" stroke="currentColor" opacity=".7"/>
      <g class="peek-pendulum__arm">
        <path d="M150 80V22" stroke="var(--orange)" stroke-width="5" stroke-linecap="round"/>
        <circle cx="150" cy="22" r="8" fill="var(--orange)"/>
      </g>
      <circle cx="150" cy="80" r="5" fill="currentColor"/>
    </svg>`;
  }

  function catchAndGoPeek(el) {
    el.innerHTML = `<svg class="peek-schematic" viewBox="0 0 300 160" aria-hidden="true">
      <path d="M38 108H90L131 65H251M90 108L151 124H252M131 65L163 34H220"
        fill="none" stroke="currentColor" opacity=".4" stroke-width="3" stroke-linecap="round"/>
      <g fill="currentColor">
        <circle cx="38" cy="108" r="4"/><circle cx="90" cy="108" r="4"/>
        <circle cx="131" cy="65" r="4"/><circle cx="163" cy="34" r="4"/>
        <circle cx="220" cy="34" r="4"/><circle cx="251" cy="65" r="4"/>
        <circle cx="151" cy="124" r="4"/><circle cx="252" cy="124" r="4"/>
      </g>
      <circle cx="190" cy="65" r="16" fill="none" stroke="var(--orange)" stroke-width="2" opacity=".55"/>
      <circle cx="190" cy="65" r="7" fill="var(--orange)"/>
      <text x="190" y="98" fill="currentColor" text-anchor="middle" class="mono" font-size="12">Hougang</text>
    </svg>`;
  }

  // Burmese poetry peek: a real recorded run of the attention model. Each new syllable
  // appears, and lines show which context syllables attention looked at (thicker = more).
  function burmesePoetryPeek(el) {
    el.innerHTML = `<div class="peek-attn"><svg class="peek-attn__lines" aria-hidden="true"></svg>
      <div class="peek-attn__row peek-attn__ctx poetry-myanmar" lang="my"></div>
      <span class="peek-attn__label mono">attention</span>
      <div class="peek-attn__row peek-attn__out poetry-myanmar" lang="my"></div></div>`;
    let timer = null, alive = true;
    loadJSON("burmese-poetry.json").then((d) => {
      if (!alive) return;
      const { context, output, attention } = d.peek;
      const ctxRow = el.querySelector(".peek-attn__ctx"), outRow = el.querySelector(".peek-attn__out"), svg = el.querySelector("svg");
      ctxRow.innerHTML = context.map((t) => `<span class="${t === "<PHRASE_END>" ? "is-end" : ""}">${t === "<PHRASE_END>" ? "¶" : esc(t)}</span>`).join("");
      outRow.innerHTML = output.map((t) => `<span>${esc(t)}</span>`).join("");
      const ctxEls = [...ctxRow.children], outEls = [...outRow.children];
      let step = -1;
      function draw() {
        step = (step + 1) % (output.length + 2);          // two extra beats to pause on the full line
        const k = Math.min(step, output.length - 1);
        outEls.forEach((e, i) => e.classList.toggle("is-on", i <= step));
        const box = el.getBoundingClientRect(), o = outEls[k].getBoundingClientRect();
        svg.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);
        const att = attention[k], mx = Math.max(...att);
        ctxEls.forEach((e, i) => e.style.setProperty("--w", (att[i] / mx).toFixed(3)));
        svg.innerHTML = step >= output.length ? "" : att.map((w, i) => {
          const c = ctxEls[i].getBoundingClientRect();
          const x1 = o.left + o.width / 2 - box.left, y1 = o.top - box.top, x2 = c.left + c.width / 2 - box.left, y2 = c.bottom - box.top;
          return w / mx < 0.08 ? "" : `<path d="M${x1} ${y1} C ${x1} ${(y1 + y2) / 2}, ${x2} ${(y1 + y2) / 2}, ${x2} ${y2}" stroke-width="${(0.6 + 5 * w).toFixed(2)}" opacity="${(0.25 + 0.75 * w / mx).toFixed(2)}"/>`;
        }).join("");
      }
      document.fonts.ready.then(() => { if (!alive) return; draw(); if (!reduceMotion) timer = setInterval(draw, 1100); });
    }).catch(() => el.classList.add("is-failed"));
    return { dispose() { alive = false; clearInterval(timer); } };
  }

  // EMNIST peek: letters appear as 28x28 pixel grids, with a prediction tag
  function letterPeek(el) {
    const tone = cardTone(el);
    const ink = tone.main, softInk = tone.soft, gridInk = tone.faint;
    const cv = document.createElement("canvas");
    cv.className = "peek-canvas";
    el.appendChild(cv);
    const tag = document.createElement("span");
    tag.className = "peek-tag mono";
    if (tone.bg === "blue") tag.style.color = COLORS.ink;
    el.appendChild(tag);
    const off = document.createElement("canvas"); off.width = off.height = 28;
    const o = off.getContext("2d", { willReadFrequently: true });
    const letters = "AYMNOKRS";
    let i = 0, timer = null;
    function draw() {
      const L = letters[i++ % letters.length];
      o.fillStyle = "#000"; o.fillRect(0, 0, 28, 28);
      o.fillStyle = "#fff"; o.font = '22px "Bagel Fat One", sans-serif'; o.textAlign = "center"; o.textBaseline = "middle";
      o.fillText(L, 14, 15);
      const px = o.getImageData(0, 0, 28, 28).data;
      const r = el.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
      cv.width = r.width * dpr; cv.height = r.height * dpr;
      const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cell = Math.min(r.width, r.height) * 0.8 / 28, ox = (r.width - cell * 28) / 2, oy = (r.height - cell * 28) / 2;
      g.clearRect(0, 0, r.width, r.height);
      for (let y = 0; y < 28; y++) for (let x = 0; x < 28; x++) {
        const v = px[(y * 28 + x) * 4] / 255;
        g.fillStyle = v > 0.5 ? ink : v > 0.15 ? softInk : gridInk;
        const s = cell * (v > 0.5 ? 0.84 : v > 0.15 ? 0.62 : 0.27);
        g.fillRect(ox + x * cell + (cell - s) / 2, oy + y * cell + (cell - s) / 2, s, s);
      }
      tag.textContent = "→ " + L;
    }
    document.fonts.ready.then(draw);
    if (!reduceMotion) timer = setInterval(draw, 1600);
    return { dispose() { clearInterval(timer); } };
  }

  // Data-lake peek: dots flow Bronze → Silver → Gold, one goes to quarantine
  function pipelinePeek(el) {
    el.innerHTML = `<div class="peek-pipe">
      <svg class="peek-pipe__track" viewBox="0 0 300 120" preserveAspectRatio="none" aria-hidden="true">
        <path class="peek-pipe__line" d="M50 60H250"/>
        <path class="peek-pipe__branch" d="M150 60V105"/>
        ${Array.from({ length: 5 }, (_, index) => `<circle class="peek-pipe__dot" cx="50" cy="60" r="3.5" style="--delay:${index * -0.52}s"/>`).join("")}
        <circle class="peek-pipe__reject" cx="50" cy="60" r="3.5"/>
      </svg>
      <span class="peek-pipe__stage" style="--c:#c98a5a">Bronze</span>
      <span class="peek-pipe__stage" style="--c:#b9c0cc">Silver</span>
      <span class="peek-pipe__stage" style="--c:#e8c14f">Gold</span>
    </div>`;
  }

  // Wellness game peek: a little city grows block by block
  function cityPeek(el) {
    el.innerHTML = `<div class="peek-city"><span class="peek-city__pts mono">+20 pts</span><div class="peek-city__row"></div></div>`;
    const row = el.querySelector(".peek-city__row");
    const heights = [38, 62, 46, 80, 54, 70, 40, 58];
    heights.forEach((h) => { const b = document.createElement("i"); b.style.height = h + "%"; row.appendChild(b); });
    let anim = null;
    getAnime().then((A) => {
      if (reduceMotion) return;
      anim = A.createTimeline({ loop: true, loopDelay: 900 })
        .add(row.querySelectorAll("i"), { scaleY: [0, 1], duration: 500, delay: A.stagger(140), ease: "out(3)" })
        .add(el.querySelector(".peek-city__pts"), { opacity: [0, 1, 0], y: [8, -14], duration: 1200 }, "-=900");
    }).catch(() => {});
    return { dispose() { anim && anim.pause(); } };
  }

  // CLARITY peek: agent nodes light up in sequence along the consultation
  function agentsPeek(el) {
    const names = ["Interview", "Schedule", "Prep", "Copilot", "Cues", "Record", "Follow-up"];
    el.innerHTML = `<div class="peek-agents">${names.map((n) => `<span class="peek-agent"><i></i>${n}</span>`).join("")}</div>`;
    const base = cardTone(el).main;
    let anim = null;
    getAnime().then((A) => {
      if (reduceMotion) return;
      anim = A.animate(el.querySelectorAll(".peek-agent i"), {
        scale: [1, 1.9, 1], backgroundColor: [base, COLORS.orange, base],
        delay: A.stagger(320), duration: 900, loop: true, loopDelay: 600,
      });
    }).catch(() => {});
    return { dispose() { anim && anim.pause(); } };
  }

  // Q AI peek: answers get a Green / Amber / Red verdict stamp
  function verdictPeek(el) {
    el.innerHTML = `<div class="peek-verdict"><p class="peek-verdict__q mono">“What's the daily overseas transfer limit?”</p>
      <span class="peek-stamp" data-v="Green">Verified</span><span class="peek-stamp" data-v="Amber">Unconfirmed</span><span class="peek-stamp" data-v="Red">Conflicts with policy</span></div>`;
    const stamps = el.querySelectorAll(".peek-stamp");
    let i = 0, timer = null;
    const show = () => { stamps.forEach((s, k) => s.classList.toggle("is-on", k === i % 3)); i++; };
    show();
    if (!reduceMotion) timer = setInterval(show, 1500);
    return { dispose() { clearInterval(timer); } };
  }

  async function renderPreview(el) {
    const slug = el.dataset.preview;
    const p = PREVIEWS[slug];
    if (!p || el.dataset.ready) return;
    el.dataset.ready = "1";
    el.classList.add("is-" + p.kind);
    try {
      if (p.kind === "image") {
        el.innerHTML = `<img src="${p.src}" alt="${esc(p.alt)}" loading="lazy" decoding="async" />`;
      } else if (p.kind === "chart") {
        const box = document.createElement("div");
        box.className = "peek-chart";
        el.appendChild(box);
        const ec = await getECharts();
        await p.build(box, ec, cardTone(el));
      } else {
        p.build(el);
      }
    } catch (err) {
      console.warn("Preview failed for", slug, err);
      el.classList.add("is-failed");
    }
  }

  function setupPreviews(root) {
    const els = (root || document).querySelectorAll("[data-preview]");
    if (!("IntersectionObserver" in window)) { els.forEach(renderPreview); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { io.unobserve(en.target); renderPreview(en.target); } });
    }, { rootMargin: "200px 400px" });
    els.forEach((e) => io.observe(e));
  }

  /* =========================================================
     DEMO MODAL
     ========================================================= */
  let dialog, current = null, lastFocus = null;

  function buildDialog() {
    dialog = document.createElement("dialog");
    dialog.className = "demo-modal";
    dialog.setAttribute("aria-labelledby", "demoTitle");
    dialog.innerHTML = `
      <div class="demo-modal__inner">
        <header class="demo-modal__head">
          <div>
            <p class="demo-modal__eyebrow mono" id="demoEyebrow">Interactive demo</p>
            <h2 class="demo-modal__title" id="demoTitle"></h2>
          </div>
          <div class="demo-modal__links" id="demoLinks"></div>
          <button class="demo-modal__close" type="button" aria-label="Close demo" autofocus>✕</button>
        </header>
        <div class="demo-modal__body" id="demoBody"></div>
        <p class="demo-modal__note mono" id="demoNote"></p>
      </div>`;
    document.body.appendChild(dialog);
    dialog.querySelector(".demo-modal__close").addEventListener("click", close);
    dialog.addEventListener("cancel", (e) => { e.preventDefault(); close(); });      // Esc key
    dialog.addEventListener("click", (e) => { if (e.target === dialog) close(); }); // click on the backdrop
  }

  async function open(project) {
    if (!dialog) buildDialog();
    if (current) teardown();
    lastFocus = document.activeElement;
    const slug = project.slug;
    dialog.querySelector("#demoTitle").textContent = project.title;
    dialog.querySelector("#demoEyebrow").textContent = "Interactive demo · " + (project.tags || []).slice(0, 3).join(" · ");
    const linkText = project.linkLabel === "View case study" ? "View case study" : "View code";
    const linkTarget = linkText === "View case study" ? "" : ' target="_blank" rel="noopener"';
    const links = [`<a href="${esc(project.url)}"${linkTarget}>${linkText} →</a>`];
    if (project.page) links.unshift(`<a href="${esc(project.page)}">Case study →</a>`);
    dialog.querySelector("#demoLinks").innerHTML = links.join("");
    const body = dialog.querySelector("#demoBody");
    const note = dialog.querySelector("#demoNote");
    body.innerHTML = `<p class="demo-loading mono">Loading demo…</p>`;
    note.textContent = "";
    document.documentElement.classList.add("demo-open");
    if (!dialog.open) dialog.showModal();
    history.replaceState(null, "", "#demo-" + slug);

    getAnime().then((A) => { if (!reduceMotion) A.animate(dialog.querySelector(".demo-modal__inner"), { opacity: [0, 1], y: [24, 0], duration: 450, ease: "out(3)" }); }).catch(() => {});

    const cleanups = [];
    current = { slug, cleanups };
    try {
      await loadScript(BASE + slug + ".js");
      const def = demos[slug];
      if (!def) throw new Error("Demo not registered: " + slug);
      const [ec, A] = await Promise.all([def.charts === false ? null : getECharts(), getAnime().catch(() => null)]);
      if (!current || current.slug !== slug) return;   // closed while loading
      body.innerHTML = "";
      note.textContent = def.note || "";
      const api = {
        echarts: ec, anime: A, json: loadJSON, colors: COLORS, fonts: { ui: FONT_UI, mono: FONT_MONO }, reduceMotion, esc,
        chart: (el, option, dark) => makeChart(ec, el, option, cleanups, dark),
        axis, tween: tweenNumber, onCleanup: (fn) => cleanups.push(fn), base: BASE,
      };
      await def.mount(body, api);
    } catch (err) {
      console.error(err);
      body.innerHTML = `<p class="demo-error">This demo couldn't load. Check your connection and try again, or <a href="${esc(project.url)}"${linkTarget}>${linkText.toLowerCase()}</a>.</p>`;
    }
  }

  function teardown() {
    if (!current) return;
    current.cleanups.forEach((fn) => { try { fn(); } catch (_) {} });
    current = null;
    dialog.querySelector("#demoBody").innerHTML = "";
  }

  function close() {
    teardown();
    if (dialog && dialog.open) dialog.close();
    document.documentElement.classList.remove("demo-open");
    if (location.hash.startsWith("#demo-")) history.replaceState(null, "", location.pathname + location.search + "#projects");
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  }

  // ---------- wiring from app.js ----------
  window.Demos.attach = function (projects) {
    const bySlug = {};
    projects.forEach((p) => { if (p.slug) bySlug[p.slug] = p; });
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-demo]");
      if (!btn) return;
      const p = bySlug[btn.dataset.demo];
      if (p) { e.preventDefault(); open(p); }
    });
    setupPreviews(document);
    // deep link: index.html#demo-emnist opens that demo
    const m = location.hash.match(/^#demo-([\w-]+)/);
    if (m && bySlug[m[1]]) open(bySlug[m[1]]);
  };
  window.Demos.hasPreview = (slug) => Boolean(PREVIEWS[slug]);
})();
