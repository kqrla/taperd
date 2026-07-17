const TOOL_ID = 'taperd'
const DISPLAY_NAME = 'taperd'

figma.root.setRelaunchData({ [TOOL_ID]: DISPLAY_NAME })
figma.showUI(__html__, { width: 400, height: 660 })

figma.ui.onmessage = async (msg: { type: string; [key: string]: unknown }) => {
  if (msg.type === 'resize') {
    figma.ui.resize(400, Math.max(400, Math.min(900, Math.round(msg.height as number))))
    return
  }
  if (msg.type === 'get-frames') {
    const frames = figma.currentPage.children
      .filter((n): n is FrameNode | ComponentNode => n.type === 'FRAME' || n.type === 'COMPONENT')
      .slice(0, 60).map(f => ({ id: f.id, name: f.name }))
    figma.ui.postMessage({ type: 'frames-list', frames })
    return
  }
  if (msg.type === 'get-frame-image') {
    const node = await figma.getNodeByIdAsync(msg.frameId as string)
    if (node && 'exportAsync' in node) {
      const bytes = await (node as FrameNode).exportAsync({ format: 'PNG', constraint: { type: 'WIDTH', value: 400 } })
      figma.ui.postMessage({ type: 'frame-image', bytes: Array.from(bytes), frameId: msg.frameId })
    }
    return
  }
  if (msg.type === 'add-to-canvas') {
    await buildWashiTape(msg as unknown as TapeMsg)
    figma.notify('washi tape added')
  }
}

interface TapeMsg {
  tapeWidth: number; tapeHeight: number; opacity: number
  tapeColor: { r: number; g: number; b: number }
  showRoll: boolean; finiteRoll: boolean; tornEdge: boolean; texture: string
  patternSource: string; patternType: string
  patternColor: { r: number; g: number; b: number; a: number }
  patternRepeat: boolean; patternBytes: number[] | null
  patternOffsetX: number; patternOffsetY: number
  patternScale: number; patternRotation: number
  rollOuterR: number
}

function dk(c: { r: number; g: number; b: number }, a: number) {
  return { r: Math.max(0, c.r - a), g: Math.max(0, c.g - a), b: Math.max(0, c.b - a) }
}

