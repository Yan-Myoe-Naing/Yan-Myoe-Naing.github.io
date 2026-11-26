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

## Card previews and interactive demos

Each project card shows a live preview, and its **Try it ▶** button opens an interactive demo in a pop-up.
Link straight to one with `#demo-<slug>`, for example `index.html#demo-emnist`.

| Folder / file | What it does |
|---|---|
| `demos/core.js` | Card previews, the demo pop-up, lazy loading, shared chart style |
| `demos/<slug>.js` | One file per demo (only downloaded when that demo is opened) |
| `demos/demos.css` | Styles for previews, pop-up and demo widgets |
| `demos/data/` | Small JSON files made from each project's notebook or repo, plus the EMNIST model weights |
| `demos/img/` | ERD and workflow images used as previews |
| `vendor/` | Self-hosted [ECharts](https://echarts.apache.org/) 6.1 (Apache-2.0, slim custom build) and [anime.js](https://animejs.com/) 4.5 (MIT) |

To connect a project to a demo, give it a `"slug"` in `projects.json` that matches a demo file
(e.g. `"slug": "house-price"` → `demos/house-price.js`). A project with no slug, or no preview for its slug,
keeps the big-letter card.

How the demo data was made:

- **House Price**: the notebook's final Ridge model (α = 10) rebuilt exactly; same MAE and R².
- **Machine Failure**: a smaller gradient boosting model (250 trees, depth 5) trained the same way so it can run in the browser. Test F1 0.90 vs 0.94 for the notebook's model.
- **Handwritten Letters**: the notebook's final CNN architecture, retrained on synthetic handwriting from 63 fonts, because the original weights aren't in the repo. Runs fully in the browser.
- **Customer Clustering, Energy, Job Market, Graduate Outcomes**: data recomputed by re-running each notebook's own steps.
- **Library pipeline, Q AI**: numbers taken from the repos' validation reports and evaluation results.
- **Library database, Wellness game, CLARITY**: rules and steps taken from the project code (SQL queries, Express middleware, AI prompts).

### Pendulum control with Deep Q-Learning

I trained and tuned a Deep Q-Network to control a simulated pendulum using nine torque values from −2 to +2 N·m. The final network has two 128-unit ReLU layers and was trained for 700 episodes at gravity 10. In ten fixed-seed evaluation episodes, mean return improved from −156.46 to −152.56, a gain of 3.90 points. Multiple training seeds would be needed to measure how consistent that improvement is.

[Try the interactive demo](https://yan-myoe-naing.github.io/#demo-pendulum-dqn). It runs the original checkpoint's weights in JavaScript and compares the greedy policy with zero torque from the same starting angle. The four gravity settings use [Gym 0.17.3 pendulum dynamics](https://github.com/openai/gym/blob/0.17.3/gym/envs/classic_control/pendulum.py). Settings away from gravity 10 show how the default-gravity policy transfers.

The [export script](tools/export_pendulum_model.py) converts the Keras checkpoint to the browser's JSON weights.

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
