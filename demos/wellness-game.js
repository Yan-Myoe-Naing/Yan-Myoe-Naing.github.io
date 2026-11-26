/* Wellness Challenge Game — a playable mini version using the real rules from the backend:
   challenge points from the seed data, 50 points per city (population 30k–50k),
   15 points per 1,000 soldiers up to army capacity, battle power = army power × soldiers. */
Demos.register("wellness-game", {
  charts: false,
  note: "Rules copied from the game's Express backend (pointServices.js, armyMiddleware.js, battleMiddleware.js, cityMiddleware.js) and the seeded challenges and rival armies in initTables.js. This mini version runs entirely in your browser; nothing is saved.",
  async mount(root, api) {
    const A = api.anime;
    const challenges = [["Fixing sleep schedule", 20, "🌙"], ["Eating Healthy", 20, "🥗"], ["Push ups", 15, "💪"], ["Daily Meditation", 20, "🧘"], ["Drink 2L of water", 15, "💧"], ["Walk 10,000 steps", 25, "👟"]];
    const rivals = [{ name: "Zune's Zenith", soldiers: 800, power: 1.9 }, { name: "George's Eldoria", soldiers: 300, power: 2.3 }];
    const g = { points: 0, done: new Set(), cities: [], log: [] };

    root.innerHTML = `
      <div class="game">
        <div class="game__hud">
          <div class="stat"><span class="mono">Points</span><b id="wgPts">0</b></div>
          <div class="stat"><span class="mono">Cities</span><b id="wgCities">0</b></div>
          <div class="stat"><span class="mono">Soldiers</span><b id="wgSoldiers">0</b></div>
        </div>
        <div class="demo-grid demo-grid--2">
          <div class="demo-panel">
            <h3 class="demo-h">1 · Complete a wellness challenge</h3>
            <div class="challenge-list" id="wgChallenges">${challenges.map(([n, p, e], i) => `<button type="button" class="challenge" data-i="${i}"><span>${e}</span><b>${n}</b><em class="mono">+${p}</em></button>`).join("")}</div>
          </div>
          <div class="demo-panel">
            <h3 class="demo-h">2 · Build &amp; defend</h3>
            <div class="row-btns">
              <button type="button" class="btn-solid" id="wgCity">Found a city · 50 pts</button>
              <button type="button" class="btn-ghost" id="wgArmy">Recruit 1,000 soldiers · 15 pts</button>
            </div>
            <div class="skyline" id="wgSkyline" aria-label="Your cities"></div>
            <h3 class="demo-h">3 · Battle a rival you're at war with</h3>
            <div class="row-btns">${rivals.map((r, i) => `<button type="button" class="btn-ghost" data-rival="${i}">Attack ${r.name} (${r.soldiers} × ${r.power})</button>`).join("")}</div>
          </div>
          <div class="demo-panel demo-wide"><p class="mono demo-kicker">Game log</p><ol class="game-log" id="wgLog"></ol></div>
        </div>
      </div>`;

    const $ = (s) => root.querySelector(s);
    function log(msg, kind) { g.log.unshift([msg, kind]); $("#wgLog").innerHTML = g.log.slice(0, 7).map(([m, k]) => `<li class="${k || ""}">${m}</li>`).join(""); }
    function hud() {
      $("#wgPts").textContent = g.points;
      $("#wgCities").textContent = g.cities.length;
      $("#wgSoldiers").textContent = g.cities.reduce((s, c) => s + c.soldiers, 0).toLocaleString();
      $("#wgCity").disabled = g.points < 50;
      $("#wgArmy").disabled = g.points < 15 || !g.cities.some((c) => c.soldiers + 1000 <= c.capacity);
      root.querySelectorAll("[data-rival]").forEach((b) => (b.disabled = !g.cities.length || rivals[+b.dataset.rival].soldiers === 0));
    }
    function pop(el, text) {
      if (!A || api.reduceMotion) return;
      const f = document.createElement("span"); f.className = "float-pts"; f.textContent = text; el.appendChild(f);
      A.animate(f, { y: [0, -36], opacity: [1, 0], duration: 900, ease: "out(2)", onComplete: () => f.remove() });
    }

    $("#wgChallenges").addEventListener("click", (e) => {
      const b = e.target.closest(".challenge"); if (!b) return;
      const [name, pts] = challenges[+b.dataset.i];
      g.points += pts; g.done.add(+b.dataset.i); b.classList.add("is-done");
      pop(b, "+" + pts); log(`Completed “${name}” → +${pts} points`, "good"); hud();
    });
    $("#wgCity").addEventListener("click", () => {
      if (g.points < 50) return;
      g.points -= 50;
      const names = ["Avalora", "Brightwater", "Calmvale", "Dawnreach", "Evergreen", "Fernhollow"];
      const city = { name: names[g.cities.length % names.length], population: 30000 + Math.floor(Math.random() * 20001), soldiers: 0, capacity: 0, power: +(1.5 + Math.random()).toFixed(2) };
      city.capacity = Math.floor(city.population * 0.072);          // armyMiddleware: max capacity = 7.2% of population
      g.cities.push(city);
      const b = document.createElement("div"); b.className = "tower"; b.style.setProperty("--h", 40 + Math.round((city.population - 30000) / 400) + "%");
      b.innerHTML = `<span>${city.name}<br><em>${city.population.toLocaleString()} people</em></span>`;
      $("#wgSkyline").appendChild(b);
      if (A && !api.reduceMotion) A.animate(b, { scaleY: [0, 1], duration: 600, ease: "outElastic(1, .7)" });
      log(`Founded ${city.name} (population ${city.population.toLocaleString()}, army power ${city.power}) → −50 points`); hud();
    });
    $("#wgArmy").addEventListener("click", () => {
      const c = g.cities.find((x) => x.soldiers + 1000 <= x.capacity);
      if (!c || g.points < 15) return;
      g.points -= 15; c.soldiers += 1000;
      log(`Recruited 1,000 soldiers for ${c.name} (${c.soldiers}/${c.capacity}) → −15 points`); hud();
    });
    root.querySelectorAll("[data-rival]").forEach((b) => b.addEventListener("click", () => {
      const r = rivals[+b.dataset.rival];
      const mine = g.cities.reduce((best, c) => (c.soldiers * c.power > best.soldiers * best.power ? c : best), g.cities[0]);
      const atk = mine.power * mine.soldiers, def = r.power * r.soldiers;
      const lost = mine.soldiers - Math.floor(mine.soldiers / 2);   // the attacking army is halved after every battle
      mine.soldiers = Math.floor(mine.soldiers / 2);
      if (atk > def) { log(`⚔️ ${mine.name} (power ${Math.round(atk)}) beat ${r.name} (${Math.round(def)}): city captured! The attacking army is halved (−${lost}).`, "good"); r.soldiers = 0; r.power = 0; b.disabled = true; b.textContent = `${r.name} captured ✓`; }
      else { log(`⚔️ ${mine.name} (power ${Math.round(atk)}) lost to ${r.name} (${Math.round(def)}). Ties go to the defender. Army halved (−${lost}).`, "bad"); }
      if (A && !api.reduceMotion) A.animate(root.querySelector(".game"), { x: [0, -6, 6, -4, 0], duration: 350 });
      hud();
    }));
    log("Earn points by completing challenges, then spend them on cities and soldiers.");
    hud();
  },
});
