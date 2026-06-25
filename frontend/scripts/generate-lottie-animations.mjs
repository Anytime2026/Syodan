#!/usr/bin/env node
/**
 * SVG から Lottie JSON を生成する。
 * Lottie MCP Creator は JSON エクスポート非対応のため、同等のアニメーションをここで出力する。
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const IMAGES = path.join(__dirname, '../public/images')
const OUT = path.join(__dirname, '../public/lottie')

const FR = 60
const OP = 90
const COMP = 200

function readSvg(file) {
  return fs.readFileSync(path.join(IMAGES, file), 'utf8')
}

function parseSvgSize(svg) {
  const w = Number(svg.match(/\bwidth="(\d+)"/)?.[1] ?? 500)
  const h = Number(svg.match(/\bheight="(\d+)"/)?.[1] ?? 500)
  return { w, h }
}

function svgToDataUri(svg) {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

function fitScale(w, h, max = COMP) {
  const s = Math.min(max / w, max / h) * 100
  return { x: s, y: s }
}

function staticK(v) {
  return { a: 0, k: v }
}

function animK(frames, mapValue) {
  return {
    a: 1,
    k: frames.map(({ t, ...rest }) => ({
      t,
      s: mapValue(rest),
      i: { x: [0.42], y: [0] },
      o: { x: [0.58], y: [1] },
    })),
  }
}

function asset(id, svg) {
  const { w, h } = parseSvgSize(svg)
  return { id, w, h, u: '', p: svgToDataUri(svg), e: 1 }
}

function imageLayer({
  ind,
  nm,
  refId,
  svgW,
  svgH,
  opacity = staticK(100),
  position = staticK([COMP / 2, COMP / 2, 0]),
  scale,
  anchor,
}) {
  const sc = scale ?? staticK([...Object.values(fitScale(svgW, svgH)), 100])
  const an = anchor ?? [svgW / 2, svgH / 2, 0]
  return {
    ddd: 0,
    ind,
    ty: 2,
    nm,
    refId,
    sr: 1,
    ks: {
      o: opacity,
      r: staticK(0),
      p: position,
      a: staticK(an),
      s: sc,
    },
    ip: 0,
    op: OP,
    st: 0,
  }
}

function wrapSvg(viewBox, inner, w, h) {
  return `<svg width="${w}" height="${h}" viewBox="${viewBox}" fill="none" xmlns="http://www.w3.org/2000/svg">\n${inner}\n</svg>`
}

function extractPaths(svg, predicate) {
  const paths = [...svg.matchAll(/<path[\s\S]*?\/>/g)].map((m) => m[0])
  const defs = svg.match(/<defs>[\s\S]*?<\/defs>/)?.[0] ?? ''
  const selected = paths.filter(predicate).join('\n')
  const { w, h } = parseSvgSize(svg)
  const vb = svg.match(/viewBox="([^"]+)"/)?.[1] ?? `0 0 ${w} ${h}`
  return wrapSvg(vb, `${selected}\n${defs}`, w, h)
}

function opacityCycle(layerCount, sequence) {
  return Array.from({ length: layerCount }, (_, i) => {
    const keyframes = []
    const add = (t, v) => {
      const last = keyframes[keyframes.length - 1]
      if (!last || last.t !== t || last.v !== v) keyframes.push({ t, v })
    }
    add(0, 0)
    for (const seg of sequence) {
      if (seg.layerIndex !== i) continue
      if (seg.start === 0) add(0, 100)
      else {
        add(seg.start, 0)
        add(seg.start + 1, 100)
      }
      add(seg.end, 100)
      add(seg.end + 1, 0)
    }
    add(OP - 1, 0)
    return animK(keyframes, ({ v }) => [v])
  })
}

function lottieDoc(nm, assets, layers) {
  return {
    v: '5.7.4',
    fr: FR,
    ip: 0,
    op: OP,
    w: COMP,
    h: COMP,
    nm,
    ddd: 0,
    assets,
    layers,
  }
}

function writeJson(file, doc) {
  fs.mkdirSync(OUT, { recursive: true })
  const outPath = path.join(OUT, file)
  fs.writeFileSync(outPath, JSON.stringify(doc))
  console.log(`wrote ${outPath}`)
}

// --- !-bear: ！が飛び出す ---
function buildBearExclamation() {
  const full = readSvg('!-bear.svg')
  const { w, h } = parseSvgSize(full)
  const isExclamation = (p) => p.includes('#E54144') || p.includes('560.5 5')
  const bodySvg = extractPaths(full, (p) => !isExclamation(p))
  const iconSvg = extractPaths(full, isExclamation)

  const bodyAsset = asset('img_bear_body', bodySvg)
  const iconAsset = asset('img_exclamation', iconSvg)
  const fit = fitScale(w, h)
  const anchor = [w / 2, h / 2, 0]
  const iconAnchor = [733, 480, 0]

  const iconScale = animK(
    [
      { t: 0, sx: fit.x * 0.3, sy: fit.y * 0.3 },
      { t: 12, sx: fit.x * 1.15, sy: fit.y * 1.15 },
      { t: 22, sx: fit.x * 0.95, sy: fit.y * 0.95 },
      { t: 32, sx: fit.x, sy: fit.y },
      { t: OP - 1, sx: fit.x, sy: fit.y },
    ],
    ({ sx, sy }) => [sx, sy, 100],
  )

  const iconPos = animK(
    [
      { t: 0, x: COMP / 2, y: COMP / 2 + 20 },
      { t: 12, x: COMP / 2, y: COMP / 2 - 8 },
      { t: 22, x: COMP / 2, y: COMP / 2 + 2 },
      { t: 32, x: COMP / 2, y: COMP / 2 },
      { t: OP - 1, x: COMP / 2, y: COMP / 2 },
    ],
    ({ x, y }) => [x, y, 0],
  )

  const iconOpacity = animK(
    [
      { t: 0, v: 0 },
      { t: 4, v: 100 },
      { t: OP - 1, v: 100 },
    ],
    ({ v }) => [v],
  )

  return lottieDoc(
    '!-bear',
    [bodyAsset, iconAsset],
    [
      imageLayer({
        ind: 1,
        nm: 'Exclamation',
        refId: 'img_exclamation',
        svgW: w,
        svgH: h,
        opacity: iconOpacity,
        position: iconPos,
        scale: iconScale,
        anchor: iconAnchor,
      }),
      imageLayer({
        ind: 2,
        nm: 'Bear',
        refId: 'img_bear_body',
        svgW: w,
        svgH: h,
        anchor,
      }),
    ],
  )
}

// --- !-light: 豆電球が光る ---
function buildBearLight() {
  const full = readSvg('!-light.svg')
  const { w, h } = parseSvgSize(full)
  const isBulb = (p) =>
    p.includes('#FDE10C') ||
    p.includes('paint1_linear') ||
    p.includes('660 320') ||
    p.includes('809.5 852')
  const bodySvg = extractPaths(full, (p) => !isBulb(p))
  const bulbSvg = extractPaths(full, isBulb)

  const bulbOpacity = animK(
    [
      { t: 0, v: 70 },
      { t: 15, v: 100 },
      { t: 30, v: 75 },
      { t: 45, v: 100 },
      { t: 60, v: 70 },
      { t: 75, v: 100 },
      { t: OP - 1, v: 80 },
    ],
    ({ v }) => [v],
  )

  const bulbScale = animK(
    [
      { t: 0, s: 100 },
      { t: 15, s: 106 },
      { t: 30, s: 100 },
      { t: 45, s: 108 },
      { t: 60, s: 100 },
      { t: 75, s: 105 },
      { t: OP - 1, s: 100 },
    ],
    ({ s }) => {
      const fit = fitScale(w, h)
      return [fit.x * (s / 100), fit.y * (s / 100), 100]
    },
  )

  return lottieDoc(
    '!-light',
    [asset('img_bear_body', bodySvg), asset('img_bulb', bulbSvg)],
    [
      imageLayer({
        ind: 1,
        nm: 'Bulb',
        refId: 'img_bulb',
        svgW: w,
        svgH: h,
        opacity: bulbOpacity,
        scale: bulbScale,
      }),
      imageLayer({
        ind: 2,
        nm: 'Bear',
        refId: 'img_bear_body',
        svgW: w,
        svgH: h,
      }),
    ],
  )
}

// --- LevelUp: 棒グラフが伸びる ---
function buildLevelUp() {
  const full = readSvg('LevelUp.svg')
  const { w, h } = parseSvgSize(full)
  const paths = [...full.matchAll(/<path[\s\S]*?\/>/g)].map((m) => m[0])
  const [arrow, bar3, bar2, bar1] = paths
  const vb = full.match(/viewBox="([^"]+)"/)?.[1] ?? `0 0 ${w} ${h}`

  const bars = [
    { id: 'bar1', path: bar1, anchor: [215, 1184, 0], delay: 0, color: 'bar1' },
    { id: 'bar2', path: bar2, anchor: [461, 1182, 0], delay: 8, color: 'bar2' },
    {
      id: 'bar3',
      path: bar3,
      anchor: [710, 1184, 0],
      delay: 16,
      color: 'bar3',
    },
  ]

  const arrowSvg = wrapSvg(vb, arrow, w, h)
  const assets = [asset('img_arrow', arrowSvg)]
  const layers = []
  let ind = 1

  for (const bar of bars) {
    const barSvg = wrapSvg(vb, bar.path, w, h)
    assets.push(asset(`img_${bar.id}`, barSvg))
    const fit = fitScale(w, h)
    const growEnd = 40 + bar.delay
    const scale = animK(
      [
        { t: 0, sy: 0 },
        { t: bar.delay, sy: 0 },
        { t: growEnd, sy: fit.y },
        { t: OP - 1, sy: fit.y },
      ],
      ({ sy }) => [fit.x, sy, 100],
    )
    layers.push(
      imageLayer({
        ind: ind++,
        nm: bar.id,
        refId: `img_${bar.id}`,
        svgW: w,
        svgH: h,
        scale,
        anchor: bar.anchor,
        position: staticK([COMP / 2, COMP * 0.92, 0]),
      }),
    )
  }

  layers.push(
    imageLayer({
      ind: ind++,
      nm: 'Arrow',
      refId: 'img_arrow',
      svgW: w,
      svgH: h,
      opacity: animK(
        [
          { t: 0, v: 0 },
          { t: 35, v: 0 },
          { t: 50, v: 100 },
          { t: OP - 1, v: 100 },
        ],
        ({ v }) => [v],
      ),
    }),
  )

  return lottieDoc('LevelUp', assets, layers)
}

// --- Thinking_Bear: ? が現れて消える ---
function buildThinkingBear() {
  const full = readSvg('Thinking_Bear.svg')
  const { w, h } = parseSvgSize(full)
  const isQuestion = (p) => p.includes('#E54144')
  const bodySvg = extractPaths(full, (p) => !isQuestion(p))
  const qSvg = extractPaths(full, isQuestion)

  const qOpacity = animK(
    [
      { t: 0, v: 0 },
      { t: 15, v: 0 },
      { t: 28, v: 100 },
      { t: 55, v: 100 },
      { t: 72, v: 0 },
      { t: OP - 1, v: 0 },
    ],
    ({ v }) => [v],
  )

  const qScale = animK(
    [
      { t: 0, s: 60 },
      { t: 15, s: 60 },
      { t: 28, s: 105 },
      { t: 38, s: 100 },
      { t: OP - 1, s: 100 },
    ],
    ({ s }) => {
      const fit = fitScale(w, h)
      return [(fit.x * s) / 100, (fit.y * s) / 100, 100]
    },
  )

  return lottieDoc(
    'Thinking_Bear',
    [asset('img_bear_body', bodySvg), asset('img_question', qSvg)],
    [
      imageLayer({
        ind: 1,
        nm: 'Question',
        refId: 'img_question',
        svgW: w,
        svgH: h,
        opacity: qOpacity,
        scale: qScale,
      }),
      imageLayer({
        ind: 2,
        nm: 'Bear',
        refId: 'img_bear_body',
        svgW: w,
        svgH: h,
      }),
    ],
  )
}

// --- kuma-talking: 口パク ---
function buildKumaTalking() {
  const files = [
    'kuma-openMouce.svg',
    'kuma-closeMouce.svg',
    'kuma-closeEyes-OpenMouce.svg',
    'kuma-CloseEyes-CloseMouce.svg',
  ]
  const svgs = files.map(readSvg)
  const { w, h } = parseSvgSize(svgs[0])
  const assets = files.map((f, i) => asset(`img_kuma_${i}`, svgs[i]))

  // 0:open 1:close 2:blink-open 3:blink-close
  const sequence = [
    { layerIndex: 0, start: 0, end: 4 },
    { layerIndex: 1, start: 5, end: 9 },
    { layerIndex: 0, start: 10, end: 14 },
    { layerIndex: 1, start: 15, end: 19 },
    { layerIndex: 0, start: 20, end: 24 },
    { layerIndex: 1, start: 25, end: 29 },
    { layerIndex: 0, start: 30, end: 34 },
    { layerIndex: 1, start: 35, end: 39 },
    { layerIndex: 2, start: 40, end: 43 },
    { layerIndex: 3, start: 44, end: 47 },
    { layerIndex: 0, start: 48, end: 52 },
    { layerIndex: 1, start: 53, end: 57 },
    { layerIndex: 0, start: 58, end: 62 },
    { layerIndex: 1, start: 63, end: 67 },
    { layerIndex: 0, start: 68, end: 72 },
    { layerIndex: 1, start: 73, end: 77 },
    { layerIndex: 0, start: 78, end: 89 },
  ]

  const opacities = opacityCycle(files.length, sequence)
  const layers = files.map((f, i) =>
    imageLayer({
      ind: i + 1,
      nm: f.replace('.svg', ''),
      refId: `img_kuma_${i}`,
      svgW: w,
      svgH: h,
      opacity: opacities[i],
    }),
  )

  return lottieDoc('kuma-talking', assets, layers)
}

writeJson('!-bear.json', buildBearExclamation())
writeJson('!-light.json', buildBearLight())
writeJson('LevelUp.json', buildLevelUp())
writeJson('Thinking_Bear.json', buildThinkingBear())
writeJson('kuma-talking.json', buildKumaTalking())
