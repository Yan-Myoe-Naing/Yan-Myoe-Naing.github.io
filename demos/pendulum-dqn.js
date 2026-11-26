/* Browser inference using the original trained Dense weights. */
const pendulumDt = 0.05;
const pendulumSteps = 200;
const pendulumTorques = [-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2];
const pendulumDegrees = (radians) => radians * 180 / Math.PI;
const pendulumAngle = (radians) => Math.atan2(Math.sin(radians), Math.cos(radians));

function pendulumPredict(layers, observation) {
  return layers.reduce((inputs, layer) => layer.bias.map((bias, output) => {
    const value = inputs.reduce((sum, input, index) => sum + input * layer.kernel[index][output], bias);
    return layer.activation === "relu" ? Math.max(0, value) : value;
  }), observation);
}

function pendulumRollout(initialAngle, gravity, policy) {
  let angle = initialAngle;
  let velocity = 0;
  let reward = 0;
  const frames = [{ angle, velocity, reward, torque: 0 }];
  for (let step = 0; step < pendulumSteps; step++) {
    const torque = policy(Math.cos(angle), Math.sin(angle), velocity);
    reward -= pendulumAngle(angle) ** 2 + 0.1 * velocity ** 2 + 0.001 * torque ** 2;
    // Gym 0.17.3 integrates the angle before clipping angular velocity.
    const nextVelocity = velocity + (1.5 * gravity * Math.sin(angle) + 3 * torque) * pendulumDt;
    angle += nextVelocity * pendulumDt;
    velocity = Math.min(8, Math.max(-8, nextVelocity));
    frames.push({ angle, velocity, reward, torque });
  }
  return frames;
}

Demos.register("pendulum-dqn", {
  note: "The browser runs the original trained weights. The checkpoint was trained at gravity 10. Other gravity settings test how that same policy transfers. Notebook evaluation used 10 fixed-seed episodes. Mean reward improved from −156.46 to −152.56, with higher scores closer to zero.",
  async mount(root, api) {
    let disposed = false;
    let timer = null;
    const stop = () => { clearInterval(timer); timer = null; };
    api.onCleanup(() => { disposed = true; stop(); });
    const { layers } = await api.json("pendulum-model.json");
    if (disposed) return;
    root.innerHTML = `
      <div class="demo-toolbar">
        <label class="ctl"><span>Starting angle <b data-angle>150°</b></span>
          <input data-start type="range" min="-180" max="180" step="5" value="150">
        </label>
        <label class="ctl"><span>Gravity</span>
          <select data-gravity>
            <option value="10">10 · Training setting</option>
            <option value="0">0 · Free fall</option>
            <option value="-10">−10 · Inverted gravity</option>
            <option value="15">15 · Supergravity</option>
          </select>
        </label>
        <button class="demo-btn" type="button" data-play>Play</button>
        <button class="demo-btn" type="button" data-reset>Reset</button>
      </div>
      <div class="demo-grid">
        ${[["DQN policy", api.colors.deep], ["Zero torque", api.colors.orange]].map(([label, color]) => `
          <section class="demo-panel">
            <h3 class="demo-h">${label}</h3>
            <svg viewBox="0 0 260 154" width="100%" height="154" aria-hidden="true">
              <circle cx="130" cy="78" r="57" fill="none" stroke="#d9eafb" stroke-dasharray="4 5"/>
              <path d="M130 78V21" fill="none" stroke="#8a8a96" stroke-dasharray="4 5"/>
              <g data-rod>
                <path d="M130 78V21" stroke="${color}" stroke-width="6" stroke-linecap="round"/>
                <circle cx="130" cy="21" r="10" fill="${color}"/>
              </g>
              <circle cx="130" cy="78" r="5" fill="#141419"/>
            </svg>
            <div class="stat-row">
              <div class="stat"><span class="mono">Torque</span><b data-torque></b></div>
              <div class="stat"><span class="mono">Return so far</span><b data-return></b></div>
            </div>
          </section>`).join("")}
      </div>
      <div class="demo-toolbar">
        <label class="ctl"><span>Episode timeline <b data-time></b></span>
          <input data-timeline type="range" min="0" max="200" value="0">
        </label>
      </div>
      <section class="demo-panel">
        <h3 class="demo-h">Angle from upright over the episode</h3>
        <div class="chart-box chart-box--short" data-chart aria-label="DQN and zero torque angle comparison"></div>
      </section>`;

    const select = (selector) => root.querySelector(selector);
    const start = select("[data-start]");
    const gravity = select("[data-gravity]");
    const timeline = select("[data-timeline]");
    const play = select("[data-play]");
    const rods = root.querySelectorAll("[data-rod]");
    const torques = root.querySelectorAll("[data-torque]");
    const returns = root.querySelectorAll("[data-return]");
    let episodes = [];
    let step = 0;
    const chart = api.chart(select("[data-chart]"), {
      animation: false,
      tooltip: { trigger: "axis" },
      legend: { data: ["DQN policy", "Zero torque"] },
      grid: { left: 48, right: 20, top: 35, bottom: 42 },
      xAxis: api.axis({ type: "value", min: 0, max: 10, name: "Seconds", nameLocation: "middle", nameGap: 24 }),
      yAxis: api.axis({ type: "value", min: 0, max: 180, axisLabel: { formatter: "{value}°" } }),
      series: ["DQN policy", "Zero torque"].map((name) => ({ name, type: "line", showSymbol: false })),
    });

    function showFrame() {
      timeline.value = step;
      select("[data-time]").textContent = `${(step * pendulumDt).toFixed(2)} / 10.00 s`;
      episodes.forEach((frames, index) => {
        const state = frames[step];
        rods[index].setAttribute("transform", `rotate(${pendulumDegrees(state.angle)} 130 78)`);
        torques[index].textContent = state.torque.toFixed(1) + " N·m";
        returns[index].textContent = state.reward.toFixed(1);
      });
      play.textContent = timer === null ? (step === pendulumSteps ? "Replay" : "Play") : "Pause";
    }

    function setupEpisode() {
      stop();
      const angle = Number(start.value);
      select("[data-angle]").textContent = angle + "°";
      const policy = (...state) => {
        const values = pendulumPredict(layers, state);
        return pendulumTorques[values.indexOf(Math.max(...values))];
      };
      const initial = angle * Math.PI / 180;
      episodes = [
        pendulumRollout(initial, Number(gravity.value), policy),
        pendulumRollout(initial, Number(gravity.value), () => 0),
      ];
      chart.setOption({
        series: episodes.map((frames) => ({
          data: frames.map(({ angle }, index) => [index * pendulumDt, Math.abs(pendulumDegrees(pendulumAngle(angle)))]),
        })),
      });
      step = 0;
      showFrame();
    }

    start.addEventListener("input", () => { select("[data-angle]").textContent = start.value + "°"; });
    start.addEventListener("change", setupEpisode);
    gravity.addEventListener("change", setupEpisode);
    select("[data-reset]").addEventListener("click", () => { stop(); step = 0; showFrame(); });
    timeline.addEventListener("input", () => { stop(); step = Number(timeline.value); showFrame(); });
    play.addEventListener("click", () => {
      if (timer !== null) {
        stop();
      } else {
        if (step === pendulumSteps) step = 0;
        timer = setInterval(() => {
          step++;
          if (step === pendulumSteps) stop();
          showFrame();
        }, pendulumDt * 1000);
      }
      showFrame();
    });
    setupEpisode();
  },
});
