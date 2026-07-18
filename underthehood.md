# under the hood

technical deep-dive into how taperd works — from geometry math to rendering pipelines.

---

## architecture overview

```mermaid
flowchart LR
    subgraph Plugin["figma plugin"]
        UI[ui.html\ncanvas preview] -->|postMessage| Code[code.ts\nvector builder]
        Code --> Figma[figma canvas\neditable vectors]
    end
    subgraph Web["standalone web"]
        WebUI[web/index.html\ncanvas preview + export]
        WebUI --> Export[PNG / JPEG / SVG\ntransparent exports]
    end
    UI -.->|shared rendering logic| WebUI
```

the plugin has two halves:
- **ui.html** runs in an iframe — renders the live canvas preview and all controls
- **code.ts** runs in figma's sandbox — receives messages from the UI and builds vector nodes via the plugin API

the web version is a self-contained single HTML file that reuses the preview rendering logic and adds export functionality.

---

## roll geometry

the tape dispenser is a **cylinder viewed from slightly above-front** — like looking at a cup of coffee on a table from a seated position.

```mermaid
flowchart TD
    subgraph Cylinder["3D cylinder → 2D projection"]
        A["top face → ellipse\n(perspective-squished circle)"] --> B["front wall → rectangle\n(connects top and bottom ovals)"]
        B --> C["bottom edge → ellipse\n(darker, partially hidden)"]
    end
    subgraph Params["key parameters"]
        D["outerR — roll radius"] --> E["capRy = outerR × 0.40\n(perspective squish factor)"]
        D --> F["cylH = tapeHeight\n(wall height = tape width)"]
        D --> G["coreR = outerR × 0.28\n(cardboard tube radius)"]
    end
```

### roll radius calculation

the outer radius of the roll changes based on how much tape has been dispensed:

**infinite mode** (default):
```
outerR = coreR + (maxR - coreR) × (0.28 + 0.72 × e^(-0.0026 × tapeWidth))
```
uses exponential decay — the roll shrinks quickly at first, then plateaus. never fully depletes.

**finite mode**:
```
outerR = sqrt(coreR² + (maxR² - coreR²) × (1 - tapeWidth/maxTape))
```
uses **area-preserving math** — the cross-sectional area of tape on the roll decreases linearly as tape is pulled. this means the radius follows a square-root curve (shrinks slowly when full, fast when nearly empty), which matches real physics.

```mermaid
flowchart LR
    subgraph Finite["finite roll physics"]
        Pull["pull tape"] --> Area["area removed =\nwidth × thickness"]
        Area --> Radius["new radius =\nsqrt(remaining area / pi)"]
        Radius --> Visual["roll visually shrinks\nfollowing sqrt curve"]
    end
```

---

## rendering pipeline

### figma plugin (vector output)

```mermaid
flowchart TD
    Start["buildWashiTape()"] --> Container["create container frame\n(no fill, unclipped)"]
    Container --> Roll{show roll?}
    Roll -->|yes| BottomOval["1. bottom edge ellipse"]
    BottomOval --> Body["2. cylinder body frame\n+ pattern fill"]
    Body --> TopFace["3. top face ellipse"]
    TopFace --> Rings["4. wound tape rings ×3"]
    Rings --> Core["5. core hole ellipse"]
    Roll -->|no| Tape
    Core --> Tape["create tape fill frame\n+ pattern/image fill"]
    Tape --> Mask["create zigzag vector mask\n(M/L/Z path data)"]
    Mask --> Group["group mask + tape\nset isMask = true"]
    Group --> ZOrder["insertChild(0)\ntape behind roll"]
    ZOrder --> Done["append to page\nselect + zoom to view"]
```

key implementation details:

1. **mask workflow**: figma masks require a specific sequence:
   - create the mask shape with a fill
   - insert it adjacent to the target
   - group them together with `figma.group()`
   - set `isMask = true` AFTER grouping
   - mask must be the bottom child in the group

2. **z-ordering**: the tape group is moved to index 0 in the container (`container.insertChild(0, tapeGroup)`) so roll elements render on top — matching the preview where the spool is drawn after the ribbon.

3. **zigzag path**: the serrated edge is built as SVG-style path data:
   ```
   M start → L across top → zigzag down right edge → L across bottom → zigzag up left edge → Z
   ```
   each tooth is a peak-valley pair: `L (x+depth, midY)` then `L (x, bottomY)`

### web version (canvas rendering)

