/* House Price Prediction — the notebook's final Ridge model (alpha = 10), rebuilt exactly.
   Same features, same RobustScaler on house area, same coefficients. */
Demos.register("house-price", {
  note: "Model: the notebook's final Ridge regression (α = 10), rebuilt with the same features, scaling and train/test split. Test R² 0.525, MAE ≈ $115,884. Prices are from the course dataset, not real listings.",
  async mount(root, api) {
    const m = await api.json("house-price.json");
    const C = api.colors;
    const [areaMin, areaMax] = m.ranges["House Area (sqm)"];
    const state = {
      area: Math.round(m.medians["House Area (sqm)"]),
      bed: m.medians["No. of Bedrooms"], toilet: m.medians["No. of Toilets"],
      stories: m.medians["Stories"], reno: m.medians["Renovation Status"],
    };
    root.innerHTML = `
      <div class="demo-grid">
        <form class="demo-panel demo-controls" onsubmit="return false">
          <h3 class="demo-h">Describe a house</h3>
          <label class="ctl"><span>House area <b id="hpAreaV"></b></span>
            <input type="range" id="hpArea" min="${areaMin}" max="${areaMax}" step="5" value="${state.area}"></label>
          ${stepper("bed", "Bedrooms", m.ranges["No. of Bedrooms"])}
          ${stepper("toilet", "Toilets", m.ranges["No. of Toilets"])}
          ${stepper("stories", "Stories", m.ranges["Stories"])}
          <fieldset class="seg"><legend>Renovation status</legend>
            ${["Unfurnished", "Semi-furnished", "Furnished"].map((t, i) => `<label><input type="radio" name="reno" value="${i}" ${i === state.reno ? "checked" : ""}><span>${t}</span></label>`).join("")}
          </fieldset>
        </form>
        <div class="demo-panel demo-result">
          <p class="mono demo-kicker">Estimated price</p>
          <p class="big-number" id="hpPrice">$0</p>
          <p class="mono demo-sub" id="hpRange"></p>
          <div class="contrib" id="hpContrib" aria-label="How each feature moves the price"></div>
        </div>
        <div class="demo-panel demo-wide">
          <p class="mono demo-kicker">Your house (orange) among the ${m.points.length} houses in the dataset</p>
          <div class="chart-box" id="hpChart"></div>
        </div>
      </div>`;

    function stepper(key, label, [lo, hi]) {
      return `<div class="ctl ctl--step"><span>${label}</span>
        <div class="stepper" data-key="${key}" data-min="${lo}" data-max="${hi}">
          <button type="button" data-d="-1" aria-label="Fewer ${label.toLowerCase()}">−</button>
          <output id="hp_${key}">${state[key]}</output>
          <button type="button" data-d="1" aria-label="More ${label.toLowerCase()}">+</button></div></div>`;
    }

    // price = intercept + Σ coef × feature (area is robust-scaled first)
    function predict(s) {
      const x = [(s.area - m.area_center) / m.area_scale, s.bed, s.toilet, s.stories, s.reno];
      const parts = x.map((v, i) => m.coef[i] * v);
      return { price: m.intercept + parts.reduce((a, b) => a + b, 0), parts };
    }
    const base = predict({ area: m.medians["House Area (sqm)"], bed: m.medians["No. of Bedrooms"], toilet: m.medians["No. of Toilets"], stories: m.medians["Stories"], reno: m.medians["Renovation Status"] });
    const money = (v) => "$" + Math.round(v).toLocaleString("en-US");

    const chart = api.chart(root.querySelector("#hpChart"), {
      grid: { left: 64, right: 16, top: 16, bottom: 40 },
      tooltip: { trigger: "item", formatter: (p) => `${p.value[0]} sqm · ${money(p.value[1])}` },
      xAxis: api.axis({ type: "value", name: "Area (sqm)", nameLocation: "middle", nameGap: 26, min: 100, max: 1700 }),
      yAxis: api.axis({ type: "value", axisLabel: { formatter: (v) => "$" + v / 1e6 + "M", fontFamily: api.fonts.mono, fontSize: 10 } }),
      series: [
        { type: "scatter", data: m.points, symbolSize: 6, itemStyle: { color: C.blue, opacity: 0.6 } },
        { type: "scatter", id: "you", data: [], symbolSize: 18, itemStyle: { color: C.orange, borderColor: "#fff", borderWidth: 2 }, z: 5, animationDurationUpdate: 300 },
      ],
    });

    const priceEl = root.querySelector("#hpPrice"), tweenState = {};
    function update() {
      const r = predict(state);
      const p = Math.max(0, r.price);
      api.tween(priceEl, p, money, tweenState);
      root.querySelector("#hpRange").textContent = `Typical error ±${money(m.mae)} → about ${money(Math.max(0, p - m.mae))} – ${money(p + m.mae)}`;
      root.querySelector("#hpAreaV").textContent = state.area + " sqm";
      ["bed", "toilet", "stories"].forEach((k) => (root.querySelector("#hp_" + k).textContent = state[k]));
      // contribution vs. a median house
      const names = ["Area", "Bedrooms", "Toilets", "Stories", "Renovation"];
      const diffs = r.parts.map((v, i) => v - base.parts[i]);
      const maxAbs = Math.max(...diffs.map(Math.abs), 1);
      root.querySelector("#hpContrib").innerHTML = `<p class="mono demo-sub">Compared with a median house:</p>` + diffs.map((d, i) => `
        <div class="contrib__row"><span>${names[i]}</span>
          <span class="contrib__bar"><i class="${d >= 0 ? "up" : "down"}" style="width:${(Math.abs(d) / maxAbs) * 50}%"></i></span>
          <b class="${d >= 0 ? "up" : "down"}">${d >= 0 ? "+" : "−"}${money(Math.abs(d)).slice(1) === "0" ? "$0" : money(Math.abs(d))}</b></div>`).join("");
      chart.setOption({ series: [{}, { id: "you", data: [[state.area, Math.round(p)]] }] });
    }

    root.querySelector("#hpArea").addEventListener("input", (e) => { state.area = +e.target.value; update(); });
    root.querySelectorAll(".stepper").forEach((s) => s.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      const k = s.dataset.key; state[k] = Math.min(+s.dataset.max, Math.max(+s.dataset.min, state[k] + +b.dataset.d)); update();
    }));
    root.querySelectorAll('input[name="reno"]').forEach((r) => r.addEventListener("change", () => { state.reno = +r.value; update(); }));
    update();
  },
});
