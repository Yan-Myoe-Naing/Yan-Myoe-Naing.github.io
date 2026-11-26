/* Energy Consumption Forecasting — the notebook's final model per series,
   refit on all 397 months and forecast 60 months ahead (precomputed with statsmodels). */
Demos.register("energy-forecasting", {
  note: "Forecasts were produced with the notebook's final models (statsmodels), refit on the full 1990–2023 history: SARIMA for electricity and water, Holt-Winters for gas. The shaded band is the 95% interval. Test MAPE is on the last 60 held-out months.",
  async mount(root, api) {
    const d = await api.json("energy-forecast.json");
    const C = api.colors;
    let key = "electricity", horizon = 24;
    root.innerHTML = `
      <div class="demo-toolbar">
        <div class="tabs" role="tablist" aria-label="Choose a series">
          ${Object.entries(d.series).map(([k, s]) => `<button role="tab" type="button" data-k="${k}" aria-selected="${k === key}">${s.label}</button>`).join("")}
        </div>
        <label class="ctl ctl--inline"><span>Forecast <b id="efH">24</b> months</span><input type="range" id="efSlider" min="6" max="60" step="6" value="24"></label>
      </div>
      <div class="stat-row stat-row--wide">
        <div class="stat"><span class="mono">Model</span><b id="efModel"></b></div>
        <div class="stat"><span class="mono">Test MAPE</span><b id="efMape"></b></div>
        <div class="stat"><span class="mono">Last month</span><b id="efLast"></b></div>
        <div class="stat"><span class="mono">Forecast at horizon</span><b id="efEnd"></b></div>
      </div>
      <div class="demo-panel demo-flush"><div class="chart-box chart-box--tall" id="efChart"></div></div>`;

    const chart = api.chart(root.querySelector("#efChart"), {
      grid: { left: 56, right: 20, top: 24, bottom: 70 },
      tooltip: { trigger: "axis", valueFormatter: (v) => (v == null ? "–" : Math.round(v * 10) / 10) },
      legend: { top: 0, right: 10, textStyle: { fontFamily: api.fonts.mono, fontSize: 10 }, data: ["History", "Forecast", "95% interval"] },
      dataZoom: [{ type: "inside" }, { type: "slider", height: 18, bottom: 16, borderColor: "transparent", fillerColor: "rgba(125,182,236,.25)", handleStyle: { color: C.deep } }],
      xAxis: api.axis({ type: "category", boundaryGap: false, splitLine: { show: false } }),
      yAxis: api.axis({ type: "value", scale: true }),
      series: [
        { name: "History", type: "line", symbol: "none", lineStyle: { color: C.deep, width: 1.5 }, itemStyle: { color: C.deep } },
        { name: "lower", type: "line", symbol: "none", stack: "ci", lineStyle: { opacity: 0 }, tooltip: { show: false } },
        { name: "95% interval", type: "line", symbol: "none", stack: "ci", lineStyle: { opacity: 0 }, areaStyle: { color: "rgba(255,107,44,.2)" }, itemStyle: { color: "rgba(255,107,44,.4)" } },
        { name: "Forecast", type: "line", symbol: "none", lineStyle: { color: C.orange, width: 2.5 }, itemStyle: { color: C.orange } },
      ],
    });

    function render() {
      const s = d.series[key], n = s.history.length;
      const dates = d.dates.concat(d.future.slice(0, horizon));
      const pad = (arr) => new Array(n).fill(null).concat(arr.slice(0, horizon));
      const fc = pad(s.fc); fc[n - 1] = s.history[n - 1];               // join the forecast line to history
      chart.setOption({
        xAxis: { data: dates },
        dataZoom: [{ startValue: Math.max(0, n - 120) }, { startValue: Math.max(0, n - 120) }],
        series: [
          { data: s.history.concat(new Array(horizon).fill(null)) },
          { data: pad(s.lo) },
          { data: pad(s.hi.map((v, i) => v - s.lo[i])), tooltip: { valueFormatter: (_v) => "" } },
          { data: fc },
        ],
        tooltip: { formatter: (ps) => {
          const i = ps[0].dataIndex, date = dates[i];
          if (i < n) return `${date}<br>Actual: <b>${s.history[i]} ${s.unit}</b>`;
          const j = i - n;
          return `${date}<br>Forecast: <b>${s.fc[j]} ${s.unit}</b><br>95%: ${s.lo[j]} – ${s.hi[j]}`;
        } },
      });
      root.querySelector("#efModel").textContent = s.model;
      root.querySelector("#efMape").textContent = s.test_mape + "%";
      root.querySelector("#efLast").textContent = `${s.history[n - 1]} ${s.unit}`;
      root.querySelector("#efEnd").textContent = `${s.fc[horizon - 1]} ${s.unit}`;
      root.querySelector("#efH").textContent = horizon;
    }
    root.querySelectorAll('[role="tab"]').forEach((b) => b.addEventListener("click", () => {
      key = b.dataset.k;
      root.querySelectorAll('[role="tab"]').forEach((x) => x.setAttribute("aria-selected", x === b));
      render();
    }));
    root.querySelector("#efSlider").addEventListener("input", (e) => { horizon = +e.target.value; render(); });
    render();
  },
});
