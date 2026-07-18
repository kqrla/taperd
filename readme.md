# taperd

**washi tape generator** — create beautiful, customizable washi tape illustrations as Figma vectors or standalone browser exports.

![taperd](https://img.shields.io/badge/taperd-washi%20tape%20generator-f7f0dd?style=for-the-badge&labelColor=50403a)

taperd lets you design washi tape dispensers with full control over colors, patterns, textures, and roll geometry. use it as a **figma plugin** to drop editable vector tape directly onto your canvas, or as a **standalone web app** to export transparent PNGs, JPEGs, and SVGs.

---

## quick start

### figma plugin

1. install taperd from the figma community (or run locally)
2. open the plugin — you'll see a live preview of your tape
3. customize colors, patterns, size, and texture
4. click **add to canvas** to generate editable vector layers

### web app

1. open `web/index.html` in any modern browser
2. customize your tape using the controls
3. toggle **transparent background** for clean exports
4. export as **PNG**, **JPEG**, or **SVG** at up to 4x resolution

---

## features at a glance

- 6 built-in patterns: botanicals, animals, dots, stars, stripes, checks
- upload custom pattern images
- adjustable tape width, height, opacity
- show/hide roll with finite roll physics
- paper and rough texture overlays
- pattern offset, scale, and rotation controls
- zigzag serrated edges (mask-based in figma, composited in web)
- transparent background exports (PNG, SVG, JPEG)
- 1x to 4x export scaling
- drag-to-pull tape interaction

see [features.md](features.md) for the full breakdown.

---

## project structure

```
taperd/
  manifest.json    # figma plugin manifest
  code.ts          # plugin backend — builds vector tape on canvas
  ui.html          # plugin UI — preview + controls
  web/
    index.html     # standalone browser version
```

---

## how it works

the figma plugin generates real vector nodes (ellipses, frames, vectors) arranged to look like a 3D tape dispenser viewed from above. the tape strip uses a **mask-based zigzag** to create clean serrated edges.

the web version uses **canvas 2D** to render the same illustration, with `destination-out` compositing for transparent zigzag edges.

see [underthehood.md](underthehood.md) for the full technical deep-dive with diagrams.

---

## docs

- [features.md](features.md) — full feature list
- [usecases.md](usecases.md) — who it's for and how they use it
- [underthehood.md](underthehood.md) — technical architecture with mermaid diagrams
- [roadmap.md](roadmap.md) — what's coming next

---

## license

mit
