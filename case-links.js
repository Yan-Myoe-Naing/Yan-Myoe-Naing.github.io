// Reuse the portfolio's history entry to restore its scroll and filters.
const returnToWork = new URLSearchParams(location.search).get("from") === "work";
const referrer = document.referrer ? new URL(document.referrer) : null;
document.querySelectorAll("[data-case-back]").forEach((link) => {
  if (returnToWork) {
    const url = new URL(link.href);
    url.hash = url.hash.replace(/^#project-/, "#work-");
    link.href = url.href;
  }
  link.addEventListener("click", (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const portfolio = new URL(link.href);
    const root = portfolio.pathname.replace(/index\.html$/, "");
    if (referrer?.origin === portfolio.origin && history.length > 1 &&
        (referrer.pathname === portfolio.pathname || referrer.pathname === root)) {
      event.preventDefault();
      history.back();
    }
  });
});
