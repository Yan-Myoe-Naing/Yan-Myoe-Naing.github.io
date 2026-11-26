/* Job Market Application Analysis — explore the top 10 most-applied job titles.
   Data recomputed from the notebook's own cleaning steps (df_top). */
Demos.register("job-market", {
  note: "Data: 1,489 postings for the 10 most-applied titles, produced by re-running the notebook's cleaning steps (salaries normalised to an hourly rate). The averages match the notebook exactly.",
  async mount(root, api) {
    const d = await api.json("job-market.json");
    const C = api.colors;
    const T = d.titles;
    const metrics = {
      avg_hourly: { label: "Avg hourly salary", fmt: (v) => "$" + v.toFixed(2) },
      applies: { label: "Applications", fmt: (v) => v.toLocaleString() },
      views: { label: "Views", fmt: (v) => v.toLocaleString() },
      rate: { label: "Applies per 100 views", fmt: (v) => v.toFixed(1) },
    };
    T.forEach((t) => (t.rate = t.views ? (t.applies / t.views) * 100 : 0));
    let metric = "avg_hourly", selected = null;
    const levels = d.experience.filter((e) => e.n >= 10);   // Director (2) and Executive (1) are too small to show as boxes
    root.innerHTML = `
      <div class="demo-toolbar">
        <div class="tabs" role="tablist" aria-label="Choose a measure">
          ${Object.entries(metrics).map(([k, m]) => `<button role="tab" type="button" data-k="${k}" aria-selected="${k === metric}">${m.label}</button>`).join("")}
        </div>
      </div>
      <div class="demo-grid demo-grid--2">
        <div class="demo-panel"><p class="mono demo-kicker">Click a bar to highlight that job</p><div class="chart-box chart-box--tall" id="jmBars"></div></div>
        <div class="demo-panel"><p class="mono demo-kicker" id="jmScatterTitle">Salary vs applications per posting</p><div class="chart-box chart-box--tall" id="jmScatter"></div></div>
        <div class="demo-panel demo-wide"><p class="mono demo-kicker">Hourly salary by experience level (after the notebook's IQR filter; levels with fewer than 10 postings left out)</p><div class="chart-box" id="jmBox"></div></div>
      </div>`;

    const bars = api.chart(root.querySelector("#jmBars"), {
      grid: { left: 150, right: 56, top: 8, bottom: 20 },
      tooltip: { show: false },
      xAxis: api.axis({ type: "value", axisLabel: { show: false } }),
      yAxis: api.axis({ type: "category", inverse: true, splitLine: { show: false }, axisLabel: { fontFamily: api.fonts.ui, fontSize: 11, color: "#3a3a44" } }),
      series: [{ type: "bar", barWidth: "60%", label: { show: true, position: "right", fontFamily: api.fonts.mono, fontSize: 10 }, animationDurationUpdate: 600 }],
    });
    const scatter = api.chart(root.querySelector("#jmScatter"), {
      grid: { left: 48, right: 14, top: 12, bottom: 40 },
      tooltip: { trigger: "item", formatter: (p) => `${T[p.value[2]].title}<br>$${p.value[0]}/hr · ${p.value[1]} applications` },
      xAxis: api.axis({ type: "value", name: "Hourly salary ($)", nameLocation: "middle", nameGap: 24 }),
      yAxis: api.axis({ type: "log", name: "Applications", nameLocation: "middle", nameGap: 34, min: 1 }),
      series: [{ type: "scatter", symbolSize: 6, animationDurationUpdate: 400 }],
    });
    api.chart(root.querySelector("#jmBox"), {
      grid: { left: 120, right: 20, top: 10, bottom: 30 },
      tooltip: { trigger: "item", formatter: (p) => { const q = p.data.q; return `${p.name} (n=${p.data.n})<br>Median $${q[2]}/hr<br>Middle half: $${q[1]} – $${q[3]}`; } },
      xAxis: api.axis({ type: "value", name: "$ / hour", nameLocation: "middle", nameGap: 22 }),
      yAxis: api.axis({ type: "category", data: levels.map((e) => e.level), splitLine: { show: false } }),
      series: [{ type: "boxplot", data: levels.map((e) => ({ value: e.q, q: e.q, n: e.n, name: e.level })), itemStyle: { color: C.pale, borderColor: C.deep, borderWidth: 1.5 } }],
    });

    function render() {
      const order = [...T].sort((a, b) => b[metric] - a[metric]);
      bars.setOption({
        yAxis: { data: order.map((t) => t.title) },
        series: [{ data: order.map((t) => ({ value: +t[metric].toFixed(2), itemStyle: { color: selected === null || T[selected].title === t.title ? C.deep : "#c7dcf0", borderRadius: [0, 4, 4, 0] } })),
          label: { formatter: (p) => metrics[metric].fmt(p.value) } }],
      });
      scatter.setOption({ series: [{ data: d.points.filter((p) => p[1] > 0).map((p) => ({ value: p, itemStyle: { color: selected === null ? C.deep : p[2] === selected ? C.orange : "rgba(125,182,236,.25)", opacity: selected === null ? 0.5 : 1 } })) }] });
      root.querySelector("#jmScatterTitle").textContent = selected === null ? "Salary vs applications per posting" : `${T[selected].title}: ${T[selected].postings} postings, avg $${T[selected].avg_hourly}/hr`;
    }
    bars.on("click", (p) => { const i = T.findIndex((t) => t.title === p.name); selected = selected === i ? null : i; render(); });
    root.querySelectorAll('[role="tab"]').forEach((b) => b.addEventListener("click", () => {
      metric = b.dataset.k; root.querySelectorAll('[role="tab"]').forEach((x) => x.setAttribute("aria-selected", x === b)); render();
    }));
    render();
  },
});
