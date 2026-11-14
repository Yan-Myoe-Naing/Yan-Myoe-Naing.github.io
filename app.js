/* =========================================================
   Portfolio site script
   1. Load projects.json (your curated content)
   2. Load public repos from GitHub (so new repos appear automatically)
   3. Merge them and draw the page
   4. Visual effects: dot-matrix hero, line-scan lens, droplets
   ========================================================= */

// Used only if projects.json can't be loaded (e.g. opening the file directly from disk)
const FALLBACK_CONFIG = {
  profile: { name: "YAN MYOE NAING", nickname: "Louis", github_user: "Yan-Myoe-Naing" },
  settings: { auto_load_github_repos: true, hide_repos: [], show_forks: false },
  skills: [],
  projects: []
};

// ---------- small helpers ----------
const $ = (sel) => document.querySelector(sel);

// "House_Price-Prediction" -> "housepriceprediction" (used to match repos to curated projects)
const normalise = (text) => (text || "").toLowerCase().replace(/[^a-z0-9]/g, "");

// "house-price_prediction" -> "House Price Prediction"
const prettyName = (repoName) =>
  repoName.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();

// Escape text before putting it into HTML (protects against odd characters in repo descriptions)
const esc = (text) =>
  String(text ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// "Machine Failure Detection" -> "mf"
const initials = (title) =>
  title.split(/\s+/).filter((w) => /^[a-z0-9]/i.test(w)).slice(0, 2).map((w) => w[0]).join("").toLowerCase();

// ---------- 1. load config ----------
async function loadConfig() {
  try {
    const res = await fetch("projects.json", { cache: "no-cache" });
    if (!res.ok) throw new Error(res.status);
    return await res.json();
  } catch (err) {
    console.warn("Could not load projects.json, using fallback.", err);
    return FALLBACK_CONFIG;
  }
}

// ---------- 2. load GitHub repos ----------
async function loadRepos(user) {
  const cacheKey = "repos:" + user;
  try {
    const cached = JSON.parse(sessionStorage.getItem(cacheKey) || "null");
    if (cached && Date.now() - cached.time < 10 * 60 * 1000) return cached.repos; // 10-minute cache
  } catch (_) { /* storage not available — ignore */ }

  try {
    const res = await fetch(`https://api.github.com/users/${user}/repos?per_page=100&sort=pushed`);
    if (!res.ok) throw new Error("GitHub API " + res.status);
    const repos = await res.json();
    try { sessionStorage.setItem(cacheKey, JSON.stringify({ time: Date.now(), repos })); } catch (_) {}
    return repos;
  } catch (err) {
    console.warn("Could not load GitHub repos — showing projects.json only.", err);
    return [];
  }
}

// ---------- 3. merge curated projects with repos ----------
function findRepo(project, repos) {
  if (project.repo) {
    return repos.find((r) => r.name.toLowerCase() === project.repo.toLowerCase());
  }
  const t = normalise(project.title);
  return repos.find((r) => {
    const n = normalise(r.name);
    return n === t || (n.length > 5 && (t.includes(n) || n.includes(t)));
  });
}

function buildProjectList(config, repos) {
  const user = config.profile.github_user;
  const settings = config.settings || {};
  const hidden = (settings.hide_repos || []).map((n) => n.toLowerCase());
  const usedRepos = new Set();

  // Curated projects first, in the order you wrote them
  const curated = (config.projects || []).map((p) => {
    const repo = findRepo(p, repos);
    if (repo) usedRepos.add(repo.name);
    return {
      title: p.title,
      summary: p.summary || repo?.description || "",
      tags: p.tags?.length ? p.tags : [repo?.language].filter(Boolean),
      year: p.year || (repo ? new Date(repo.created_at).getFullYear() : ""),
      url: p.link || repo?.html_url || (p.repo ? `https://github.com/${user}/${p.repo}` : `https://github.com/${user}`),
      demo: p.demo || repo?.homepage || "",
      featured: Boolean(p.featured),
    };
  });

  // Any other public repo is added automatically
  const extra = repos
    .filter((r) => !usedRepos.has(r.name))
    .filter((r) => !hidden.includes(r.name.toLowerCase()))
    .filter((r) => settings.show_forks || !r.fork)
    .map((r) => ({
      title: prettyName(r.name),
      summary: r.description || "Code and notebooks on GitHub.",
      tags: [r.language, ...(r.topics || [])].filter(Boolean).slice(0, 4),
      year: new Date(r.created_at).getFullYear(),
      url: r.html_url,
      demo: r.homepage || "",
      featured: false,
    }));

  return [...curated, ...extra];
}

// ---------- 4. render ----------
const ICONS = {
  heart: '<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.5-9.3C1 8 3.4 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.6 0 6 3.5 4.5 7.2C19.5 16.4 12 21 12 21z"/></svg>',
  code: '<svg viewBox="0 0 24 24"><path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/></svg>',
  send: '<svg viewBox="0 0 24 24"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>',
  save: '<svg viewBox="0 0 24 24"><path d="M6 3h12v18l-6-5-6 5z"/></svg>',
};
const ART_STYLES = ["dark", "blue", "mid"];

function renderFeatured(projects, user) {
  // Every project gets a card; featured ones go first
  const featured = [...projects.filter((p) => p.featured), ...projects.filter((p) => !p.featured)];
  const handle = user.replace(/-/g, "_");

  $("#featured").innerHTML = featured.map((p, i) => `
    <article class="post reveal">
      <div class="post__head">
        <span class="avatar">ymn</span>
        <span class="post__handle">${esc(handle)}</span>
        <span class="post__dots">•••</span>
      </div>
      <div class="post__art post__art--${ART_STYLES[i % ART_STYLES.length]}">
        <span class="post__glyph" aria-hidden="true">${esc(initials(p.title))}</span>
        <div class="post__meta"><span>${String(i + 1).padStart(2, "0")} / Project</span><span>${esc(p.year)}</span></div>
        <h3 class="post__title">${esc(p.title)}</h3>
      </div>
      <div class="post__body">
        <p>${esc(p.summary)}</p>
        <div class="tags">${p.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>
      </div>
      <div class="post__actions">
        <button class="like-btn" aria-label="Like ${esc(p.title)}" aria-pressed="false">${ICONS.heart}</button>
        <a href="${esc(p.url)}" target="_blank" rel="noopener" aria-label="View code for ${esc(p.title)}">${ICONS.code}</a>
        ${p.demo ? `<a href="${esc(p.demo)}" target="_blank" rel="noopener" aria-label="Open demo of ${esc(p.title)}">${ICONS.send}</a>` : ""}
        <a class="post__link push" href="${esc(p.url)}" target="_blank" rel="noopener">View on GitHub</a>
      </div>
    </article>`).join("");

  // Little "like" toggle, just for fun
  document.querySelectorAll(".like-btn").forEach((btn) =>
    btn.addEventListener("click", () => {
      const on = btn.classList.toggle("is-liked");
      btn.setAttribute("aria-pressed", on);
    })
  );
}

function renderWorkList(projects, activeTag) {
  const shown = activeTag ? projects.filter((p) => p.tags.includes(activeTag)) : projects;
  $("#workList").innerHTML = shown.length
    ? shown.map((p, i) => `
      <li class="work-row reveal">
        <a href="${esc(p.url)}" target="_blank" rel="noopener">
          <span class="work-row__num">${String(i + 1).padStart(2, "0")}</span>
          <span>
            <span class="work-row__title">${esc(p.title)}</span>
            <span class="tags">${p.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</span>
          </span>
          <span class="work-row__summary">${esc(p.summary)}</span>
          <span class="work-row__arrow" aria-hidden="true">→</span>
        </a>
      </li>`).join("")
    : `<li class="empty">No projects with that tag yet.</li>`;
  observeReveals();
}

function renderFilters(projects) {
  // Count tags and keep the most common ones as filter chips
  const counts = {};
  projects.forEach((p) => p.tags.forEach((t) => (counts[t] = (counts[t] || 0) + 1)));
  const tags = Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 10);

  $("#filters").innerHTML =
    `<button class="chip is-on" data-tag="">All</button>` +
    tags.map((t) => `<button class="chip" data-tag="${esc(t)}">${esc(t)}</button>`).join("");

  $("#filters").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    document.querySelectorAll(".chip").forEach((c) => c.classList.toggle("is-on", c === chip));
    renderWorkList(projects, chip.dataset.tag);
  });
}

