/* Singapore Graduate Career Outcomes — compare degree groups and the gender gap.
   Data recomputed by re-running the notebook's processing (ca2_df, mom_df). */
Demos.register("graduate-outcomes", {
  note: "Data: Singapore Graduate Employment Survey records grouped into the notebook's 16 degree groups (2013–2022), plus MOM employment-rate and working-hours tables, all produced by re-running the notebook's processing.",
  async mount(root, api) {
    const d = await api.json("graduate-outcomes.json");
    const C = api.colors;
    const groups = d.groups.filter((g) => g.n >= 5);
    let picked = ["Computing", "Business"].filter((g) => groups.some((x) => x.group === g));
    let year = d.years[d.years.length - 1];
    root.innerHTML = `
      <div class="demo-grid demo-grid--2">
        <div class="demo-panel demo-wide">
          <h3 class="demo-h">Compare degree groups <span class="demo-sub">(pick up to 3)</span></h3>
          <div class="chips chips--wrap" id="gdChips">${groups.map((g) => `<button type="button" class="chip-btn" data-g="${api.esc(g.group)}" aria-pressed="${picked.includes(g.group)}">${api.esc(g.group)}</button>`).join("")}</div>
        </div>
        <div class="demo-panel"><p class="mono demo-kicker">Average basic monthly salary by year (S$)</p><div class="chart-box" id="gdTrend"></div></div>
        <div class="demo-panel"><p class="mono demo-kicker">Salary spread, extra benefit and employment rate</p><div class="cards3" id="gdCards"></div></div>
        <div class="demo-panel demo-wide">
          <div class="split-head"><p class="mono demo-kicker">Employment rate by gender, residents aged 25–64 (%)</p>
            <label class="ctl ctl--inline"><span>Year <b id="gdYear">${year}</b></span><input type="range" id="gdYearR" min="${d.years[0]}" max="${year}" value="${year}"></label></div>
          <div class="gap-viz" id="gdGap"></div>
          <div class="chart-box chart-box--short" id="gdHours"></div>
        </div>
      </div>`;

    const cols = [C.deep, C.orange, C.green];
    const trend = api.chart(root.querySelector("#gdTrend"), {
      grid: { left: 56, right: 14, top: 26, bottom: 30 },
      tooltip: { trigger: "axis", valueFormatter: (v) => (v ? "S$" + v.toLocaleString() : "–") },
      legend: { top: 0, textStyle: { fontSize: 10, fontFamily: api.fonts.mono } },
      xAxis: api.axis({ type: "category", data: d.years, boundaryGap: false, splitLine: { show: false } }),
      yAxis: api.axis({ type: "value", scale: true }),
      series: [],
    });
    api.chart(root.querySelector("#gdHours"), {
      grid: { left: 40, right: 14, top: 26, bottom: 24 },
      title: { text: "Average weekly working hours", left: 0, top: 0, textStyle: { fontFamily: api.fonts.mono, fontSize: 10, fontWeight: 400, color: "#3a3a44" } },
      tooltip: { trigger: "axis" },
      legend: { top: 0, right: 0, textStyle: { fontSize: 10, fontFamily: api.fonts.mono } },
      xAxis: api.axis({ type: "category", data: d.hours.years, boundaryGap: false, splitLine: { show: false } }),
      yAxis: api.axis({ type: "value", min: 38, max: 50 }),
      series: [
        { name: "Male", type: "line", data: d.hours.male, smooth: true, itemStyle: { color: C.deep } },
        { name: "Female", type: "line", data: d.hours.female, smooth: true, itemStyle: { color: C.orange } },
      ],
    });

    function renderGroups() {
      trend.setOption({ series: picked.map((g, i) => ({ name: g, type: "line", smooth: true, symbolSize: 6, itemStyle: { color: cols[i] }, lineStyle: { width: 2.5 },
        data: d.years.map((y) => d.trend[g] && d.trend[g][y] ? d.trend[g][y] : null), connectNulls: true })) }, { replaceMerge: ["series"] });
      root.querySelector("#gdCards").innerHTML = picked.map((name, i) => {
        const g = groups.find((x) => x.group === name);
        const [lo, q1, med, q3, hi] = g.salary, span = (v) => Math.max(0, Math.min(100, ((v - 2000) / (6500 - 2000)) * 100));
        return `<div class="gcard" style="--c:${cols[i]}">
          <b>${api.esc(name)}</b>
          <div class="range" title="Middle half S$${q1}–S$${q3}"><i style="left:${span(q1)}%;width:${span(q3) - span(q1)}%"></i><em style="left:${span(med)}%"></em></div>
          <span class="mono">Median S$${med.toLocaleString()} · middle half S$${q1.toLocaleString()}–${q3.toLocaleString()}</span>
          <span class="mono">Extra benefit S$${g.benefit} · employed ${g.employment}%</span></div>`;
      }).join("") || `<p class="demo-sub">Pick a degree group above.</p>`;
      root.querySelectorAll("#gdChips .chip-btn").forEach((b) => b.setAttribute("aria-pressed", picked.includes(b.dataset.g)));
    }
    function renderGap() {
      const i = d.years.indexOf(year), m = d.emp_male[i], f = d.emp_female[i];
      root.querySelector("#gdGap").innerHTML = `
        <div class="gap-row"><span>Male</span><div class="gap-bar"><i style="width:${m}%;background:${C.deep}"></i></div><b>${m}%</b></div>
        <div class="gap-row"><span>Female</span><div class="gap-bar"><i style="width:${f}%;background:${C.orange}"></i></div><b>${f}%</b></div>
        <p class="mono demo-sub">Gap in ${year}: <b>${(m - f).toFixed(1)} points</b> (was ${(d.emp_male[0] - d.emp_female[0]).toFixed(1)} in ${d.years[0]})</p>`;
      root.querySelector("#gdYear").textContent = year;
    }
    root.querySelector("#gdChips").addEventListener("click", (e) => {
      const b = e.target.closest(".chip-btn"); if (!b) return;
      const g = b.dataset.g;
      if (picked.includes(g)) picked = picked.filter((x) => x !== g);
      else { picked.push(g); if (picked.length > 3) picked.shift(); }
      renderGroups();
    });
    root.querySelector("#gdYearR").addEventListener("input", (e) => { year = +e.target.value; renderGap(); });
    renderGroups(); renderGap();
  },
});
