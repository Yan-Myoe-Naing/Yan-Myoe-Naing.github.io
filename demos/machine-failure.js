/* Machine Failure Detection — gradient boosting running in the browser.
   A lighter copy of the notebook's final model (same 5 features, same split),
   small enough to download: 250 trees of depth 5. */
Demos.register("machine-failure", {
  note: "Browser model: gradient boosting retrained on the project's factory dataset with the notebook's features (Quality removed) and split, but smaller (250 trees, depth 5) so it can run here. Its test F1 is 0.90; the notebook's tuned model scored 0.94 (precision 0.97, recall 0.91).",
  async mount(root, api) {
    const m = await api.json("machine-failure.json");
    const C = api.colors;
    const labels = { "Ambient T (C)": ["Ambient temp", "°C", 0.05], "Process T (C)": ["Process temp", "°C", 0.05], "Rotation Speed (rpm)": ["Rotation speed", "rpm", 1], "Torque (Nm)": ["Torque", "Nm", 0.1], "Tool Wear (min)": ["Tool wear", "min", 1] };
    const x = m.presets.typical.slice();
    root.innerHTML = `
      <div class="demo-grid">
        <div class="demo-panel demo-controls">
          <h3 class="demo-h">Set the machine's readings</h3>
          <div class="chips" role="group" aria-label="Example readings">
            <button type="button" class="chip-btn" data-p="typical">Normal run</button>
            <button type="button" class="chip-btn" data-p="failure">High torque</button>
            <button type="button" class="chip-btn" data-p="failure2">Fast spin, worn tool</button>
          </div>
          ${m.features.map((f, i) => {
            const [name, unit, step] = labels[f]; const [lo, hi] = m.ranges[f];
            return `<label class="ctl"><span>${name} <b id="mf${i}">${x[i]} ${unit}</b></span>
              <input type="range" data-i="${i}" min="${Math.floor(lo)}" max="${Math.ceil(hi)}" step="${step}" value="${x[i]}"></label>`;
          }).join("")}
        </div>
        <div class="demo-panel demo-result">
          <p class="mono demo-kicker">Chance of failure</p>
          <div class="gauge" id="mfGauge"><div class="gauge__fill"></div><span class="gauge__label big-number" id="mfProb">0%</span></div>
          <p class="verdict-pill" id="mfVerdict"></p>
          <p class="mono demo-sub">Threshold 50%, same as <code>predict()</code> in the notebook.</p>
        </div>
        <div class="demo-panel demo-wide">
          <p class="mono demo-kicker">Torque vs tool wear: failures (orange) cluster at high torque or very worn tools. You are the ring.</p>
          <div class="chart-box" id="mfChart"></div>
        </div>
      </div>`;

    // Walk every tree: sum of leaf values → log-odds → probability
    function predict(v) {
      let s = m.prior;
      for (const tree of m.trees) {
        let i = 0;
        while (tree[i].length > 1) i = v[tree[i][0]] <= tree[i][1] ? tree[i][2] : tree[i][3];
        s += m.lr * tree[i][0];
      }
      return 1 / (1 + Math.exp(-s));
    }

    const ok = m.scatter.filter((p) => p[2] === 0).map((p) => [p[0], p[1]]);
    const bad = m.scatter.filter((p) => p[2] === 1).map((p) => [p[0], p[1]]);
    const chart = api.chart(root.querySelector("#mfChart"), {
      grid: { left: 48, right: 16, top: 16, bottom: 40 },
      tooltip: { trigger: "item", formatter: (p) => `Torque ${p.value[0]} Nm · wear ${p.value[1]} min` },
      xAxis: api.axis({ type: "value", name: "Torque (Nm)", nameLocation: "middle", nameGap: 26, scale: true }),
      yAxis: api.axis({ type: "value", name: "Tool wear (min)", nameLocation: "middle", nameGap: 34, scale: true }),
      series: [
        { type: "scatter", data: ok, symbolSize: 4, itemStyle: { color: C.blue, opacity: 0.45 }, large: true },
        { type: "scatter", data: bad, symbolSize: 6, itemStyle: { color: C.orange, opacity: 0.9 } },
        { type: "effectScatter", id: "you", data: [], symbolSize: 16, rippleEffect: { scale: 2.6, brushType: "stroke" }, itemStyle: { color: "transparent", borderColor: C.ink, borderWidth: 3 }, z: 5 },
      ],
    });

    const probEl = root.querySelector("#mfProb"), fill = root.querySelector(".gauge__fill"), tw = {};
    function update() {
      const p = predict(x);
      api.tween(probEl, p * 100, (v) => (v < 1 && v > 0 ? "<1%" : Math.round(v) + "%"), tw);
      fill.style.setProperty("--p", p);
      fill.style.background = p >= 0.5 ? C.orange : p >= 0.2 ? C.amber : C.green;
      const v = root.querySelector("#mfVerdict");
      v.textContent = p >= 0.5 ? "Likely failure: schedule maintenance" : p >= 0.2 ? "Watch closely" : "Running normally";
      v.dataset.level = p >= 0.5 ? "red" : p >= 0.2 ? "amber" : "green";
      m.features.forEach((f, i) => (root.querySelector("#mf" + i).textContent = `${x[i]} ${labels[f][1]}`));
      chart.setOption({ series: [{}, {}, { id: "you", data: [[x[3], x[4]]] }] });
    }
    root.querySelectorAll('input[type="range"]').forEach((r) => r.addEventListener("input", () => { x[+r.dataset.i] = +r.value; update(); }));
    root.querySelectorAll(".chip-btn").forEach((b) => b.addEventListener("click", () => {
      m.presets[b.dataset.p].forEach((v, i) => { x[i] = v; root.querySelector(`input[data-i="${i}"]`).value = v; });
      update();
    }));
    update();
  },
});