function renderSkills(skills) {
  $("#skills").innerHTML = (skills || []).map((g) => `
    <div class="skill-box">
      <h4>${esc(g.group)}</h4>
      <ul>${g.items.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
    </div>`).join("");
}

function renderProfile(profile) {
  // Fill any element marked with data-field="name" etc.
  document.querySelectorAll("[data-field]").forEach((el) => {
    const value = profile[el.dataset.field];
    if (value) el.textContent = value;
  });

  const links = [`<a href="https://github.com/${esc(profile.github_user)}" target="_blank" rel="noopener">GitHub ↗</a>`];
  if (profile.linkedin) links.push(`<a href="${esc(profile.linkedin)}" target="_blank" rel="noopener">LinkedIn ↗</a>`);
  if (profile.email) links.push(`<a href="mailto:${esc(profile.email)}">Email ↗</a>`);
  $("#contactLinks").innerHTML = links.join("");
  $("#year").textContent = new Date().getFullYear();
}

// ---------- effects ----------
function setupCarouselButtons() {
  const track = $("#featured");
  const step = () => (track.querySelector(".post")?.offsetWidth || 320) + 22;
  $("#prevBtn").addEventListener("click", () => track.scrollBy({ left: -step(), behavior: "smooth" }));
  $("#nextBtn").addEventListener("click", () => track.scrollBy({ left: step(), behavior: "smooth" }));
}

