/* Customer Clustering — k-means run live on the notebook's 2-component PCA data.
   Pick k, then watch the centroids move step by step. */
Demos.register("customer-clustering", {
  note: "Data: the 198 customers left after the notebook's outlier removal, projected onto its 2 PCA components (71.8% of variance). K-means runs here in your browser, so scores can differ slightly from the notebook, which picked k = 2 (silhouette ≈ 0.42).",
  async mount(root, api) {
    const d = await api.json("customer-clustering.json");
    const C = api.colors;
    const palette = [C.deep, C.orange, C.green, "#8e6cd9", C.amber, C.ink];
    const pts = d.points;
    let k = 2, timer = null, seed = 1;
    root.innerHTML = `
      <div class="demo-grid">
        <div class="demo-panel demo-controls">
          <h3 class="demo-h">Group the customers</h3>
          <label class="ctl"><span>Number of clusters <b id="ccK">2</b></span><input type="range" id="ccSlider" min="2" max="6" value="2"></label>
          <div class="row-btns">
            <button type="button" class="btn-solid" id="ccRun">Run k-means ▶</button>
            <button type="button" class="btn-ghost" id="ccShuffle">New random start</button>
          </div>
          <div class="stat-row">
            <div class="stat"><span class="mono">Step</span><b id="ccStep">0</b></div>
            <div class="stat"><span class="mono">Silhouette</span><b id="ccSil">–</b></div>
          </div>
          <p class="demo-sub">Silhouette closer to 1 means tighter, better-separated groups. Notebook's pick: <b>k = 2</b>.</p>
          <div id="ccProfiles" class="profiles"></div>
        </div>
        <div class="demo-panel demo-wide demo-tall">
          <p class="mono demo-kicker">PC1 ≈ age vs spending · PC2 ≈ income. Hover a dot for that customer.</p>
          <div class="chart-box chart-box--tall" id="ccChart"></div>
        </div>
      </div>`;

    // small seeded random so "New random start" is repeatable
    function rand() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
    const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
    function initCentroids(k) {                          // k-means++ style start
      const c = [pts[Math.floor(rand() * pts.length)].slice(0, 2)];
      while (c.length < k) {
        const w = pts.map((p) => Math.min(...c.map((q) => dist2(p, q))));
        let r = rand() * w.reduce((a, b) => a + b, 0), i = 0;
        while ((r -= w[i]) > 0) i++;
        c.push(pts[i].slice(0, 2));
      }
      return c;
    }
    const assign = (c) => pts.map((p) => c.reduce((best, q, j) => (dist2(p, q) < dist2(p, c[best]) ? j : best), 0));
    function update(c, lab) {
      return c.map((q, j) => {
        const mine = pts.filter((_, i) => lab[i] === j);
        return mine.length ? [mine.reduce((s, p) => s + p[0], 0) / mine.length, mine.reduce((s, p) => s + p[1], 0) / mine.length] : q;
      });
    }
    function silhouette(lab) {
      let total = 0;
      pts.forEach((p, i) => {
        const sums = new Array(k).fill(0), counts = new Array(k).fill(0);
        pts.forEach((q, j) => { if (i !== j) { sums[lab[j]] += Math.sqrt(dist2(p, q)); counts[lab[j]]++; } });
        const a = counts[lab[i]] ? sums[lab[i]] / counts[lab[i]] : 0;
        let b = Infinity; for (let c = 0; c < k; c++) if (c !== lab[i] && counts[c]) b = Math.min(b, sums[c] / counts[c]);
        total += b === Infinity ? 0 : (b - a) / Math.max(a, b);
      });
      return total / pts.length;
    }

    const chart = api.chart(root.querySelector("#ccChart"), {
      grid: { left: 44, right: 16, top: 16, bottom: 40 },
      tooltip: { trigger: "item", formatter: (p) => p.seriesId === "c" ? "Centroid" : `${p.data.raw[5]}, ${p.data.raw[2]} yrs<br>Income $${p.data.raw[3]}k · Spending score ${p.data.raw[4]}` },
      xAxis: api.axis({ type: "value", name: "PC1", nameLocation: "middle", nameGap: 24 }),
      yAxis: api.axis({ type: "value", name: "PC2", nameLocation: "middle", nameGap: 28 }),
      series: [
        { type: "scatter", id: "p", symbolSize: 9, data: [], animationDurationUpdate: 450 },
        { type: "scatter", id: "c", symbol: "diamond", symbolSize: 22, z: 5, data: [], itemStyle: { borderColor: "#fff", borderWidth: 2 }, animationDurationUpdate: 450 },
      ],
    });

    function draw(c, lab, step) {
      chart.setOption({ series: [
        { id: "p", data: pts.map((p, i) => ({ value: [p[0], p[1]], raw: p, itemStyle: { color: lab ? palette[lab[i]] : C.grey, opacity: 0.85 } })) },
        { id: "c", data: c.map((q, j) => ({ value: q, itemStyle: { color: palette[j] } })) },
      ] });
      root.querySelector("#ccStep").textContent = step;
    }
    function profiles(lab) {
      root.querySelector("#ccProfiles").innerHTML = Array.from({ length: k }, (_, j) => {
        const g = pts.filter((_, i) => lab[i] === j); if (!g.length) return "";
        const avg = (n) => Math.round(g.reduce((s, p) => s + p[n], 0) / g.length);
        return `<div class="profile"><i style="background:${palette[j]}"></i><span><b>${g.length} customers</b> · age ${avg(2)} · income $${avg(3)}k · spend ${avg(4)}</span></div>`;
      }).join("");
    }

    function run() {
      clearInterval(timer);
      let c = initCentroids(k), lab = null, step = 0;
      root.querySelector("#ccSil").textContent = "–";
      root.querySelector("#ccProfiles").innerHTML = "";
      draw(c, null, 0);
      const tick = () => {
        const newLab = assign(c); const done = lab && newLab.every((v, i) => v === lab[i]);
        lab = newLab; step++;
        if (done || step > 25) {
          clearInterval(timer);
          draw(c, lab, step);
          root.querySelector("#ccSil").textContent = silhouette(lab).toFixed(3);
          profiles(lab);
          return true;
        }
        c = update(c, lab); draw(c, lab, step);
        return false;
      };
      if (api.reduceMotion) { while (!tick()); }   // no animation: jump straight to the result
      else timer = setInterval(tick, 650);
    }
    api.onCleanup(() => clearInterval(timer));
    root.querySelector("#ccSlider").addEventListener("input", (e) => { k = +e.target.value; root.querySelector("#ccK").textContent = k; run(); });
    root.querySelector("#ccRun").addEventListener("click", run);
    root.querySelector("#ccShuffle").addEventListener("click", () => { seed = Math.floor(Math.random() * 1e6) + 1; run(); });
    run();
  },
});