```mermaid
flowchart TD
    Draw["drawPreview()"] --> BG{transparent?}
    BG -->|no| FillBG["fill brown background"]
    BG -->|yes| ClearBG["clear to transparent"]
    FillBG --> Ribbon
    ClearBG --> Ribbon
    Ribbon["draw tape ribbon\n(shadow → fill → pattern → texture → edges)"] --> Zigzag{transparent?}
    Zigzag -->|no| MaskBG["fill background color\nover straight edge"]
    Zigzag -->|yes| CompOut["destination-out compositing\nerase beyond zigzag"]
    MaskBG --> Spool
    CompOut --> Spool
    Spool{show roll?} -->|yes| DrawRoll["draw spool\n(bottom oval → wall → pattern → top face → rings → core)"]
    Spool -->|no| Done2[done]
    DrawRoll --> Done2
```

### zigzag edge technique comparison

| | figma plugin | web (opaque bg) | web (transparent bg) |
|---|---|---|---|
| technique | vector mask with `isMask` | fill background color over edge | `destination-out` compositing |
| how it works | mask shape clips tape frame | brown rectangles cover straight edges, leaving zigzag visible | erase pixels beyond zigzag boundary |
| supports transparency | yes (mask is alpha-based) | no (requires solid bg) | yes (erases to transparent) |

---

## pattern rendering

### built-in patterns

built-in patterns are drawn procedurally — no image assets required.

```mermaid
flowchart LR
    Type{pattern type} -->|botanicals| Icons["5 rotating SVG-like icons\nleaf, tree, flower, bird, berries"]
    Type -->|animals| Cats["cat silhouettes\nellipse body + circle head + triangle ears"]
    Type -->|dots| Dots["varying-size circles\nalternating opacity"]
    Type -->|stars| Stars["5-pointed stars\n5 outer + 5 inner vertices"]
    Type -->|stripes| Stripes["diagonal lines at 45°\n18px spacing"]
    Type -->|checks| Checks["14px alternating squares\ngingham pattern"]
```

in the **figma plugin**, patterns are rendered as inline SVG strings passed to `figma.createNodeFromSvg()`, producing editable vector groups.

in the **web version**, patterns are drawn directly to the canvas context using `beginPath()`, `arc()`, `bezierCurveTo()`, etc.

### custom image patterns

```mermaid
flowchart LR
    Upload["user uploads image"] --> Bytes["FileReader → Uint8Array"]
    Bytes --> FigmaPath["figma: createImage()\n→ imageHash → IMAGE fill"]
    Bytes --> WebPath["web: createObjectURL()\n→ Image() → createPattern()"]
    FigmaPath --> Transform["imageTransform matrix\nhandles scale + rotation + offset"]
    WebPath --> Tile["ctx.createPattern(img, 'repeat')\nor drawImage() for fit mode"]
```

the figma plugin applies pattern transforms via a 2×3 affine matrix:
```
[[cos/scale, -sin/scale, tx],
 [sin/scale,  cos/scale, ty]]
```
where tx/ty incorporate the user's offset values.

---

## texture generation

textures are procedural noise overlays:

```mermaid
flowchart LR
    Create["create 128×128 canvas"] --> Noise["fill ImageData with\nrandom grayscale values"]
    Noise --> Pattern["ctx.createPattern(canvas, 'repeat')"]
    Pattern --> Apply["draw over tape\nwith low opacity"]
```

| texture | pixel strength | alpha range | overlay opacity |
|---|---|---|---|
| paper | 0–25 | 0–18 | 11% |
| rough | 0–55 | 0–44 | 24% |

the noise is regenerated each time the canvas context changes (e.g., during hi-res export).

---

## export pipeline (web)

```mermaid
flowchart TD
    Click["user clicks export"] --> Scale["create offscreen canvas\nat CW×scale, CH×scale"]
    Scale --> Redraw["redraw preview\nwith transparent flag"]
    Redraw --> Format{format?}
    Format -->|PNG| PNG["canvas.toDataURL('image/png')\n→ download"]
    Format -->|JPEG| JPEG["composite onto white bg\n→ toDataURL('image/jpeg', 0.95)\n→ download"]
    Format -->|SVG| SVG["render PNG → embed in\n<svg><image href=dataURL/></svg>\n→ Blob → download"]
```

---

## message protocol (plugin only)

the UI iframe communicates with the plugin backend via `postMessage`:

| message | direction | payload |
|---|---|---|
| `resize` | UI → plugin | `{ height }` |
| `get-frames` | UI → plugin | (none) |
| `frames-list` | plugin → UI | `{ frames: [{id, name}] }` |
| `get-frame-image` | UI → plugin | `{ frameId }` |
| `frame-image` | plugin → UI | `{ bytes, frameId }` |
| `add-to-canvas` | UI → plugin | full TapeMsg object with all parameters |

the `add-to-canvas` message carries ~20 fields covering every customization option, including raw pattern image bytes as a number array.
