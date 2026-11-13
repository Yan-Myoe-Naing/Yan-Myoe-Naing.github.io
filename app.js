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
  title.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toLowerCase();

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
  let featured = projects.filter((p) => p.featured);
  if (featured.length < 3) featured = projects.slice(0, 6);
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

/* Hero: a grid of little squares. Where the hidden shape ("ai" + soft blobs)
   is dense, squares are bigger; elsewhere they fade to dots and crosses.
   The mouse pushes a ripple of extra density around it. */
function setupHeroDots() {
  const canvas = $("#heroDots");
  const ctx = canvas.getContext("2d");
  const CELL = 12;
  let cols, rows, density = [], mouse = { x: -999, y: -999 }, frame = null;

  function buildDensity() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.floor(rect.width / CELL);
    rows = Math.floor(rect.height / CELL);

    // Draw the hidden shape on a tiny off-screen canvas (1 pixel = 1 cell)
    const off = document.createElement("canvas");
    off.width = cols; off.height = rows;
    const o = off.getContext("2d");
    o.filter = "blur(2px)";
    o.fillStyle = "#000";
    o.font = `${Math.floor(rows * 0.95)}px "Bagel Fat One", sans-serif`;
    o.textAlign = "center";
    o.textBaseline = "middle";
    o.fillText("ai", cols * 0.5, rows * 0.55);
    // soft extra blobs
    [[0.15, 0.25, 0.18], [0.85, 0.2, 0.14], [0.78, 0.85, 0.2]].forEach(([x, y, r]) => {
      const g = o.createRadialGradient(cols * x, rows * y, 0, cols * x, rows * y, cols * r);
      g.addColorStop(0, "rgba(0,0,0,.55)"); g.addColorStop(1, "rgba(0,0,0,0)");
      o.fillStyle = g; o.fillRect(0, 0, cols, rows);
    });
    const px = o.getImageData(0, 0, cols, rows).data;
    density = [];
    for (let i = 0; i < cols * rows; i++) {
      density.push(px[i * 4 + 3] / 255 + (Math.random() - 0.5) * 0.25);
    }
    draw();
  }

  function draw() {
    frame = null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * CELL, y = r * CELL;
        const dist = Math.hypot(x - mouse.x, y - mouse.y);
        const ripple = dist < 140 ? (1 - dist / 140) * 0.6 : 0;
        const d = density[r * cols + c] + ripple;

        if (d > 0.62) {
          ctx.fillStyle = "#7db6ec"; ctx.fillRect(x, y, 8, 8);
        } else if (d > 0.4) {
          ctx.fillStyle = (r + c) % 2 ? "#7db6ec" : "#a9cff3"; ctx.fillRect(x + 1, y + 1, 6, 6);
        } else if (d > 0.22) {
          ctx.strokeStyle = "#8fc0ee"; ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.moveTo(x + 1, y + 1); ctx.lineTo(x + 7, y + 7);
          ctx.moveTo(x + 7, y + 1); ctx.lineTo(x + 1, y + 7); ctx.stroke();
        } else {
          ctx.fillStyle = "rgba(125,182,236,.45)"; ctx.fillRect(x + 3, y + 3, 3, 3);
        }
      }
    }
  }

  canvas.parentElement.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    if (!frame) frame = requestAnimationFrame(draw);
  });
  canvas.parentElement.addEventListener("mouseleave", () => {
    mouse = { x: -999, y: -999 };
    if (!frame) frame = requestAnimationFrame(draw);
  });

  let resizeTimer;
  window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(buildDensity, 150); });
  document.fonts.ready.then(buildDensity);
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
