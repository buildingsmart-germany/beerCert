BeerCert
========

Ein spielerisch-ironisches Quiz als statische Web-App. Fragen werden aus "questions.xlsx" geladen und nach Schwierigkeit gefiltert. Deployment via GitHub Pages.

Features
- Schwierigkeit: Easy / Medium / Difficult
- Zufällige Frage aus Excel, Antworten gemischt
- Treffer: Konfetti + augenzwinkernde Texte
- Fehlversuch: freundliches "weiter lernen"
- Tooltips (Tippy.js), modernes UI (Inter, Dark-Card-Design)

Struktur
- index.html: Einstieg und Abhängigkeiten
- styles.css: Look & Feel
- app.js: Logik (Excel laden, filtern, darstellen)
- questions.xlsx: Fragenkatalog (muss im Repo liegen)
- .github/workflows/deploy.yml: GitHub Pages Workflow

Fragenformat (Excel)
Erwartete Spalten (erste Tabelle/Sheet wird gelesen):
- difficulty (easy | medium | hard/difficult)
- category (optional)
- question
- correct
- incorrect1
- incorrect2
- incorrect3

Groß-/Kleinschreibung ist flexibel, alternative deutsche Spaltennamen (schwierigkeit, Frage, richtig) werden erkannt.

Lokale Entwicklung
Öffne index.html in einem statischen Server (wegen fetch):

Python: python3 -m http.server 5173, dann http://localhost:5173 öffnen

Deployment auf GitHub Pages
- Branch main pushen.
- Unter Settings → Pages → Source: "GitHub Actions" wählen (falls noch nicht aktiv).
- Workflow (.github/workflows/deploy.yml) veröffentlicht die Seite automatisch.

Lizenz
MIT


