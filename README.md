BeerCert
========

A playful, ironic quiz as a static web app, themed for the buildingSMART International Professional Certification — Summit Special (Berlin). It helps warm up minds for digitizing the built environment with openBIM and celebrates competence development.

Features
- Difficulty: Easy / Medium / Difficult
- Random question from Excel, shuffled answers
- Correct: confetti + tongue-in-cheek messages
- Wrong: friendly “learn more” vibes
- Tooltips (Tippy.js), modern UI (Inter, dark card design)

Structure
- index.html: Entry point and dependencies
- styles.css: Look & feel
- app.js: Logic (load Excel, filter, render)
- questions.xlsx: Question bank (must be in the repo)
- .github/workflows/deploy.yml: GitHub Pages workflow

Theme
- Accessible, variable-based theming.
- buildingSMART theme is the default.
- You can still force a theme via URL parameter `?theme=bsi` (persisted in localStorage).

Excel format
Expected columns (first sheet is read):
- difficulty (easy | medium | hard/difficult)
- category (optional)
- question
- correct
- incorrect1
- incorrect2
- incorrect3

Case-insensitive, alternative German column names (schwierigkeit, Frage, richtig) are accepted.

Local development
Serve `index.html` via a static server (because of fetch):

Python: python3 -m http.server 5173, then open http://localhost:5173

Deploy on GitHub Pages
- Push to branch main.
- In Settings → Pages, ensure Source is “GitHub Actions”.
- The workflow (.github/workflows/deploy.yml) publishes the site automatically.

License
MIT


