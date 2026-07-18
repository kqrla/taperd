# features

## tape customization

| feature | range | default |
|---|---|---|
| tape width | 60–700px | 260px |
| tape height | 16–120px | 52px |
| opacity | 5–100% | 88% |
| tape color | any hex color | #f7f0dd (warm cream) |

## roll controls

- **show/hide roll** — toggle the 3D tape dispenser spool on or off. when hidden, both edges get zigzag serrations.
- **finite roll** — enables realistic tape depletion physics. the roll shrinks as tape is pulled, calculated using area-preserving math (`sqrt(core² + (max² - core²) * (1 - frac))`).
- **roll geometry** — the spool is a cylinder viewed from slightly above, with perspective-squished ovals for the top face and bottom edge. concentric rings show wound tape layers. the cardboard core is always visible at the center.

## patterns

### built-in patterns

6 hand-crafted patterns rendered as vector paths:

| pattern | description |
|---|---|
| **botanicals** | leaves, trees, flowers, birds, berries — 5 rotating icons |
| **animals** | cat silhouettes with ears and eyes |
| **dots** | varying-size dots with alternating opacity |
| **stars** | 5-pointed stars evenly spaced |
| **stripes** | diagonal lines at 45 degrees |
| **checks** | alternating filled squares (gingham) |

### custom patterns

- **upload image** — use any image as a repeating tile pattern
- **figma frame** (plugin only) — use any frame from your figma file as the pattern source
- **pattern offset** — shift pattern position X/Y (-100 to 100)
- **pattern scale** — resize pattern (0.25x to 3x)
- **pattern rotation** — rotate pattern (0–360 degrees)
- **repeat toggle** — tile the pattern or fit-to-fill

## textures

| texture | effect |
|---|---|
| none | clean, flat surface |
| paper | subtle noise overlay (18 alpha, 25 strength) — mimics washi paper fiber |
| rough | heavier noise (44 alpha, 55 strength) — rougher, more tactile feel |

textures are generated as 128x128 noise canvases tiled across the tape surface.

## ink color

the pattern ink color is fully customizable. defaults to #1a1a1a (near-black). applies to all built-in patterns.

## zigzag serrations

- right edge always has zigzag teeth
- left edge gets zigzag only when roll is hidden
- tooth height: 8px (figma) / 14px (web preview)
- tooth depth: 5px (figma) / 8px (web preview)
- tooth count adapts to tape height

### figma implementation

uses a **vector mask** — a filled zigzag-shaped vector clips the tape frame. the mask is the bottom child of a group, with `isMask = true`.

### web implementation

uses **background-color masking** (normal mode) or **`destination-out` compositing** (transparent mode) to carve zigzag edges.

## export (web only)

| format | transparency | notes |
|---|---|---|
| PNG | yes | full alpha channel |
| SVG | yes | PNG embedded in SVG container |
| JPEG | no | composited onto white background |

- export scale: 1x, 2x, 3x, 4x
- transparent background toggle with checkerboard preview

## interactions

- **drag to pull** — grab the right edge of the tape ribbon and drag to extend/retract. works with mouse and touch.
- **auto-resize** (plugin) — the plugin UI resizes to fit content
- **frame pattern source** (plugin) — select any figma frame as pattern source with live preview

## figma output

the plugin generates a clean, editable layer tree:

```
washi tape (frame, no fill, unclipped)
  tape strip (group, opacity + shadow)
    tape shape (vector mask — zigzag outline)
    tape fill (frame — solid color + pattern)
  core hole (ellipse — cardboard brown)
  ring (ellipse — wound tape layer) ×3
  top face (ellipse — tape color)
  cylinder body (frame — pattern + shadow)
  bottom edge (ellipse — darker tape color)
```

the tape group is placed at z-index 0 so the roll renders on top, matching the preview.