let revealObserver;
function observeReveals() {
  if (!("IntersectionObserver" in window)) {
    document.querySelectorAll(".reveal").forEach((el) => el.classList.add("is-visible"));
    return;
  }
  revealObserver ||= new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add("is-visible"); revealObserver.unobserve(en.target); }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll(".reveal:not(.is-visible)").forEach((el) => revealObserver.observe(el));
}

function setupRail() {
  const ticks = [...document.querySelectorAll(".rail__tick")];
  const sections = ticks.map((t) => document.querySelector(t.getAttribute("href")));
  const update = () => {
    const y = window.scrollY + window.innerHeight * 0.35;
    let current = 0;
    sections.forEach((s, i) => { if (s && s.offsetTop <= y) current = i; });
    ticks.forEach((t, i) => t.classList.toggle("is-active", i === current));
  };
  window.addEventListener("scroll", update, { passive: true });
  update();
}

function setupDroplets() {
  const box = $("#droplets");
  for (let i = 0; i < 22; i++) {
    const d = document.createElement("span");
    const size = 4 + Math.random() * 14;
    d.className = "droplet";
    Object.assign(d.style, {
      width: size + "px", height: size + "px",
      left: Math.random() * 100 + "%", top: Math.random() * 100 + "%",
      animationDelay: -Math.random() * 7 + "s",
      animationDuration: 5 + Math.random() * 5 + "s",
    });
    box.appendChild(d);
  }
}

/* =========================================================
   HERO: dot-matrix grid + koi fish
   - The grid is drawn once into a hidden "base" canvas (fast).
   - Each frame we copy the base, then redraw only the cells
     touched by the mouse ripple or by a fish.
   - Fish are drawn *as grid cells*, so they look like they are
     swimming through the grains.
   ========================================================= */
const KOI_VARIETIES = [
  { base: "#ffd9c2", spot: "#ff6b2c", fin: "#ffb08a" },  // kohaku: cream + orange
  { base: "#1f1f27", spot: "#ff7a3d", fin: "#5b5b68" },  // showa: ink + orange
  { base: "#cfe4f8", spot: "#3d8fdc", fin: "#9cc6ee" },  // asagi: pale blue + blue
  { base: "#ff8a4c", spot: "#ffe2cf", fin: "#ffc2a1" },  // ogon: orange + cream
];