async function buildWashiTape(p: TapeMsg): Promise<void> {
  const tw = Math.max(40, p.tapeWidth)
  const th = Math.max(10, p.tapeHeight)
  const tc = p.tapeColor

  const maxR = th * 1.55
  const coreR = maxR * 0.28
  const outerR = p.showRoll
    ? Math.max(coreR + 2, maxR * Math.max(0.04, p.rollOuterR))
    : 0
  const capRy = outerR * 0.40
  const cylH = th

  const margin = 12
  const rollCx = outerR + margin
  const totalRollH = cylH + capRy * 2 + margin * 2
  const totalH = Math.max(totalRollH, th + margin * 2)
  const rollCy = totalH / 2

  const tapeX = p.showRoll ? Math.round(rollCx + outerR - 6) : margin
  const tapeY = Math.round((totalH - th) / 2)
  const totalW = Math.max(1, tapeX + tw + margin)

  const container = figma.createFrame()
  container.name = 'washi tape'
  container.fills = []
  container.clipsContent = false
  container.resize(Math.max(1, totalW), Math.max(1, totalH))
  container.x = Math.round(figma.viewport.center.x - totalW / 2)
  container.y = Math.round(figma.viewport.center.y - totalH / 2)

  // ── Roll ─────────────────────────────────────────────────────────────
  if (p.showRoll) {
    const botOval = figma.createEllipse()
    botOval.name = 'bottom edge'
    botOval.resize(Math.max(1, outerR * 2), Math.max(1, capRy * 2))
    botOval.x = Math.round(rollCx - outerR)
    botOval.y = Math.round(rollCy + cylH / 2 - capRy)
    botOval.fills = [{ type: 'SOLID', color: dk(tc, 0.10) }]
    botOval.strokes = [{ type: 'SOLID', color: dk(tc, 0.22) }]
    botOval.strokeWeight = 1.5
    container.appendChild(botOval)

    const body = figma.createFrame()
    body.name = 'cylinder body'
    body.resize(Math.max(1, outerR * 2), Math.max(1, cylH))
    body.x = Math.round(rollCx - outerR)
    body.y = Math.round(rollCy - cylH / 2)
    body.fills = [{ type: 'SOLID', color: dk(tc, 0.06) }]
    body.clipsContent = true
    body.effects = [{
      type: 'DROP_SHADOW',
      color: { r: 0, g: 0, b: 0, a: 0.18 },
      offset: { x: 2, y: Math.round(cylH * 0.4 + capRy) },
      radius: 12, spread: 0, visible: true, blendMode: 'NORMAL'
    }]

    if (p.patternBytes && p.patternBytes.length > 0) {
      const img = figma.createImage(new Uint8Array(p.patternBytes))
      body.fills = [body.fills[0] as SolidPaint, {
        type: 'IMAGE', scaleMode: 'TILE', imageHash: img.hash, opacity: 0.75
      } as ImagePaint]
    } else if (p.patternSource === 'builtin') {
      const svg = buildPatternSvg(p.patternType, p.patternColor, outerR * 2, cylH)
      try {
        const svgN = figma.createNodeFromSvg(svg)
        svgN.name = 'body pattern'
        svgN.resize(Math.max(1, outerR * 2), Math.max(1, cylH))
        svgN.x = 0; svgN.y = 0
        body.appendChild(svgN)
      } catch (_e) { /* skip */ }
    }
    container.appendChild(body)

    const topFace = figma.createEllipse()
    topFace.name = 'top face'
    topFace.resize(Math.max(1, outerR * 2), Math.max(1, capRy * 2))
    topFace.x = Math.round(rollCx - outerR)
    topFace.y = Math.round(rollCy - cylH / 2 - capRy)
    topFace.fills = [{ type: 'SOLID', color: tc }]
    topFace.strokes = [{ type: 'SOLID', color: dk(tc, 0.16) }]
    topFace.strokeWeight = 2
    container.appendChild(topFace)

    for (let i = 1; i <= 3; i++) {
      const r = coreR + (outerR - coreR) * (i / 4)
      const rRy = r / outerR * capRy
      const ring = figma.createEllipse()
      ring.name = 'ring'
      ring.resize(Math.max(1, r * 2), Math.max(1, rRy * 2))
      ring.x = Math.round(rollCx - r)
      ring.y = Math.round(rollCy - cylH / 2 - rRy)
      ring.fills = []
      ring.strokes = [{ type: 'SOLID', color: dk(tc, 0.14), opacity: 0.38 }]
      ring.strokeWeight = 1.2
      container.appendChild(ring)
    }

    const coreRy = coreR / outerR * capRy
    const core = figma.createEllipse()
    core.name = 'core hole'
    core.resize(Math.max(1, coreR * 2), Math.max(1, coreRy * 2))
    core.x = Math.round(rollCx - coreR)
    core.y = Math.round(rollCy - cylH / 2 - coreRy)
    core.fills = [{ type: 'SOLID', color: { r: 0.70, g: 0.55, b: 0.35 } }]
    core.strokes = [{ type: 'SOLID', color: { r: 0.56, g: 0.43, b: 0.26 } }]
    core.strokeWeight = 1.5
    container.appendChild(core)
  }

  // ── Tape strip ──────────────────────────────────────────────────────────
  const tape = figma.createFrame()
  tape.name = 'tape fill'
  tape.resize(Math.max(1, tw), Math.max(1, th))
  tape.x = tapeX
  tape.y = tapeY
  tape.clipsContent = true
  tape.fills = [{ type: 'SOLID', color: tc }]

  if (p.patternBytes && p.patternBytes.length > 0) {
    const bytes = new Uint8Array(p.patternBytes)
    const img = figma.createImage(bytes)
    const sc = Math.max(0.1, p.patternScale)
    const rot = (p.patternRotation * Math.PI) / 180
    const cosA = Math.cos(rot) / sc, sinA = Math.sin(rot) / sc
    const tx = (p.patternOffsetX / 100) + (1 - cosA) / 2 - (-sinA) / 2
    const ty = (p.patternOffsetY / 100) + sinA / 2 + (1 - cosA) / 2
    tape.fills = [tape.fills[0] as SolidPaint, {
      type: 'IMAGE', scaleMode: p.patternRepeat ? 'TILE' : 'FIT',
      imageHash: img.hash, opacity: 0.9,
      imageTransform: [[cosA, -sinA, tx], [sinA, cosA, ty]]
    } as ImagePaint]
  } else if (p.patternSource === 'builtin') {
    const svg = buildPatternSvg(p.patternType, p.patternColor, tw, th)
    try {
      const svgN = figma.createNodeFromSvg(svg)
      svgN.name = 'pattern'; svgN.resize(Math.max(1, tw), Math.max(1, th))
      svgN.x = 0; svgN.y = 0
      tape.appendChild(svgN)
    } catch (_e) { /* skip */ }
  }
  container.appendChild(tape)

  // ── Zigzag mask — clips tape to serrated edge shape ─────────
  {
    const toothH = 8
    const toothD = 5
    const teeth = Math.max(3, Math.round(th / toothH))
    const step = th / teeth

    let md = `M ${tapeX} ${tapeY}`
    md += ` L ${tapeX + tw} ${tapeY}`
    for (let i = 0; i < teeth; i++) {
      const midY = tapeY + step * i + step / 2
      const botY = tapeY + step * (i + 1)
      md += ` L ${tapeX + tw + toothD} ${midY} L ${tapeX + tw} ${botY}`
    }
    md += ` L ${tapeX} ${tapeY + th}`
    if (!p.showRoll) {
      for (let i = teeth - 1; i >= 0; i--) {
        const midY = tapeY + step * i + step / 2
        const topY = tapeY + step * i
        md += ` L ${tapeX - toothD} ${midY} L ${tapeX} ${topY}`
      }
    }
    md += ` Z`

    const mask = figma.createVector()
    mask.name = 'tape shape'
    mask.vectorPaths = [{ windingRule: 'NONZERO' as WindingRule, data: md }]
    mask.fills = [{ type: 'SOLID', color: tc }]
    mask.strokes = [{ type: 'SOLID', color: dk(tc, 0.12) }]
    mask.strokeWeight = 1.2

    const tapeIdx = container.children.length - 1
    container.insertChild(tapeIdx, mask)

    const tapeGroup = figma.group([mask, tape], container)
    tapeGroup.name = 'tape strip'
    mask.isMask = true
    tapeGroup.opacity = Math.max(0.05, Math.min(1, p.opacity))
    tapeGroup.effects = [{
      type: 'DROP_SHADOW',
      color: { r: 0, g: 0, b: 0, a: 0.13 },
      offset: { x: 0, y: 3 }, radius: 8, spread: 0, visible: true, blendMode: 'NORMAL'
    }]
  }

  figma.currentPage.appendChild(container)
  container.setRelaunchData({ [TOOL_ID]: DISPLAY_NAME })
  figma.currentPage.selection = [container]
  figma.viewport.scrollAndZoomIntoView([container])
}

