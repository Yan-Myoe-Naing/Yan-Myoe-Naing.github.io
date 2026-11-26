/* CLARITY — a walkthrough of the AI roles in the code (backend/services/openaiService.js),
   in the order a consultation uses them. No live AI calls. */
Demos.register("clarity", {
  charts: false,
  note: "This is a guided walkthrough, not a live AI. Each step describes one prompt in the project's backend (openaiService.js) and the JSON it is told to return. The real app needs a MySQL database and an OpenAI key, so it can't run on a static site.",
  async mount(root, api) {
    const A = api.anime;
    const steps = [
      { who: "Customer", name: "Interview agent", fn: "askInsuranceAI", does: "Explains coverage in plain language, asks follow-up questions when details are missing, and maps the customer's concerns to Health, Life, Wealth or Legacy planning.", out: ["answer", "follow-up questions", "concerns saved for the advisor"] },
      { who: "Customer", name: "Scheduling agent", fn: "extractSchedulePreferencesAI → selectMeetingSlotAI", does: "Reads availability written in natural language (\"weekday mornings\") and picks only from real advisor slots in the next 7 days. It never invents a time.", out: ["meeting_type", "slot_id", "reason"] },
      { who: "Advisor", name: "Meeting prep agent", fn: "generateAdvisorPrepAI", does: "Summarises the customer's situation for the Financial Representative: the product they seem interested in, questions they asked, points to clarify and missing information.", out: ["summary", "clarification points", "missing information"] },
      { who: "Advisor", name: "Meeting copilot", fn: "generateAdvisorMeetingAssistantAI", does: "Helps the representative explain concepts and draft notes during the meeting. It never makes the final recommendation or promises returns.", out: ["talking points", "draft notes"] },
      { who: "Advisor", name: "Consultation cue agent", fn: "analyzeMeetingStatementAI", does: "Checks each customer statement in the live captions for a misunderstanding (guarantees, returns, exclusions, charges…) and suggests a safe clarification plus a conduct reminder.", out: ["misunderstanding_detected", "issue", "advisor_action", "advisor_conduct_reminder"] },
      { who: "Advisor", name: "Meeting record agent", fn: "generatePostMeetingRecordAI", does: "Writes a factual post-meeting summary from the transcript and checklist. Unfinished checklist items become follow-up tasks; it must not invent decisions or consent.", out: ["summary", "follow_up_tasks[ task, owner, completed ]"] },
      { who: "Advisor", name: "Follow-up agent", fn: "generateCustomerFollowUpAI", does: "Drafts a warm follow-up message from the approved meeting record. The advisor edits and sends it, and it is logged in the activity log.", out: ["subject", "body"] },
    ];
    let i = 0, auto = null;
    root.innerHTML = `
      <div class="journey">
        <div class="journey__lanes" role="tablist" aria-label="Consultation steps">
          ${steps.map((s, k) => `<button type="button" role="tab" class="journey__node" data-k="${k}" data-who="${s.who}"><i>${k + 1}</i><span>${s.name}</span></button>`).join("")}
          <div class="journey__line"><b id="clProgress"></b></div>
        </div>
        <div class="journey__card demo-panel" id="clCard" aria-live="polite"></div>
        <div class="row-btns row-btns--center">
          <button type="button" class="btn-ghost" id="clPrev">← Back</button>
          <button type="button" class="btn-solid" id="clPlay">Play walkthrough ▶</button>
          <button type="button" class="btn-ghost" id="clNext">Next →</button>
        </div>
      </div>`;
    function show(k) {
      i = (k + steps.length) % steps.length;
      const s = steps[i];
      root.querySelectorAll(".journey__node").forEach((n, j) => { n.setAttribute("aria-selected", j === i); n.classList.toggle("is-past", j < i); });
      root.querySelector("#clProgress").style.width = (i / (steps.length - 1)) * 100 + "%";
      const card = root.querySelector("#clCard");
      card.innerHTML = `<p class="mono demo-kicker">${s.who} side · step ${i + 1} of ${steps.length}</p>
        <h3 class="journey__title">${s.name}</h3><p>${s.does}</p>
        <p class="mono demo-sub">Function: <code>${api.esc(s.fn)}</code></p>
        <div class="json-out"><span class="mono">returns</span>${s.out.map((o) => `<code>${api.esc(o)}</code>`).join("")}</div>`;
      if (A && !api.reduceMotion) A.animate(card.children, { opacity: [0, 1], y: [10, 0], delay: A.stagger(60), duration: 380, ease: "out(3)" });
    }
    function stop() { clearInterval(auto); auto = null; root.querySelector("#clPlay").textContent = "Play walkthrough ▶"; }
    root.querySelector(".journey__lanes").addEventListener("click", (e) => { const n = e.target.closest(".journey__node"); if (n) { stop(); show(+n.dataset.k); } });
    root.querySelector("#clPrev").addEventListener("click", () => { stop(); show(i - 1); });
    root.querySelector("#clNext").addEventListener("click", () => { stop(); show(i + 1); });
    root.querySelector("#clPlay").addEventListener("click", (e) => {
      if (auto) return stop();
      e.target.textContent = "Pause ❚❚"; show(i + 1);
      auto = setInterval(() => (i === steps.length - 1 ? stop() : show(i + 1)), 3200);
    });
    api.onCleanup(stop);
    show(0);
  },
});