function setupHeroDots() {
  const canvas = $("#heroDots");
  const ctx = canvas.getContext("2d");
  const hero = canvas.parentElement;
  const base = document.createElement("canvas");   // pre-drawn grid
  const bctx = base.getContext("2d");
  const CELL = 12;
  const PAPER = "#fbfbfc";
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let W = 0, H = 0, cols = 0, rows = 0, dpr = 1, density = [];
  let pointer = null;          // {clientX, clientY} while the pointer is over the hero, else null
  let lastPointerTime = 0;
  let fish = [];
  let running = false, onScreen = true, lastTime = 0, rafId = null;

  // ---------- grid ----------
  function drawCell(g, c, r, d) {
    const x = c * CELL, y = r * CELL;
    if (d > 0.62) {
      g.fillStyle = "#7db6ec"; g.fillRect(x, y, 8, 8);
    } else if (d > 0.4) {
      g.fillStyle = (r + c) % 2 ? "#7db6ec" : "#a9cff3"; g.fillRect(x + 1, y + 1, 6, 6);
    } else if (d > 0.22) {
      g.strokeStyle = "#8fc0ee"; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(x + 1, y + 1); g.lineTo(x + 7, y + 7);
      g.moveTo(x + 7, y + 1); g.lineTo(x + 1, y + 7); g.stroke();
    } else {
      g.fillStyle = "rgba(125,182,236,.45)"; g.fillRect(x + 3, y + 3, 3, 3);
    }
  }

  function buildGrid() {
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) return false;   // hidden / not laid out yet
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = rect.width; H = rect.height;
    canvas.width = base.width = Math.round(W * dpr);
    canvas.height = base.height = Math.round(H * dpr);
    cols = Math.floor(W / CELL);
    rows = Math.floor(H / CELL);

    // Hidden shape drawn on a tiny canvas (1 pixel = 1 cell)
    const off = document.createElement("canvas");
    off.width = cols; off.height = rows;
    const o = off.getContext("2d");
    o.filter = "blur(2px)";
    o.fillStyle = "#000";
    o.font = `${Math.floor(rows * 0.95)}px "Bagel Fat One", sans-serif`;
    o.textAlign = "center";
    o.textBaseline = "middle";
    o.fillText("ai", cols * 0.5, rows * 0.55);
    [[0.15, 0.25, 0.18], [0.85, 0.2, 0.14], [0.78, 0.85, 0.2]].forEach(([x, y, r]) => {
      const g = o.createRadialGradient(cols * x, rows * y, 0, cols * x, rows * y, cols * r);
      g.addColorStop(0, "rgba(0,0,0,.55)"); g.addColorStop(1, "rgba(0,0,0,0)");
      o.fillStyle = g; o.fillRect(0, 0, cols, rows);
    });
    const px = o.getImageData(0, 0, cols, rows).data;
    density = new Float32Array(cols * rows);
    for (let i = 0; i < cols * rows; i++) density[i] = px[i * 4 + 3] / 255 + (Math.random() - 0.5) * 0.25;

    bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bctx.clearRect(0, 0, W, H);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) drawCell(bctx, c, r, density[r * cols + c]);
    return true;
  }

  // ---------- fish ----------
  function makeFish(i) {
    const len = 90 + Math.random() * 30;                // body length in px
    const x = W * (0.15 + Math.random() * 0.7), y = H * (0.15 + Math.random() * 0.7);
    const heading = Math.random() * Math.PI * 2;
    const SEGMENTS = 10;
    const spine = [];
    for (let s = 0; s < SEGMENTS; s++) {
      spine.push({ x: x - Math.cos(heading) * s * (len / (SEGMENTS - 1)), y: y - Math.sin(heading) * s * (len / (SEGMENTS - 1)) });
    }
    return {
      spine, len, segLen: len / (SEGMENTS - 1),
      heading, speed: 40,
      maxSpeed: 120 + Math.random() * 50,
      width: len * 0.19,          // half-width of the body at its widest
      phase: Math.random() * 10,
      look: KOI_VARIETIES[i % KOI_VARIETIES.length],
      seed: Math.random() * 100,
      orbitAngle: (i / 4) * Math.PI * 2,             // each fish circles the cursor at its own spot
      wander: { x, y, t: 0 },
    };
  }

  function fishCount() { return W < 600 ? 2 : W < 1000 ? 3 : 4; }

  function syncFish() {
    // Keep the right number of fish and keep them inside the canvas after a resize
    const n = fishCount();
    while (fish.length < n) fish.push(makeFish(fish.length));
    fish.length = n;
    fish.forEach((f) => f.spine.forEach((p) => {
      p.x = Math.min(Math.max(p.x, 0), W);
      p.y = Math.min(Math.max(p.y, 0), H);
    }));
  }

  const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

  function updateFish(dt, now) {
    const rect = canvas.getBoundingClientRect();
    // The pointer counts as "active" only while over the hero and recently moved/held
    const active = pointer && now - lastPointerTime < 6000;
    let mx = 0, my = 0;
    if (active) {
      // clamp into the canvas so fish never chase a point they can't reach (e.g. over the name text)
      mx = Math.min(Math.max(pointer.clientX - rect.left, 20), W - 20);
      my = Math.min(Math.max(pointer.clientY - rect.top, 20), H - 20);
    }

    fish.forEach((f, i) => {
      const head = f.spine[0];
      let tx, ty;

      if (active) {
        // Target = a point on a small circle around the cursor, so fish don't pile on one pixel
        f.orbitAngle += dt * 0.9;
        const ring = 34 + i * 10;
        tx = mx + Math.cos(f.orbitAngle) * ring;
        ty = my + Math.sin(f.orbitAngle) * ring;
      } else {
        // Wander: pick a new random spot every few seconds, or when the old one is reached
        f.wander.t -= dt;
        if (f.wander.t <= 0 || Math.hypot(f.wander.x - head.x, f.wander.y - head.y) < 30) {
          f.wander = { x: W * (0.08 + Math.random() * 0.84), y: H * (0.1 + Math.random() * 0.8), t: 4 + Math.random() * 4 };
        }
        tx = f.wander.x; ty = f.wander.y;
      }

      // Soft walls: steer back in when close to an edge
      const margin = 40;
      if (head.x < margin) tx = Math.max(tx, margin * 3);
      if (head.x > W - margin) tx = Math.min(tx, W - margin * 3);
      if (head.y < margin) ty = Math.max(ty, margin * 3);
      if (head.y > H - margin) ty = Math.min(ty, H - margin * 3);

      // Separation: nudge away from other fish heads that are too close
      fish.forEach((o, j) => {
        if (j === i) return;
        const dx = head.x - o.spine[0].x, dy = head.y - o.spine[0].y, d = Math.hypot(dx, dy);
        if (d > 0 && d < 45) { tx += (dx / d) * 40; ty += (dy / d) * 40; }
      });

      // Turn smoothly towards the target (limited turn rate = no instant flips)
      const dist = Math.hypot(tx - head.x, ty - head.y);
      const want = Math.atan2(ty - head.y, tx - head.x);
      const maxTurn = 3.2 * dt;
      f.heading += Math.max(-maxTurn, Math.min(maxTurn, angleDiff(want, f.heading)));

      // Speed: fast when far, slow down when arriving; a bit faster when chasing the cursor
      const desired = active ? Math.min(f.maxSpeed * 1.3, 40 + dist * 1.6) : Math.min(f.maxSpeed * 0.5, 25 + dist * 0.4);
      f.speed += (desired - f.speed) * Math.min(1, dt * 2.5);

      // Swimming wiggle: the head swings left/right, faster when swimming faster
      f.phase += dt * (3 + f.speed * 0.06);
      const wiggle = Math.sin(f.phase) * 0.35;
      head.x += Math.cos(f.heading + wiggle) * f.speed * dt;
      head.y += Math.sin(f.heading + wiggle) * f.speed * dt;
      head.x = Math.min(Math.max(head.x, 2), W - 2);
      head.y = Math.min(Math.max(head.y, 2), H - 2);

      // Body follows the head like a chain
      for (let s = 1; s < f.spine.length; s++) {
        const a = f.spine[s - 1], b = f.spine[s];
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
        b.x = a.x + (dx / d) * f.segLen;
        b.y = a.y + (dy / d) * f.segLen;
      }
    });
  }

  // Width of the body along its length: t = 0 at the head, 1 at the tail
  const bodyWidth = (t) => (t < 0.25 ? 0.75 + t : 1 - (t - 0.25) * 1.15);

  function drawFish(f, painted) {
    const sp = f.spine, pad = f.width + 18;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    sp.forEach((p) => { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); });
    const c0 = Math.max(0, Math.floor((minX - pad) / CELL)), c1 = Math.min(cols - 1, Math.ceil((maxX + pad) / CELL));
    const r0 = Math.max(0, Math.floor((minY - pad) / CELL)), r1 = Math.min(rows - 1, Math.ceil((maxY + pad) / CELL));

    // Fin positions: two pectoral fins behind the head, and a tail fan past the last point
    const n = sp.length - 1;
    const h0 = sp[0], h1 = sp[2];
    const ang = Math.atan2(h0.y - h1.y, h0.x - h1.x);
    const finBase = sp[2];
    const fins = [1, -1].map((side) => ({
      x: finBase.x + Math.cos(ang + side * 1.9) * (f.width + 5),
      y: finBase.y + Math.sin(ang + side * 1.9) * (f.width + 5),
    }));
    const tailAng = Math.atan2(sp[n].y - sp[n - 1].y, sp[n].x - sp[n - 1].x) + Math.sin(f.phase - 1.5) * 0.4;
    const tail = { x: sp[n].x + Math.cos(tailAng) * 10, y: sp[n].y + Math.sin(tailAng) * 10 };

    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const cx = c * CELL + 4, cy = r * CELL + 4;

        // nearest point on the spine
        let best = Infinity, bestT = 0;
        for (let s = 0; s < n; s++) {
          const a = sp[s], b = sp[s + 1];
          const vx = b.x - a.x, vy = b.y - a.y;
          const u = Math.max(0, Math.min(1, ((cx - a.x) * vx + (cy - a.y) * vy) / (vx * vx + vy * vy || 1)));
          const d = Math.hypot(cx - (a.x + vx * u), cy - (a.y + vy * u));
          if (d < best) { best = d; bestT = (s + u) / n; }
        }

        const w = f.width * bodyWidth(bestT);
        let kind = null;
        if (best < w) kind = best < w * 0.7 ? "body" : "edge";
        else if (fins.some((p) => Math.hypot(cx - p.x, cy - p.y) < 7)) kind = "fin";
        else if (Math.hypot(cx - tail.x, cy - tail.y) < 10) kind = "fin";
        if (!kind) continue;

        const key = r * cols + c;
        if (painted.has(key)) continue;   // another fish already drew this cell
        painted.add(key);

        // clear the grid cell, then paint the fish cell
        const x = c * CELL, y = r * CELL;
        ctx.fillStyle = PAPER; ctx.fillRect(x - 1, y - 1, CELL - 2, CELL - 2);
        if (kind === "fin") {
          ctx.strokeStyle = f.look.fin; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.moveTo(x + 1, y + 1); ctx.lineTo(x + 7, y + 7);
          ctx.moveTo(x + 7, y + 1); ctx.lineTo(x + 1, y + 7); ctx.stroke();
        } else {
          // patches of colour along the body (different for every fish)
          const patch = Math.sin(bestT * 11 + f.seed) + Math.sin(c * 0.9 + r * 0.7 + f.seed) * 0.5 > 0.55;
          const headCap = bestT < 0.12;
          ctx.fillStyle = patch || headCap ? f.look.spot : f.look.base;
          if (kind === "body") ctx.fillRect(x, y, 8, 8);
          else ctx.fillRect(x + 1, y + 1, 6, 6);
        }
      }
    }
  }

  // ---------- frame ----------
  function render(now) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(base, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Ripple of denser cells around the pointer
    if (pointer) {
      const rect = canvas.getBoundingClientRect();
      const mx = pointer.clientX - rect.left, my = pointer.clientY - rect.top;
      const R = 140;
      const c0 = Math.max(0, Math.floor((mx - R) / CELL)), c1 = Math.min(cols - 1, Math.ceil((mx + R) / CELL));
      const r0 = Math.max(0, Math.floor((my - R) / CELL)), r1 = Math.min(rows - 1, Math.ceil((my + R) / CELL));
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
        const dist = Math.hypot(c * CELL - mx, r * CELL - my);
        if (dist >= R) continue;
        ctx.fillStyle = PAPER; ctx.fillRect(c * CELL - 1, r * CELL - 1, CELL - 2, CELL - 2);
        drawCell(ctx, c, r, density[r * cols + c] + (1 - dist / R) * 0.6);
      }
    }

    const painted = new Set();
    fish.forEach((f) => drawFish(f, painted));
  }

  function loop(now) {
    rafId = null;
    if (!running) return;
    const dt = Math.min(0.05, (now - lastTime) / 1000 || 0.016);   // cap dt so a slow frame doesn't teleport fish
    lastTime = now;
    updateFish(dt, now);
    render(now);
    rafId = requestAnimationFrame(loop);
  }

  // Only animate while the hero is on screen and the tab is visible (saves battery)
  function setRunning() {
    const should = !reduceMotion && onScreen && !document.hidden && W > 0;
    if (should && !running) {
      running = true; lastTime = performance.now();
      rafId = requestAnimationFrame(loop);
    } else if (!should && running) {
      running = false;
      if (rafId) cancelAnimationFrame(rafId), (rafId = null);
    }
  }

  // ---------- input ----------
  const setPointer = (x, y) => { pointer = { clientX: x, clientY: y }; lastPointerTime = performance.now(); if (reduceMotion) render(); };
  hero.addEventListener("pointermove", (e) => setPointer(e.clientX, e.clientY));
  hero.addEventListener("pointerdown", (e) => setPointer(e.clientX, e.clientY));      // taps on phones
  hero.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") pointer = null; if (reduceMotion) render(); });
  window.addEventListener("blur", () => { pointer = null; });
  document.addEventListener("visibilitychange", setRunning);

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; setRunning(); }).observe(hero);
  }

  function rebuild() {
    if (!buildGrid()) return;
    syncFish();
    render(performance.now());   // draw at least once (this is all that happens with reduced motion)
    setRunning();
  }

  let resizeTimer, lastWidth = window.innerWidth;
  window.addEventListener("resize", () => {
    // Phones fire "resize" when the address bar hides; ignore height-only changes
    if (Math.abs(window.innerWidth - lastWidth) < 2 && W > 0) return;
    lastWidth = window.innerWidth;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(rebuild, 150);
  });
  document.fonts.ready.then(rebuild);
}

