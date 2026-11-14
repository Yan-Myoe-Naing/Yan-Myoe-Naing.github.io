# Yan Myoe Naing — Portfolio

A one-page portfolio site in plain HTML, CSS and JavaScript (no build step).

## Files

| File | What it does |
|------|--------------|
| `index.html` | Page structure |
| `styles.css` | All styling. Colours and fonts are at the top (`:root`) |
| `app.js` | Loads projects, draws the cards and runs the effects |
| `projects.json` | **Your content.** Name, tagline, skills, and projects |
| `fonts/` | Self-hosted fonts (SIL Open Font License) |

## Adding a new project

There are two ways to do it:

**1. Do nothing (automatic).** Every public, non-fork repo on `Yan-Myoe-Naing` shows up in **All work** by itself.
The title comes from the repo name, and the summary and tag come from the repo's GitHub description and language.
Tip: add a good *About* description and some *Topics* to the repo on GitHub, because those become the summary and tags.

**2. Curate it (nicer card).** Add an entry to the `projects` list in `projects.json`:

```json
{
  "title": "My New Project",
  "repo": "my-new-project",
  "summary": "One or two sentences about what it does and why it matters.",
  "tags": ["Python", "NLP"],
  "categories": ["Machine learning"],
  "featured": true
}
```

- `repo` is the exact repo name on GitHub. It links the card and fills in the year.
- Every project gets a card in the carousel and a row in **All work**. `featured: true` moves it to the front of the carousel.
- Optional: `"demo": "https://..."` adds a demo link, and `"year": "2026"` overrides the year.
- `categories` decides which filter button (above **All work**) shows the project. The buttons are listed in `settings.filter_categories`, and you can rename or add them there.
- Order in the file = order on the site.

To hide a repo, add its name to `settings.hide_repos`.

## After changing styles.css or app.js

In `index.html`, bump the number in `styles.css?v=4` / `app.js?v=4` (e.g. to `v=5`).
This makes visitors' browsers download the new file instead of using an old cached copy.

## Run it locally

`fetch()` doesn't work when you open the file directly from disk, so start a tiny server first:

```powershell
cd portfolio
python -m http.server 8000
```

Then open http://localhost:8000

## Publishing (GitHub Pages)

1. Put these files in a repo called `Yan-Myoe-Naing.github.io`.
2. On GitHub, go to **Settings → Pages**, then set **Source** to *Deploy from a branch*, choose `main`, and pick `/ (root)`.
3. The site goes live at **https://yan-myoe-naing.github.io** about a minute later. Every push updates it.
