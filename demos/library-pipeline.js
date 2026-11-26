/* Library Data Engineering Pipeline — replay the medallion pipeline with the
   real counts from the repo's silver/gold validation reports. */
Demos.register("library-pipeline", {
  note: "Numbers come from the repo's silver_validation_report.json, gold_validation_report.json and report_query_results.txt. The raw library records are private, so this replays the pipeline's results rather than re-running it on the data.",
  async mount(root, api) {
    const A = api.anime;
    const C = api.colors;
    const silver = { bronze: { members: 301, books: 500, book_copies: 1265, loans: 12345, staff: 51, membership_tiers: 4 },
      rules: [["Member gender values standardised", 301], ["Staff gender values standardised", 51], ["Shifted loan statuses restored", 6], ["Unnamed columns removed", 6], ["Book-copy status spelling corrected", 4], ["Membership borrow limits corrected", 3], ["Member tier ID corrected", 1], ["Book copy marked on loan", 1], ["Outstanding loan status derived", 1], ["Loan rows quarantined", 1]],
      silverLoans: 12344, quarantined: 1, completed: 12343, outstanding: 1 };
    const gold = { rows: 12343, durationDays: 108801, daysLate: 10924, lateLoans: 1045, minDur: 1, maxDur: 35 };
    const genre = [[2020, "Children", 79, 17.17], [2021, "Science", 95, 16.81], [2022, "Research Journal", 138, 18.25], [2023, "Research Journal", 182, 17.48], [2024, "Research Journal", 294, 17.04], [2025, "Research Journal", 1322, 16.96]];

    root.innerHTML = `
      <div class="pipe">
        <div class="pipe__stage" data-s="bronze"><span class="pipe__badge" style="--c:#c98a5a">Bronze</span><p>Raw Excel, CSV &amp; Word files, kept unchanged</p><b class="pipe__count" id="lpB">0</b><span class="mono">loan rows</span></div>
        <div class="pipe__arrow" aria-hidden="true"><i></i></div>
        <div class="pipe__stage" data-s="silver"><span class="pipe__badge" style="--c:#9aa3b2">Silver</span><p>Cleaned, standardised, keys validated → Parquet</p><b class="pipe__count" id="lpS">0</b><span class="mono">loan rows</span></div>
        <div class="pipe__arrow" aria-hidden="true"><i></i></div>
        <div class="pipe__stage" data-s="gold"><span class="pipe__badge" style="--c:#d9a92b">Gold</span><p>Completed loans joined to dimensions, ready for DuckDB</p><b class="pipe__count" id="lpG">0</b><span class="mono">completed loans</span></div>
        <div class="pipe__quarantine" id="lpQ"><span class="pipe__badge" style="--c:${C.red}">Quarantine</span><b id="lpQn">0</b> row kept for review, not deleted</div>
        <div class="pipe__flow" id="lpFlow" aria-hidden="true"></div>
      </div>
      <div class="row-btns row-btns--center"><button type="button" class="btn-solid" id="lpRun">Run pipeline ▶</button><span class="status-pill" id="lpStatus">Not run yet</span></div>
      <div class="demo-grid demo-grid--2">
        <div class="demo-panel"><p class="mono demo-kicker">Silver-layer cleaning rules applied</p><ul class="rules" id="lpRules">${silver.rules.map(([r, n]) => `<li><span>${r}</span><b>${n}</b></li>`).join("")}</ul></div>
        <div class="demo-panel"><p class="mono demo-kicker">Gold checks</p>
          <div class="checks">
            <div><span>Duplicate transaction keys</span><b class="ok">0</b></div>
            <div><span>Missing foreign keys (6 checks)</span><b class="ok">0</b></div>
            <div><span>Total loan days</span><b>${gold.durationDays.toLocaleString()}</b></div>
            <div><span>Total days late</span><b>${gold.daysLate.toLocaleString()}</b></div>
            <div><span>Late loans</span><b>${gold.lateLoans.toLocaleString()} (${((gold.lateLoans / gold.rows) * 100).toFixed(1)}%)</b></div>
            <div><span>Loan length</span><b>${gold.minDur}–${gold.maxDur} days</b></div>
          </div></div>
        <div class="demo-panel demo-wide"><p class="mono demo-kicker">DuckDB report: most popular genre each year (bar = loans in that genre)</p><div class="chart-box chart-box--short" id="lpGenre"></div></div>
      </div>`;

    api.chart(root.querySelector("#lpGenre"), {
      grid: { left: 44, right: 16, top: 12, bottom: 28 },
      tooltip: { trigger: "item", formatter: (p) => `${genre[p.dataIndex][0]}: ${genre[p.dataIndex][1]}<br>${genre[p.dataIndex][2]} loans (${genre[p.dataIndex][3]}% of that year)` },
      xAxis: api.axis({ type: "category", data: genre.map((g) => g[0]), splitLine: { show: false } }),
      yAxis: api.axis({ type: "value" }),
      series: [{ type: "bar", barWidth: "55%", data: genre.map((g) => ({ value: g[2], itemStyle: { color: g[1] === "Research Journal" ? C.deep : C.orange, borderRadius: [4, 4, 0, 0] } })),
        label: { show: true, position: "top", formatter: (p) => genre[p.dataIndex][1], fontFamily: api.fonts.mono, fontSize: 9 } }],
    });

    const flow = root.querySelector("#lpFlow");
    let running = false, alive = true;
    api.onCleanup(() => (alive = false));          // stop updating once the modal closes
    async function run() {
      if (running) return; running = true;
      const status = root.querySelector("#lpStatus");
      status.textContent = "Running…"; status.dataset.state = "run";
      const set = (id, v) => { const el = alive && root.querySelector(id); if (el) el.textContent = Math.round(v).toLocaleString(); };
      ["#lpB", "#lpS", "#lpG", "#lpQn"].forEach((id) => set(id, 0));
      root.querySelectorAll(".pipe__stage, .pipe__quarantine").forEach((s) => s.classList.remove("is-done"));
      root.querySelectorAll("#lpRules li").forEach((li) => li.classList.remove("is-on"));
      const count = (id, to, dur) => new Promise((res) => {
        if (!A || api.reduceMotion) { set(id, to); return res(); }
        const o = { v: 0 }; A.animate(o, { v: to, duration: dur, ease: "out(2)", onUpdate: () => set(id, o.v), onComplete: res });
      });
      const dots = (from, to, n, bad) => new Promise((res) => {
        if (!A || api.reduceMotion) return res();
        flow.innerHTML = "";
        for (let i = 0; i < n; i++) { const d = document.createElement("i"); if (bad && i === Math.floor(n / 2)) d.className = "bad"; flow.appendChild(d); }
        A.animate(flow.querySelectorAll("i:not(.bad)"), { left: [from, to], opacity: [{ to: 1, duration: 120 }, { to: 1, duration: 500 }, { to: 0, duration: 160 }], delay: A.stagger(45), duration: 780, ease: "inOut(2)" });
        const b = flow.querySelector(".bad");
        const done = () => { flow.innerHTML = ""; res(); };
        if (b) A.animate(b, { left: [from, "50%"], top: ["40%", "96%"], backgroundColor: C.red, duration: 900, ease: "inOut(2)", onComplete: done });
        else setTimeout(done, 780 + n * 45);
      });
      const stage = (s) => { const el = alive && root.querySelector(`[data-s="${s}"]`); if (el) el.classList.add("is-done"); };

      await count("#lpB", silver.bronze.loans, 700); stage("bronze");
      await dots("16%", "50%", 14, true);
      const lis = root.querySelectorAll("#lpRules li");
      if (A && !api.reduceMotion) A.animate(lis, { opacity: [0.35, 1], x: [-6, 0], delay: A.stagger(70), duration: 300, onBegin: () => lis.forEach((l) => l.classList.add("is-on")) });
      else lis.forEach((l) => l.classList.add("is-on"));
      await count("#lpS", silver.silverLoans, 700); stage("silver");
      await count("#lpQn", silver.quarantined, 200); if (!alive) return; root.querySelector("#lpQ").classList.add("is-done");
      await dots("50%", "84%", 14, false);
      await count("#lpG", gold.rows, 700); stage("gold");
      if (!alive) return;
      status.textContent = "Validation: PASS"; status.dataset.state = "pass";
      running = false;
    }
    root.querySelector("#lpRun").addEventListener("click", run);
    run();
  },
});
