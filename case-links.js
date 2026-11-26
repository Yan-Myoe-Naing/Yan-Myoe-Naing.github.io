// Return readers from a case study to its row when they entered through All work.
if (new URLSearchParams(location.search).get("from") === "work") {
  document.querySelectorAll("[data-case-back]").forEach((link) => {
    const url = new URL(link.href);
    url.hash = url.hash.replace(/^#project-/, "#work-");
    link.href = url.href;
  });
}
