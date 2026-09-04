# tetizz / chess lab

The root gateway for the public chess projects at <https://tetizz.github.io/>.

The site is intentionally dependency-free: semantic HTML, one stylesheet, and
an SVG favicon. It is published to GitHub Pages from `main`.

## Validate locally

```powershell
node .github/scripts/validate-static-site.mjs
```

Serve the repository root with any static server for browser testing. For
example: `python -m http.server 4173`.
