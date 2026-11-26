Demos.register("catch-and-go", {
  note: "This walkthrough uses the Power BI report's aggregate results from 200 surveyed residents. The counts describe the sample. Rising Insight 3 and the recommendation sections were my contributions to the team report.",
  mount(root, api) {
    const counts = [
      ["Choa Chu Kang", 3], ["Hougang", 3], ["Sengkang", 3],
      ["Bedok", 2], ["Lakeside", 2], ["Paya Lebar", 2],
    ];
    root.innerHTML = `
      <div class="demo-toolbar">
        <label class="ctl"><span>Explore an MRT area</span>
          <select>${counts.map(([station]) => `<option${station === "Hougang" ? " selected" : ""}>${station}</option>`).join("")}</select>
        </label>
        <div class="stat"><span class="mono">Matching residents</span><b data-count></b></div>
      </div>
      <section class="demo-panel">
        <h3 class="demo-h">Frequent gamers who play for well-being</h3>
        <div class="chart-box" data-chart aria-label="Matching residents by MRT area"></div>
        <p class="demo-sub" data-insight role="status"></p>
      </section>`;
    const control = root.querySelector("select");
    const chart = api.chart(root.querySelector("[data-chart]"), {
      grid: { left: 115, right: 35, top: 12, bottom: 20 },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      xAxis: api.axis({ type: "value", minInterval: 1, max: 4 }),
      yAxis: api.axis({ type: "category", inverse: true, data: counts.map(([station]) => station) }),
      series: [{ type: "bar", label: { show: true, position: "right" } }],
    });

    function showStation() {
      const station = control.value;
      const [, count] = counts.find(([name]) => name === station);
      root.querySelector("[data-count]").textContent = count;
      root.querySelector("[data-insight]").textContent = station === "Hougang"
        ? "Hougang tied for first on motivation. The team recommended it after weighing all five criteria."
        : count === 3
          ? `${station} tied for first on motivation with Hougang and ${station === "Sengkang" ? "Choa Chu Kang" : "Sengkang"}.`
          : `${station} had two matching residents in the sample.`;
      chart.setOption({ series: [{ data: counts.map(([name, value]) => ({
        value, itemStyle: { color: name === station ? api.colors.orange : api.colors.deep },
      })) }] });
    }

    control.addEventListener("change", showStation);
    showStation();
  },
});
