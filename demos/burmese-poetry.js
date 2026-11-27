// First six fixed test examples from notebook §12.8. These are recorded outputs.
Demos.register("burmese-poetry", {
  note: "Recorded examples from the held-out test split. The examples compare two decoding methods using the attention GRU. The model chart compares three architectures, including the one-phrase GRU selected on validation.",
  mount(root, api) {
    const examples = [
      [["ဆယ်သင်္ချေဆုံးစေတော့", "ဘုန်းတမေ", "အောင်ပန်းဘိသေ"], "နေနွယ်နတ်ကယ်", "မရှိစေနှင့်", "မရှိစေနှင့်"],
      [["ရွှေနန်းရွှေဘုံ", "အလုံးစုံကို", "အာရုံမျက်မြင်"], "ဖူးမြှော်ခြင်", "မင်းသူကိုလည်း", "မြင်မြင်မြင်သည်"],
      [["အိမ့်ရှေ့ကမူ"], "အုတ်ပလ္လင်နှင့်", "မျက်နှာတော်ရေ", "မယားသခင်"],
      [["ခန္ဓာတွင်းပြင်"], "သန့်ရှင်းစင်", "အရှင်မင်းရှင်", "အရှင်မင်းရှင်"],
      [["ကောင်းစွာဆောက်တည်ကြ", "ရွတ်ဖတ်နေရာ", "သပ်ရပ်စွ"], "ာကောင်းစွာသုတ်သင်ကြ", "စကားသာယာ", "စကားရည်ထင်"],
      [["မြင်သည့်သည်းချာ", "ရွှေဂူသာနှင့်", "လကျ်ာမင်းနန်"], "နန်းရိုးမှန်လျှင်", "နတ်ရှင်ချစ်ရည်", "ချစ်ချစ်ချစ်သည်"],
    ];
    const modelNames = ["One-phrase GRU", "Attention GRU", "Token-only GRU"];
    const metrics = {
      rhyme: { values: [50.7, 43.2, 47.4], note: "The one-phrase GRU had the highest rhyme consistency (50.7%). The rhyme score is an approximation based on Burmese spelling." },
      loops: { values: [4.7, 8.5, 11.9], note: "Lower is better. The one-phrase GRU repeated syllable patterns in 4.7% of continuations, the lowest rate of the three models." },
    };
    root.innerHTML = `
      <div class="demo-toolbar">
        <label class="ctl"><span>Choose a held-out example</span>
          <select data-poetry-example>${examples.map((_, index) => `<option value="${index}">Example ${index + 1}</option>`).join("")}</select>
        </label>
      </div>
      <section class="demo-panel" aria-labelledby="poetry-context-title">
        <h3 class="demo-h" id="poetry-context-title">Poem context</h3>
        <div class="poetry-context poetry-myanmar" lang="my" data-poetry-context></div>
      </section>
      <div class="demo-grid demo-grid--2" aria-live="polite">
        <section class="demo-panel">
          <h3 class="demo-h">Plain sampling</h3>
          <p class="poetry-myanmar" lang="my" data-poetry-plain></p>
        </section>
        <section class="demo-panel">
          <h3 class="demo-h">Rhyme-aware reranking</h3>
          <p class="poetry-myanmar" lang="my" data-poetry-rerank></p>
        </section>
      </div>
      <details class="demo-panel poetry-reference">
        <summary>Reveal the original next phrase</summary>
        <p class="poetry-myanmar" lang="my" data-poetry-original></p>
      </details>
      <section class="demo-panel poetry-results" aria-labelledby="poetry-results-title">
        <h3 class="demo-h" id="poetry-results-title">How the models performed on unseen poems</h3>
        <div class="demo-toolbar">
          <label class="ctl"><span>Compare by</span>
            <select data-poetry-metric><option value="rhyme">Rhyme consistency</option><option value="loops">Repetition loops</option></select>
          </label>
        </div>
        <div class="chart-box chart-box--short" data-poetry-chart role="img" aria-label="Held-out scores for three GRU models"></div>
        <p class="demo-sub" data-poetry-explanation role="status"></p>
      </section>`;
    const find = (selector) => root.querySelector(selector);
    const examplePicker = find("[data-poetry-example]");
    const metricPicker = find("[data-poetry-metric]");
    const chart = api.chart(find("[data-poetry-chart]"), {
      grid: { left: 105, right: 45, top: 10, bottom: 30 },
      xAxis: api.axis({ type: "value", axisLabel: { formatter: "{value}%" } }),
      yAxis: api.axis({ type: "category", inverse: true, data: modelNames }),
      series: [{ type: "bar", label: { show: true, position: "right", formatter: "{c}%" } }],
    });

    function showExample() {
      const [context, original, plain, reranked] = examples[Number(examplePicker.value)];
      find("[data-poetry-context]").replaceChildren(...context.map((phrase) => {
        const line = document.createElement("p");
        line.textContent = phrase;
        return line;
      }));
      find("[data-poetry-plain]").textContent = plain;
      find("[data-poetry-rerank]").textContent = reranked;
      find("[data-poetry-original]").textContent = original;
      find("details").open = false;
    }
    function showMetric() {
      const metric = metrics[metricPicker.value];
      chart.setOption({
        xAxis: { max: metricPicker.value === "rhyme" ? 60 : 15 },
        series: [{ data: metric.values.map((value, index) => ({
          value, itemStyle: { color: index === 0 ? api.colors.orange : api.colors.deep },
        })) }],
      });
      find("[data-poetry-explanation]").textContent = metric.note;
    }
    examplePicker.addEventListener("change", showExample);
    metricPicker.addEventListener("change", showMetric);
    showExample();
    showMetric();
  },
});
