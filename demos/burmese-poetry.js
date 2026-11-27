/* Burmese Classical Poetry — the notebook's GRU encoder–decoder with additive attention,
   running in the browser on its trained weights (context_gru_attention_best.weights.h5).
   Visitors write or pick an opening, the model continues it, and every generated syllable
   shows where attention looked. Tokeniser, cleaning and sampling mirror the notebook. */
Demos.register("burmese-poetry", {
  note: "Live model: the notebook's four-phrase context GRU with additive (Bahdanau-style) attention, using its trained weights compressed to 8-bit (≈2.9 MB, downloaded only when you open this demo). Tokenisation, cleaning and sampling (top-k with temperature, no repeated phrases) follow the notebook. Everything runs on your device.",
  async mount(root, api) {
    const C = api.colors, esc = api.esc, A = api.anime;
    const data = await api.json("burmese-poetry.json");
    root.innerHTML = `
      <section class="poem-intro">
        <div>
          <p class="mono demo-kicker">How attention is used here</p>
          <p>An encoder GRU reads up to <b>4 previous phrases</b> syllable by syllable. While the decoder writes each new syllable,
             <b>additive attention</b> scores every context syllable, <code>score = Σ v · tanh(decoder state + encoder state)</code>,
             and mixes them into a context vector. Below, brighter syllables are the ones it is looking at.</p>
        </div>
      </section>
      <div class="demo-grid poem-grid">
        <section class="demo-panel demo-controls">
          <h3 class="demo-h">1 · Give it an opening</h3>
          <label class="ctl"><span>Burmese phrases, one per line (the last 4 are used)</span>
            <textarea id="bpInput" class="poem-input poetry-myanmar" lang="my" rows="3" spellcheck="false"></textarea></label>
          <div class="poem-tokens" id="bpTokens" aria-live="polite"></div>
          <div class="row-btns">
            <button type="button" class="btn-ghost" id="bpRandom">Random held-out opening</button>
          </div>
          <details class="poem-starters"><summary class="mono">Openings from unseen test poems</summary>
            <div class="chips chips--wrap" id="bpStarters"></div></details>
          <h3 class="demo-h">2 · Choose how it writes</h3>
          <label class="ctl"><span>Phrases to write <b id="bpNV">4</b></span><input type="range" id="bpN" min="1" max="8" value="4"></label>
          <label class="ctl"><span>Temperature <b id="bpTV">0.8</b></span><input type="range" id="bpT" min="0.3" max="1.5" step="0.1" value="0.8"></label>
          <label class="ctl"><span>Top-k choices per syllable <b id="bpKV">8</b></span><input type="range" id="bpK" min="1" max="20" value="8"></label>
          <p class="demo-sub">The notebook used temperature 0.8 and top-k 8. Lower = safer and more repetitive; higher = more surprising.</p>
          <div class="row-btns"><button type="button" class="btn-solid" id="bpGo" disabled>Loading model…</button></div>
        </section>
        <section class="demo-panel poem-out">
          <h3 class="demo-h">3 · The continuation</h3>
          <div class="poem-lines poetry-myanmar" lang="my" id="bpOut"><p class="demo-sub">Press <b>Write</b> to generate. Then click any syllable to see what it attended to.</p></div>
        </section>
        <section class="demo-panel demo-wide">
          <div class="split-head"><h3 class="demo-h">Where attention looked <span class="demo-sub" id="bpStepLabel"></span></h3>
            <span class="mono demo-sub">brighter = more attention</span></div>
          <div class="poem-context poetry-myanmar" lang="my" id="bpContext"></div>
          <div class="demo-grid demo-grid--2 poem-detail">
            <div><p class="mono demo-kicker">Attention map for the selected phrase (rows: syllables it wrote · columns: context)</p><div class="chart-box" id="bpHeat"></div></div>
            <div><p class="mono demo-kicker">Top candidates at the selected step (orange = sampled)</p><div class="bars" id="bpCands"></div></div>
          </div>
        </section>
        <section class="demo-panel">
          <h3 class="demo-h">What attention learned</h3>
          <p class="demo-sub">${esc(data.attention_study.note)}. Share of attention vs. what an even spread would give:</p>
          <div class="chart-box chart-box--short" id="bpStudy"></div>
          <p class="demo-sub">It looks hardest at the <b>last syllable of the previous phrase</b> (3× an even share), the position where Burmese rhyme links one phrase to the next.</p>
        </section>
        <section class="demo-panel">
          <h3 class="demo-h">Honest result</h3>
          <p class="demo-sub">Attention was an experiment, not the winner. On 161 unseen poems the simpler one-phrase GRU rhymed more and looped less, so it was selected.</p>
          <div class="chart-box chart-box--short" id="bpModels"></div>
          <div class="tabs" role="tablist" aria-label="Measure"><button role="tab" type="button" data-m="rhyme" aria-selected="true">Rhyme consistency ↑</button><button role="tab" type="button" data-m="loops" aria-selected="false">Repetition loops ↓</button></div>
        </section>
      </div>`;
    const $ = (s) => root.querySelector(s);

    // ---------- tokenizer + cleaning (ported from the notebook, checked on 53,873 phrases) ----------
    const BREAK = new RegExp("((?<!္)[က-အ](?![့]*[်္])|[a-zA-Z0-9ဣဤဥဦဧဩဪဿ၌၍၏၀-၉၊။!-\\/:-@\\[-`{-~\\s])", "gu");
    const isPunct = (t) => /^[\p{P}\s]+$/u.test(t);
    const splitSyllables = (text) => { text = String(text ?? "").normalize("NFC").trim(); if (!text) return []; return text.replace(BREAK, "|$1").split("|").map((s) => s.trim()).filter((s) => s && !isPunct(s)); };
    const REF_ONLY = /^\s*[0-9၀-၉]+(?:\s*မှ\s*[0-9၀-၉]+\s*ထိ)?\s*[၊။]?\s*$/u;
    function cleanPhrase(text) {
      text = String(text).normalize("NFC");
      if (REF_ONLY.test(text)) return null;
      text = text.replaceAll("၄င်း", "၎င်း").replaceAll("၀", "ဝ").replaceAll("‎", "").replace(/[−,+“”.:]/g, " ");
      text = text.replace(/[0-9၁-၉]+/g, " ").replace(/\s+/g, " ").trim().replace(/\s+([၊။])/g, "$1");
      return /[က-အဣဤဥဦဧဩဪဿ]/u.test(text) ? text : null;
    }
    const phrasesFrom = (txt) => txt.split(/[\n၊။]+/).map((s) => s.trim()).filter(Boolean);

    // ---------- model ----------
    const meta = await api.json("burmese-attention.json");
    const TOK = meta.tokens, T2I = new Map(TOK.map((t, i) => [t, i]));
    const PAD = 0, UNK = 1, START = 2, PEND = 3, SEND = 4, U = meta.units, E = meta.embed, V = meta.vocab;
    let W = null;
    const ready = fetch(api.base + "data/burmese-attention.bin?v=" + meta.version).then((r) => { if (!r.ok) throw new Error("weights " + r.status); return r.arrayBuffer(); }).then((buf) => {
      W = {};
      for (const [name, t] of Object.entries(meta.tensors)) {
        const n = t.shape.reduce((a, b) => a * b, 1);
        if (t.dtype === "f32") { W[name] = new Float32Array(buf, t.offset, n); continue; }
        const q = new Int8Array(buf, t.offset, n), [rows, cols] = t.shape, out = new Float32Array(n);
        const sc = new Float32Array(buf, t.scaleOffset, t.mode === "row" ? rows : cols);
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out[r * cols + c] = q[r * cols + c] * (t.mode === "row" ? sc[r] : sc[c]);
        W[name] = out;
      }
    });

    const sig = (x) => 1 / (1 + Math.exp(-x));
    function vecMat(x, k, nIn, nOut, bias) {           // x[nIn] · k[nIn][nOut] + bias
      const out = new Float32Array(nOut); if (bias) out.set(bias);
      for (let i = 0; i < nIn; i++) { const xi = x[i]; if (!xi) continue; const off = i * nOut; for (let j = 0; j < nOut; j++) out[j] += xi * k[off + j]; }
      return out;
    }
    function gru(x, h, k, r, b) {                        // Keras GRU: gates [z | r | h], reset_after = true
      const xi = vecMat(x, k, E, 3 * U, b.subarray(0, 3 * U)), hr = vecMat(h, r, U, 3 * U, b.subarray(3 * U));
      const out = new Float32Array(U);
      for (let j = 0; j < U; j++) {
        const z = sig(xi[j] + hr[j]), rr = sig(xi[U + j] + hr[U + j]);
        const hh = Math.tanh(xi[2 * U + j] + rr * hr[2 * U + j]);
        out[j] = z * h[j] + (1 - z) * hh;
      }
      return out;
    }
    const embed = (table, id) => table.subarray(id * E, id * E + E);
    function encode(ids) {
      let h = new Float32Array(U); const outs = [];
      for (const id of ids) { h = gru(embed(W.eemb, id), h, W.ek, W.er, W.eb); outs.push(h); }
      return { outs, h };
    }
    function decodeStep(tok, h, enc) {
      h = gru(embed(W.demb, tok), h, W.dk, W.dr, W.db);
      const s = enc.map((e) => { let v = 0; for (let j = 0; j < U; j++) v += W.scale[j] * Math.tanh(h[j] + e[j]); return v; });
      const mx = Math.max(...s); let a = s.map((v) => Math.exp(v - mx)); const sum = a.reduce((p, q) => p + q, 0); a = a.map((v) => v / sum);
      const comb = new Float32Array(2 * U); comb.set(h);
      enc.forEach((e, i) => { for (let j = 0; j < U; j++) comb[U + j] += a[i] * e[j]; });
      const logits = vecMat(comb, W.ok, 2 * U, V, W.ob);
      return { h, logits, att: a };
    }
    function contextTokens(phrases) {
      let toks = [];
      for (const p of phrases.slice(-meta.context_phrases)) { const c = cleanPhrase(p); if (c === null) continue; toks.push(...splitSyllables(c), "<PHRASE_END>"); }
      return toks.slice(-meta.encoder_length);
    }
    // seeded random so "Write" is reproducible until you press it again
    let seed = 1;
    const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    function samplePhrase(enc, h, topK, temp) {
      let tok = START; const ids = [], steps = []; let ended = false;
      for (let step = 0; step < meta.decoder_length; step++) {
        const r = decodeStep(tok, h, enc); h = r.h;
        const lg = Array.from(r.logits, (v) => v / temp);
        [PAD, START, UNK].forEach((i) => (lg[i] = -Infinity));
        const cand = lg.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).slice(0, topK);
        const m = cand[0][0], ex = cand.map(([v]) => Math.exp(v - m)), z = ex.reduce((a, b) => a + b, 0), pr = ex.map((v) => v / z);
        let u = rand(), pick = cand.length - 1; for (let i = 0; i < pr.length; i++) { u -= pr[i]; if (u <= 0) { pick = i; break; } }
        const id = cand[pick][1];
        steps.push({ att: r.att, cands: cand.map(([, i], k) => [i, pr[k]]), chosen: id });
        if (id === SEND) { ended = true; break; }
        if (id === PEND || id === PAD) break;
        ids.push(id); tok = id;
      }
      return { ids, steps, ended };
    }

    // ---------- UI state ----------
    const input = $("#bpInput"), out = $("#bpOut"), go = $("#bpGo");
    let result = null, sel = { p: 0, s: 0 }, running = false, alive = true;
    api.onCleanup(() => (alive = false));
    const starters = data.starters;
    $("#bpStarters").innerHTML = starters.map((s, i) => `<button type="button" class="chip-btn poetry-myanmar" lang="my" data-i="${i}">${esc(s[0])}</button>`).join("");
    input.value = starters[0].join("\n");

    function showTokens() {
      const toks = contextTokens(phrasesFrom(input.value));
      $("#bpTokens").innerHTML = toks.length
        ? toks.map((t) => t === "<PHRASE_END>" ? `<span class="tok tok--end" title="phrase end">¶</span>` : `<span class="tok${T2I.has(t) ? "" : " tok--unk"}" title="${T2I.has(t) ? "in vocabulary" : "not in the training vocabulary → <UNK>"}">${esc(t)}</span>`).join("")
          + `<span class="mono demo-sub">${toks.filter((t) => t !== "<PHRASE_END>").length} syllables${toks.some((t) => t !== "<PHRASE_END>" && !T2I.has(t)) ? " · red = unknown to the model" : ""}</span>`
        : `<span class="demo-sub">Type or paste Burmese text (Myanmar Unicode).</span>`;
      go.disabled = !W || !toks.length || running;
    }
    input.addEventListener("input", showTokens);
    $("#bpStarters").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; input.value = starters[+b.dataset.i].join("\n"); showTokens(); });
    $("#bpRandom").addEventListener("click", () => { input.value = starters[Math.floor(Math.random() * starters.length)].join("\n"); showTokens(); });
    [["#bpN", "#bpNV"], ["#bpT", "#bpTV"], ["#bpK", "#bpKV"]].forEach(([r, v]) => $(r).addEventListener("input", () => ($(v).textContent = $(r).value)));

    // attention views
    const heat = api.chart($("#bpHeat"), {
      grid: { left: 64, right: 12, top: 8, bottom: 56 },
      tooltip: { formatter: (p) => `${esc(p.data.out)} → ${esc(p.data.ctx)}<br>attention ${(p.value[2] * 100).toFixed(1)}%` },
      xAxis: { type: "category", data: [], axisLabel: { fontFamily: '"Noto Sans Myanmar","Myanmar Text",sans-serif', fontSize: 12, interval: 0, rotate: 0 }, splitArea: { show: true } },
      yAxis: { type: "category", data: [], inverse: true, axisLabel: { fontFamily: '"Noto Sans Myanmar","Myanmar Text",sans-serif', fontSize: 13 } },
      visualMap: { show: false, min: 0, max: 0.6, inRange: { color: ["#f4f7fb", C.blue, C.deep, C.orange] } },
      series: [{ type: "heatmap", data: [], emphasis: { itemStyle: { borderColor: C.ink, borderWidth: 2 } } }],
    });
    heat.on("click", (p) => { if (p.data) select(sel.p, p.data.row); });

    function paintContext(ctxToks, att) {
      const max = Math.max(...att, 1e-6);
      $("#bpContext").innerHTML = ctxToks.map((t, i) => {
        const w = att[i] / max;
        return `<span class="ctx-tok${t === "<PHRASE_END>" ? " ctx-tok--end" : ""}" style="--w:${w.toFixed(3)}" title="${(att[i] * 100).toFixed(1)}%">${t === "<PHRASE_END>" ? "¶" : esc(t)}<i>${(att[i] * 100).toFixed(0)}%</i></span>`;
      }).join("");
    }
    function select(p, s) {
      if (!result || !result.phrases[p]) return;
      sel = { p, s };
      const ph = result.phrases[p], st = ph.steps[Math.min(s, ph.steps.length - 1)];
      paintContext(ph.ctx, st.att);
      const label = s < ph.ids.length ? `“${TOK[ph.ids[s]]}”` : "the phrase ending";
      $("#bpStepLabel").textContent = `· phrase ${p + 1}, writing ${label}`;
      out.querySelectorAll(".syl").forEach((b) => b.classList.toggle("is-sel", +b.dataset.p === p && +b.dataset.s === s));
      const rows = ph.steps.map((_, k) => (k < ph.ids.length ? TOK[ph.ids[k]] : ph.ended ? "။ end" : "၊ end"));
      const cols = ph.ctx.map((t, i) => (t === "<PHRASE_END>" ? "¶" + "​".repeat(i) : t + "​".repeat(i)));
      heat.setOption({
        xAxis: { data: cols, axisLabel: { formatter: (v) => v.replace(/​/g, "") } }, yAxis: { data: rows },
        series: [{ data: ph.steps.flatMap((stp, r) => stp.att.map((w, c) => ({ value: [c, r, +w.toFixed(4)], out: rows[r], ctx: ph.ctx[c] === "<PHRASE_END>" ? "¶ phrase end" : ph.ctx[c], row: r }))) }],
      });
      $("#bpCands").innerHTML = st.cands.map(([id, pr]) => {
        const name = id === PEND ? "၊ end phrase" : id === SEND ? "။ end stanza" : TOK[id];
        return `<div class="bar-row bar-row--wide"><span class="poetry-myanmar" lang="my">${esc(name)}</span><div class="bar"><i style="width:${Math.max(1, pr * 100)}%;${id === st.chosen ? "background:var(--orange)" : ""}"></i></div><b class="mono">${(pr * 100).toFixed(0)}%</b></div>`;
      }).join("");
    }
    out.addEventListener("click", (e) => { const b = e.target.closest(".syl"); if (b) select(+b.dataset.p, +b.dataset.s); });

    const sleep = (ms) => new Promise((r) => setTimeout(r, api.reduceMotion ? 0 : ms));
    async function write() {
      if (running || !W) return;
      running = true; go.disabled = true; go.textContent = "Writing…";
      seed = Math.floor(Math.random() * 1e9) + 1;
      const nPhr = +$("#bpN").value, temp = +$("#bpT").value, topK = +$("#bpK").value;
      let rolling = phrasesFrom(input.value).slice(-meta.context_phrases);
      result = { phrases: [] }; out.innerHTML = "";
      const seen = new Set();
      for (let n = 0; n < nPhr && alive; n++) {
        const ctx = contextTokens(rolling), ids = ctx.map((t) => T2I.get(t) ?? UNK);
        const { outs, h } = encode(ids);
        let ph = null;
        for (let tries = 0; tries < 5; tries++) { const r = samplePhrase(outs, h, topK, temp); const key = r.ids.join(","); if (r.ids.length && !seen.has(key)) { seen.add(key); ph = r; break; } }
        if (!ph) break;
        ph.ctx = ctx; result.phrases.push(ph);
        const line = document.createElement("p"); line.className = "poem-line"; out.appendChild(line);
        for (let s = 0; s < ph.ids.length && alive; s++) {
          const b = document.createElement("button"); b.type = "button"; b.className = "syl"; b.dataset.p = n; b.dataset.s = s; b.textContent = TOK[ph.ids[s]];
          line.appendChild(b); select(n, s);
          if (A && !api.reduceMotion) A.animate(b, { opacity: [0, 1], y: [8, 0], duration: 260, ease: "out(3)" });
          await sleep(260);
        }
        const mark = document.createElement("span"); mark.className = "poem-mark"; mark.textContent = ph.ended ? "။" : "၊"; line.appendChild(mark);
        rolling = [...rolling, ph.ids.map((i) => TOK[i]).join("")].slice(-meta.context_phrases);
        if (ph.ended) break;
        await sleep(200);
      }
      if (!alive) return;
      if (!result.phrases.length) out.innerHTML = `<p class="demo-sub">The model couldn't produce a new phrase from this opening. Try another opening or a higher temperature.</p>`;
      else select(0, 0);
      running = false; go.textContent = "Write again ▶"; showTokens();
    }
    go.addEventListener("click", write);

    // study + model comparison charts
    const rows = data.attention_study.rows;
    api.chart($("#bpStudy"), {
      grid: { left: 190, right: 30, top: 24, bottom: 20 },
      legend: { top: 0, right: 0, textStyle: { fontFamily: api.fonts.mono, fontSize: 10 } },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (v) => v + "%" },
      xAxis: api.axis({ type: "value", axisLabel: { formatter: "{value}%" } }),
      yAxis: api.axis({ type: "category", inverse: true, data: rows.map((r) => r[0]), splitLine: { show: false }, axisLabel: { fontSize: 10 } }),
      series: [{ name: "Attention", type: "bar", data: rows.map((r) => r[1]), itemStyle: { color: C.orange } }, { name: "Even spread", type: "bar", data: rows.map((r) => r[2]), itemStyle: { color: "#c9d6e6" } }],
    });
    const mChart = api.chart($("#bpModels"), {
      grid: { left: 160, right: 40, top: 8, bottom: 20 },
      xAxis: api.axis({ type: "value", axisLabel: { formatter: "{value}%" } }),
      yAxis: api.axis({ type: "category", inverse: true, data: data.models.names, splitLine: { show: false }, axisLabel: { fontSize: 10 } }),
      series: [{ type: "bar", barWidth: "55%", label: { show: true, position: "right", formatter: "{c}%", fontFamily: api.fonts.mono, fontSize: 10 } }],
    });
    function showModels(m) { mChart.setOption({ series: [{ data: data.models[m].map((v, i) => ({ value: v, itemStyle: { color: i === 1 ? C.orange : C.deep } })) }] }); }
    root.querySelectorAll('[data-m]').forEach((b) => b.addEventListener("click", () => { root.querySelectorAll("[data-m]").forEach((x) => x.setAttribute("aria-selected", x === b)); showModels(b.dataset.m); }));
    showModels("rhyme");

    showTokens();
    try { await ready; } catch (err) { go.textContent = "Model failed to load"; console.error(err); return; }
    if (!alive) return;
    go.textContent = "Write ▶"; showTokens();
    write();
  },
});
