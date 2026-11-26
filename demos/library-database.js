/* Library Management Database — the borrowing rules from the repo's SQL queries,
   written as a small checker, next to the ERD. */
Demos.register("library-database", {
  charts: false,
  note: "Rules taken from sql/queries/member_eligibility.sql (age ≥ 16, at most 5 late returns and at most 1 lost book in the last 3 years) and borrowing_eligibility.sql (current loans vs the tier's borrow limit, and the book's minimum tier). Tier names and limits here are examples; the real ones live in the MemberTier table.",
  async mount(root, api) {
    const tiers = [{ name: "Tier 1", limit: 2 }, { name: "Tier 2", limit: 4 }, { name: "Tier 3", limit: 6 }, { name: "Tier 4", limit: 10 }];
    const s = { age: 21, late: 1, lost: 0, tier: 1, loans: 2, bookTier: 1 };
    root.innerHTML = `
      <div class="demo-grid">
        <form class="demo-panel demo-controls" onsubmit="return false">
          <h3 class="demo-h">Member</h3>
          ${num("age", "Age", 10, 90)}
          ${num("late", "Late returns (last 3 years)", 0, 12)}
          ${num("lost", "Lost books (last 3 years)", 0, 5)}
          <label class="ctl"><span>Membership tier</span><select id="ldTier">${tiers.map((t, i) => `<option value="${i}" ${i === s.tier ? "selected" : ""}>${t.name} · borrow limit ${t.limit}</option>`).join("")}</select></label>
          ${num("loans", "Books on loan now (not returned)", 0, 12)}
          <h3 class="demo-h">Book</h3>
          <label class="ctl"><span>Minimum tier needed</span><select id="ldBook">${tiers.map((t, i) => `<option value="${i}" ${i === s.bookTier ? "selected" : ""}>${t.name}</option>`).join("")}</select></label>
        </form>
        <div class="demo-panel demo-result">
          <p class="mono demo-kicker">Can this member borrow the book?</p>
          <p class="verdict-big" id="ldVerdict"></p>
          <ol class="rule-list" id="ldRules"></ol>
        </div>
        <div class="demo-panel demo-wide">
          <p class="mono demo-kicker">The schema behind it (MySQL Workbench ERD)</p>
          <a href="demos/img/library-erd.webp" target="_blank" rel="noopener" class="erd"><img src="demos/img/library-erd.webp" alt="ERD: MemberTier, Member, Staff, Book, BookCopy and Loan tables with their keys" loading="lazy" /></a>
        </div>
      </div>`;
    function num(key, label, lo, hi) {
      return `<label class="ctl"><span>${label} <b id="ld_${key}v">${s[key]}</b></span><input type="range" data-k="${key}" min="${lo}" max="${hi}" value="${s[key]}"></label>`;
    }
    function check() {
      const t = tiers[s.tier];
      const rules = [
        ["Aged 16 or over", s.age >= 16, `${s.age} years old`],
        ["No more than 5 late returns", s.late <= 5, `${s.late} late`],
        ["No more than 1 lost book", s.lost <= 1, `${s.lost} lost`],
        ["Under the tier's borrow limit", s.loans < t.limit, `${s.loans} of ${t.limit} used`],
        ["Tier is high enough for this book", s.tier >= s.bookTier, `${t.name} vs ${tiers[s.bookTier].name} needed`],
      ];
      const ok = rules.every((r) => r[1]);
      const v = root.querySelector("#ldVerdict");
      v.textContent = ok ? "Yes, they can borrow it" : "Not right now";
      v.dataset.ok = ok;
      root.querySelector("#ldRules").innerHTML = rules.map(([name, pass, why]) => `<li class="${pass ? "pass" : "fail"}"><span>${pass ? "✓" : "✕"}</span><b>${name}</b><em class="mono">${why}</em></li>`).join("");
      Object.keys(s).forEach((k) => { const el = root.querySelector(`#ld_${k}v`); if (el) el.textContent = s[k]; });
      if (api.anime && !api.reduceMotion) api.anime.animate(v, { scale: [0.96, 1], duration: 250 });
    }
    root.querySelectorAll('input[type="range"]').forEach((r) => r.addEventListener("input", () => { s[r.dataset.k] = +r.value; check(); }));
    root.querySelector("#ldTier").addEventListener("change", (e) => { s.tier = +e.target.value; check(); });
    root.querySelector("#ldBook").addEventListener("change", (e) => { s.bookTier = +e.target.value; check(); });
    check();
  },
});