/* Small "line-scan" panel: horizontal blue lines that get thicker where a
   shaded sphere is darker — like a scanned photo. */
function setupLens() {
  const canvas = $("#heroLens");
  const ctx = canvas.getContext("2d");
  let t = 0;

  function draw() {
    const size = canvas.getBoundingClientRect().width;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = "#7db6ec";

    const cx = size * 0.55, cy = size * 0.45, R = size * 0.38;
    const lx = Math.cos(t) * 0.6 - 0.4, ly = -0.6;            // light direction moves slowly
    for (let y = 0; y < size; y += 5) {
      for (let x = 0; x < size; x += 2) {
        const dx = (x - cx) / R, dy = (y - cy) / R, rr = dx * dx + dy * dy;
        let dark;
        if (rr < 1) {
          const dz = Math.sqrt(1 - rr);
          const light = Math.max(0, -(dx * lx + dy * ly) + dz * 0.6);
          dark = 1 - Math.min(1, light);
        } else {
          dark = 0.75 + 0.15 * Math.sin(x * 0.05 + y * 0.02);
        }
        const h = dark * 4;
        if (h > 0.4) ctx.fillRect(x, y + (4 - h) / 2, 2, h);
      }
    }
  }

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  draw();
  if (!reduce) setInterval(() => { t += 0.08; draw(); }, 120);
  window.addEventListener("resize", draw);
}

// ---------- start ----------
async function init() {
  setupHeroDots();
  setupLens();
  setupDroplets();
  setupCarouselButtons();
  setupRail();

  const config = await loadConfig();
  const profile = { ...FALLBACK_CONFIG.profile, ...config.profile };
  renderProfile(profile);
  renderSkills(config.skills);

  const settings = config.settings || {};
  const repos = settings.auto_load_github_repos ? await loadRepos(profile.github_user) : [];
  const projects = buildProjectList({ ...config, profile }, repos);

  $("#projectCount").textContent = projects.length;
  renderFeatured(projects, profile.github_user);
  renderFilters(projects);
  renderWorkList(projects, "");
  observeReveals();
}

init();
