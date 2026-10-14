# Event website

Static site, no build step. Open `index.html` in a browser, or serve the folder:

    npx serve website

## Add or update speakers

1. Export the approved headshot from Figma (square, at least 400x400) into `assets/speakers/`.
2. Add an entry to `speakers.js` with `name`, `title`, `company`, `bio`, and `photo` (e.g. `assets/speakers/jane-doe.jpg`).

Cards render in the order listed. A speaker without a photo shows their initials.
