/* Q AI — replay the project's 40-case evaluation. Pick a question and watch it go
   through the checking flow to the verdict the eval run recorded. */
Demos.register("q-ai", {
  note: "Replays data/eval/results.json from the Q AI repo (run 19 Nov 2026 with the offline mock checker, which is rule-based and was built alongside these cases, so its scores are optimistic, as the README says). Synthetic bank procedures only; not an OCBC product.",
  async mount(root, api) {
    const d = await api.json("q-ai-eval.json");
    const C = api.colors;
    const A = api.anime;
    const types = { correct: "Correct answer", missing_exception: "Missing exception", outdated_source: "Outdated source", no_evidence: "No evidence" };
    const label = { Green: "Verified", Amber: "Unconfirmed", Red: "Conflicts with policy" };
    const flagText = (f) => f.replace(/_/g, " ");
    let type = "outdated_source", pick = d.rows.find((r) => r.type === type);
    root.innerHTML = `
      <div class="demo-toolbar">
        <div class="tabs" role="tablist" aria-label="Kind of answer">
          ${Object.entries(types).map(([k, t]) => `<button role="tab" type="button" data-t="${k}" aria-selected="${k === type}">${t}</button>`).join("")}
        </div>
      </div>
      <div class="demo-grid">
        <div class="demo-panel demo-controls">
          <h3 class="demo-h">Pick a staff question</h3>
          <ul class="qlist" id="qaList"></ul>
        </div>
        <div class="demo-panel demo-wide-2">
          <ol class="flow" id="qaFlow">
            <li data-s="0"><b>Question check</b><span>Asks for missing details, blocks unsafe requests</span></li>
            <li data-s="1"><b>Copilot answers</b><span>Simulated bank assistant (deliberately imperfect)</span></li>
            <li data-s="2"><b>Check A · rules</b><span>Citation exists, source is current, figures match</span><em id="qaA"></em></li>
            <li data-s="3"><b>Check B · evidence</b><span>Every sentence vs current procedures</span><em id="qaB"></em></li>
            <li data-s="4"><b>Check C · intent</b><span>Was each part of the question answered?</span><em id="qaC"></em></li>
          </ol>
          <div class="verdict-card" id="qaVerdict" aria-live="polite"></div>
        </div>
        <div class="demo-panel demo-wide">
          <p class="mono demo-kicker">Whole evaluation: ${d.summary.cases} cases · verdict accuracy ${Math.round(d.summary.verdict_accuracy * 100)}% · missed errors ${d.summary.missed.count}/${d.summary.missed.of} · false flags ${d.summary.false_flags.count}/${d.summary.false_flags.of}</p>
          <div class="chart-box chart-box--short" id="qaChart"></div>
        </div>
      </div>`;

    const vc = { Green: C.green, Amber: C.amber, Red: C.red };
    const byType = Object.keys(types).map((t) => ["Green", "Amber", "Red"].map((v) => d.rows.filter((r) => r.type === t && r.got === v).length));
    api.chart(root.querySelector("#qaChart"), {
      grid: { left: 130, right: 20, top: 8, bottom: 24 },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      legend: { bottom: 0, textStyle: { fontSize: 10, fontFamily: api.fonts.mono } },
      xAxis: api.axis({ type: "value", max: 10, axisLabel: { show: false } }),
      yAxis: api.axis({ type: "category", data: Object.values(types), splitLine: { show: false } }),
      series: ["Green", "Amber", "Red"].map((v, k) => ({ name: label[v], type: "bar", stack: "v", barWidth: "55%", itemStyle: { color: vc[v] }, data: byType.map((row) => row[k] || null),
        label: { show: true, color: "#fff", fontSize: 10, formatter: (p) => (p.value ? p.value : "") } })),
    });

    function list() {
      const rows = d.rows.filter((r) => r.type === type);
      root.querySelector("#qaList").innerHTML = rows.map((r) => `<li><button type="button" data-id="${r.id}" aria-pressed="${r.id === pick.id}"><span class="mono">${r.id}</span>${api.esc(r.q)}</button></li>`).join("");
    }
    let timers = [];
    function play(r) {
      timers.forEach(clearTimeout); timers = [];
      const steps = root.querySelectorAll("#qaFlow li");
      steps.forEach((s) => s.classList.remove("is-on", "is-pass", "is-fail"));
      ["A", "B", "C"].forEach((k) => (root.querySelector("#qa" + k).textContent = ""));
      const v = root.querySelector("#qaVerdict");
      v.className = "verdict-card"; v.innerHTML = `<p class="mono demo-sub">“${api.esc(r.q)}”</p>`;
      const delay = api.reduceMotion ? 0 : 520;
      steps.forEach((s, k) => timers.push(setTimeout(() => {
        s.classList.add("is-on");
        const key = ["", "", "A", "B", "C"][k];
        if (key) {
          // per_check = whether that check got the expected result; show which flags it raised
          const own = { A: ["outdated_source", "outdated_citation", "figure_mismatch", "no_citation"], B: ["contradicted", "unsupported", "unable_to_verify", "partly_supported", "no_sources", "missing_exception", "conflict_older_source"], C: ["part_partly_answered"] }[key];
          const hits = r.flags.filter((f) => own.includes(f));
          s.classList.add(hits.length ? "is-fail" : "is-pass");
          root.querySelector("#qa" + key).textContent = hits.length ? hits.map(flagText).join(", ") : "no issue";
        }
      }, delay * (k + 1))));
      timers.push(setTimeout(() => {
        v.classList.add("is-" + r.got.toLowerCase());
        v.innerHTML = `<p class="mono demo-sub">“${api.esc(r.q)}”</p>
          <p class="verdict-card__v">${label[r.got]}</p>
          <p class="demo-sub">${r.got === "Green" ? "Safe to use." : r.got === "Amber" ? "Copilot gets one retry; if still unsure, a person checks it." : "Not sent. It goes straight to a human reviewer."}</p>
          <p class="mono demo-sub">Expected: ${label[r.exp]} ${r.exp === r.got ? "✓ match" : "✕ mismatch"}</p>`;
        if (A && !api.reduceMotion) A.animate(v, { scale: [0.94, 1], opacity: [0, 1], duration: 400, ease: "outBack(2)" });
      }, delay * 6));
    }
    api.onCleanup(() => timers.forEach(clearTimeout));
    root.querySelector("#qaList").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; pick = d.rows.find((r) => r.id === b.dataset.id); list(); play(pick); });
    root.querySelectorAll('[role="tab"]').forEach((b) => b.addEventListener("click", () => {
      type = b.dataset.t; root.querySelectorAll('[role="tab"]').forEach((x) => x.setAttribute("aria-selected", x === b));
      pick = d.rows.find((r) => r.type === type); list(); play(pick);
    }));
    list(); play(pick);
  },
});
