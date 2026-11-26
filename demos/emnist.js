/* Handwritten Letter Recognition — draw a letter, a CNN reads it in your browser.
   Same layers as the notebook's final_model; preprocessing mirrors its Gradio demo.
   Weights load only when this demo opens (~1.3 MB, int8 for the big dense layer). */
Demos.register("emnist", {
  note: "Model: the notebook's final CNN architecture (Conv32 → Conv64 → Dense384, BatchNorm + LeakyReLU). The original trained weights aren't in the repo, so this copy was retrained on synthetic handwriting rendered from 63 fonts in EMNIST format. The notebook's own model scored 94.16% on the real EMNIST test set. Everything runs on your device; nothing is uploaded.",
  charts: false,
  async mount(root, api) {
    root.innerHTML = `
      <div class="draw-demo">
        <div class="draw-demo__pad">
          <canvas id="emPad" width="560" height="560" aria-label="Drawing area: draw one letter"></canvas>
          <p class="draw-demo__hint mono" id="emHint">Draw one letter, A to Z (upper or lower case)</p>
          <div class="row-btns"><button type="button" class="btn-ghost" id="emClear">Clear</button><button type="button" class="btn-ghost" id="emUndo">Undo stroke</button></div>
        </div>
        <div class="draw-demo__out">
          <div class="draw-demo__top"><span class="mono demo-kicker">Prediction</span><b class="draw-demo__letter" id="emLetter">?</b><span class="mono" id="emConf">loading model…</span></div>
          <div class="bars" id="emBars"></div>
          <div class="draw-demo__seen"><canvas id="emSeen" width="28" height="28" aria-label="The 28 by 28 image the model sees"></canvas><p class="mono demo-sub">What the model sees: 28 × 28, white on black, centred in a 20-pixel box, like the notebook's <code>preprocess_gradio_letter()</code>.</p></div>
        </div>
      </div>`;
    const pad = root.querySelector("#emPad"), g = pad.getContext("2d", { willReadFrequently: true });
    const LET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const strokes = []; let current = null, model = null, timer = null;

    // ---------- load weights ----------
    const meta = await api.json("emnist-model.json");
    const buf = await fetch(api.base + "data/emnist-model.bin?v=" + meta.version).then((r) => { if (!r.ok) throw new Error("weights " + r.status); return r.arrayBuffer(); });
    model = {};
    for (const [name, t] of Object.entries(meta.tensors)) {
      if (t.dtype === "f32") model[name] = new Float32Array(buf, t.offset, t.length);
      else { // int8 with one scale per output row
        const q = new Int8Array(buf, t.offset, t.length), s = new Float32Array(buf, t.scaleOffset, t.rows), out = new Float32Array(t.length), cols = t.length / t.rows;
        for (let r = 0; r < t.rows; r++) for (let c = 0; c < cols; c++) out[r * cols + c] = q[r * cols + c] * s[r];
        model[name] = out;
      }
    }
    root.querySelector("#emConf").textContent = "ready: start drawing";

    // ---------- tiny CNN engine (HWC layout, BatchNorm already folded into weights) ----------
    const leaky = (v) => (v > 0 ? v : 0.1 * v);
    function conv3x3(inp, H, W, Cin, w, b, Cout) {          // padding "same"
      const out = new Float32Array(H * W * Cout);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) for (let o = 0; o < Cout; o++) {
        let s = b[o];
        for (let ky = -1; ky <= 1; ky++) { const yy = y + ky; if (yy < 0 || yy >= H) continue;
          for (let kx = -1; kx <= 1; kx++) { const xx = x + kx; if (xx < 0 || xx >= W) continue;
            const ib = (yy * W + xx) * Cin, wb = ((o * 3 + (ky + 1)) * 3 + (kx + 1)) * Cin;
            for (let c = 0; c < Cin; c++) s += inp[ib + c] * w[wb + c];
          } }
        out[(y * W + x) * Cout + o] = leaky(s);
      }
      return out;
    }
    function pool2(inp, H, W, C) {
      const h = H / 2, w = W / 2, out = new Float32Array(h * w * C);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < C; c++) {
        const i = (a, bb) => inp[((2 * y + a) * W + (2 * x + bb)) * C + c];
        out[(y * w + x) * C + c] = Math.max(i(0, 0), i(0, 1), i(1, 0), i(1, 1));
      }
      return out;
    }
    function dense(inp, w, b, n, act) {
      const out = new Float32Array(n), m = inp.length;
      for (let o = 0; o < n; o++) { let s = b[o]; const off = o * m; for (let k = 0; k < m; k++) s += inp[k] * w[off + k]; out[o] = act ? leaky(s) : s; }
      return out;
    }
    function predict(x28) {
      let a = conv3x3(x28, 28, 28, 1, model.c1w, model.c1b, 32); a = pool2(a, 28, 28, 32);
      a = conv3x3(a, 14, 14, 32, model.c2w, model.c2b, 64); a = pool2(a, 14, 14, 64);
      a = dense(a, model.d1w, model.d1b, 384, true);
      const z = dense(a, model.d2w, model.d2b, 26, false);
      const mx = Math.max(...z), e = z.map((v) => Math.exp(v - mx)), s = e.reduce((p, q) => p + q, 0);
      return e.map((v) => v / s);
    }

    // ---------- preprocessing (mirrors preprocess_gradio_letter) ----------
    const seen = root.querySelector("#emSeen"), sg = seen.getContext("2d", { willReadFrequently: true });
    function preprocess() {
      const W = pad.width, H = pad.height, src = g.getImageData(0, 0, W, H).data;
      const ink = new Uint8ClampedArray(W * H);
      let x0 = W, y0 = H, x1 = -1, y1 = -1;
      for (let i = 0; i < W * H; i++) {
        const v = 255 - src[i * 4];                        // invert: white ink on black
        const t = v > 40 ? 255 : 0;                        // threshold weak noise
        ink[i] = t;
        if (t) { const x = i % W, y = (i / W) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
      if (x1 < 0) return null;
      const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
      const crop = document.createElement("canvas"); crop.width = bw; crop.height = bh;
      const cd = crop.getContext("2d").createImageData(bw, bh);
      for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) { const v = ink[(y + y0) * W + (x + x0)], j = (y * bw + x) * 4; cd.data[j] = cd.data[j + 1] = cd.data[j + 2] = v; cd.data[j + 3] = 255; }
      crop.getContext("2d").putImageData(cd, 0, 0);
      // thumbnail: shrink the longest side to 20 px, keep aspect ratio (never enlarge)
      const scale = Math.min(1, 20 / Math.max(bw, bh)), tw = Math.max(1, Math.round(bw * scale)), th = Math.max(1, Math.round(bh * scale));
      let stage = crop;
      while (stage.width / 2 > tw && stage.height / 2 > th) {             // step down for smoother resampling
        const half = document.createElement("canvas"); half.width = Math.ceil(stage.width / 2); half.height = Math.ceil(stage.height / 2);
        const hg = half.getContext("2d"); hg.imageSmoothingQuality = "high"; hg.drawImage(stage, 0, 0, half.width, half.height); stage = half;
      }
      sg.fillStyle = "#000"; sg.fillRect(0, 0, 28, 28);
      sg.imageSmoothingEnabled = true; sg.imageSmoothingQuality = "high";
      sg.drawImage(stage, Math.floor((28 - tw) / 2), Math.floor((28 - th) / 2), tw, th);
      const px = sg.getImageData(0, 0, 28, 28).data, x = new Float32Array(28 * 28);
      for (let i = 0; i < 784; i++) x[i] = px[i * 4] / 255;
      return x;
    }

    // ---------- drawing ----------
    function redraw() {
      g.fillStyle = "#fff"; g.fillRect(0, 0, pad.width, pad.height);
      g.strokeStyle = "#000"; g.lineWidth = pad.width * 0.05; g.lineCap = g.lineJoin = "round";
      for (const s of strokes) { g.beginPath(); s.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); if (s.length === 1) g.lineTo(s[0][0] + 0.1, s[0][1]); g.stroke(); }
    }
    const pos = (e) => { const r = pad.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * pad.width, ((e.clientY - r.top) / r.height) * pad.height]; };
    pad.addEventListener("pointerdown", (e) => { pad.setPointerCapture(e.pointerId); current = [pos(e)]; strokes.push(current); redraw(); root.querySelector("#emHint").classList.add("is-hidden"); });
    pad.addEventListener("pointermove", (e) => { if (!current) return; current.push(pos(e)); redraw(); });
    const end = () => { if (!current) return; current = null; clearTimeout(timer); timer = setTimeout(run, 120); };
    pad.addEventListener("pointerup", end); pad.addEventListener("pointercancel", end);
    root.querySelector("#emClear").addEventListener("click", () => { strokes.length = 0; redraw(); reset(); });
    root.querySelector("#emUndo").addEventListener("click", () => { strokes.pop(); redraw(); strokes.length ? run() : reset(); });
    api.onCleanup(() => clearTimeout(timer));

    const letterEl = root.querySelector("#emLetter"), confEl = root.querySelector("#emConf"), barsEl = root.querySelector("#emBars");
    function reset() { letterEl.textContent = "?"; confEl.textContent = "ready: start drawing"; barsEl.innerHTML = ""; sg.fillStyle = "#000"; sg.fillRect(0, 0, 28, 28); root.querySelector("#emHint").classList.remove("is-hidden"); }
    function run() {
      const x = preprocess(); if (!x) return reset();
      const p = predict(x);
      const top = Array.from(p, (v, i) => [v, i]).sort((a, b) => b[0] - a[0]).slice(0, 5);
      letterEl.textContent = LET[top[0][1]];
      confEl.textContent = `${(top[0][0] * 100).toFixed(1)}% sure`;
      barsEl.innerHTML = top.map(([v, i], k) => `<div class="bar-row"><span>${LET[i]}</span><div class="bar"><i style="width:${Math.max(1, v * 100)}%;${k ? "" : "background:var(--orange)"}"></i></div><b class="mono">${(v * 100).toFixed(1)}%</b></div>`).join("");
      if (api.anime && !api.reduceMotion) api.anime.animate(letterEl, { scale: [0.7, 1], duration: 350, ease: "outBack(2)" });
    }
    redraw(); reset();
  },
});