function buildPatternSvg(type: string, color: { r: number; g: number; b: number; a: number }, w: number, h: number): string {
  const c = `rgb(${Math.round(color.r*255)},${Math.round(color.g*255)},${Math.round(color.b*255)})`
  const mid = h / 2
  let body = ''
  if (type === 'botanicals') {
    body = `<g fill="${c}" stroke="${c}" stroke-linecap="round" stroke-linejoin="round">`
    const items = [
      `<line x1="0" y1="6" x2="0" y2="-6" stroke-width="1.5" fill="none"/><path d="M-5,-8 C-5,-14 5,-14 5,-8 C5,-4 0,-2 0,-2 C0,-2 -5,-4 -5,-8Z" stroke="none"/>`,
      `<rect x="-2" y="2" width="4" height="6" stroke="none"/><polygon points="0,-12 -8,2 8,2" stroke="none"/>`,
      `<line x1="0" y1="7" x2="0" y2="-7" stroke-width="1.5" fill="none"/><path d="M0,-7 C7,-2 7,5 0,7 C-7,5 -7,-2 0,-7Z" stroke="none" opacity="0.85"/>`,
      `<ellipse cx="-4" cy="3" rx="8" ry="5" stroke="none"/><circle cx="5" cy="-2" r="4.5" stroke="none"/><path d="M8,-2 L14,-1 L8,-0.5Z" stroke="none"/>`,
      `<line x1="0" y1="-12" x2="0" y2="0" stroke-width="1.5" fill="none"/><circle cx="0" cy="0" r="4.5" stroke="none"/><circle cx="-6" cy="-2" r="3.5" stroke="none"/><circle cx="5" cy="-3" r="3" stroke="none"/>`,
    ]
    for (let i = 0; i * 40 < w + 40; i++) body += `<g transform="translate(${20+i*40},${mid})">${items[i%items.length]}</g>`
    body += '</g>'
  } else if (type === 'animals') {
    body = `<g fill="${c}" stroke="none">`
    for (let i = 0; i * 54 < w + 54; i++) body += `<g transform="translate(${26+i*54},${mid})"><ellipse cx="-4" cy="2" rx="9" ry="6"/><circle cx="6" cy="-2" r="5.5"/><polygon points="3,-7 5,-13 8,-7"/><polygon points="8,-6 12,-11 13,-5"/><circle cx="7" cy="-3" r="2" fill="white" opacity="0.5"/></g>`
    body += '</g>'
  } else if (type === 'dots') {
    body = `<g fill="${c}">`
    for (let i = 0; i * 22 < w + 22; i++) body += `<circle cx="${11+i*22}" cy="${mid}" r="${2.5+(i%3)*0.8}" opacity="${0.45+(i%4)*0.14}"/>`
    body += '</g>'
  } else if (type === 'stars') {
    body = `<g fill="${c}">`
    for (let i = 0; i * 40 < w + 40; i++) {
      const cx2 = 20+i*40; let pts = ''
      for (let k = 0; k < 5; k++) { const a=(k*72-90)*Math.PI/180,a2=(k*72+36-90)*Math.PI/180; pts+=`${cx2+7*Math.cos(a)},${mid+7*Math.sin(a)} ${cx2+3*Math.cos(a2)},${mid+3*Math.sin(a2)} ` }
      body += `<polygon points="${pts.trim()}"/>`
    }
    body += '</g>'
  } else if (type === 'stripes') {
    body = `<g stroke="${c}" stroke-width="2.5" opacity="0.45">`
    for (let i = 0; i*18 < w+h+18; i++) body += `<line x1="${i*18}" y1="0" x2="${i*18-h}" y2="${h}"/>`
    body += '</g>'
  } else if (type === 'checks') {
    const cell = 14; body = `<g fill="${c}" opacity="0.28">`
    for (let i = 0; i*cell < w+cell; i++) for (let j = 0; j*cell < h+cell; j++) if ((i+j)%2===0) body += `<rect x="${i*cell}" y="${j*cell}" width="${cell}" height="${cell}"/>`
    body += '</g>'
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`
}
