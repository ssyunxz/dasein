import { useMemo } from 'react'
import {
  CanvasTexture,
  DoubleSide,
  ExtrudeGeometry,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Shape,
  PlaneGeometry,
  SRGBColorSpace,
  Vector2,
} from 'three'
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { TessellateModifier } from 'three/examples/jsm/modifiers/TessellateModifier.js'
import {
  BOARD_INNER_X,
  BOARD_OUTER_X,
  BOARD_THICKNESS,
  BOOK_HEIGHT,
  BOOK_THICKNESS,
  CORNER_WEAR,
  COVER_COLOR,
  COVER_ROUGHNESS,
  COVER_SHEEN,
  ENDPAPER_COLOR,
  ENDPAPER_TURN_IN,
} from './bookConfig'
import { applyBend, type BendUniform } from './bend'
import { createNoise, smoothstep } from './geometryUtils'

const EDGE_BEVEL = 0.0025 // 판 가장자리 둥글림
const EDGE_WAVE = CORNER_WEAR * 0.08 // 가장자리 물결 진폭
const STEP = 0.015 // 외곽선 샘플 간격


type Props = {
  side: 'front' | 'back'
  /** 책배 쪽 위/아래 모서리 둥글기 배율 (CORNER_WEAR 기준) — 모서리마다 다르게 닳은 느낌 */
  cornerScale: { top: number; bottom: number }
  seed: number
  /** 휨 uniform (앞표지만). 책등 쪽은 고정, 책배 쪽으로 갈수록 바깥(+z)으로 밀림 */
  bend?: BendUniform
  /** 안쪽 면에 면지 붙이기 */
  endpaper?: boolean
}

/** 외곽선을 촘촘히 샘플링 (점 + 바깥 법선). 책등 쪽 변은 직선으로 두어 경첩과 맞물림 */
function sampleOutline(rTop: number, rBottom: number) {
  const b = EDGE_BEVEL // 베벨이 바깥으로 b만큼 키우므로 미리 안쪽으로
  const x0 = BOARD_INNER_X + b
  const x1 = BOARD_OUTER_X - b
  const y0 = -BOOK_HEIGHT / 2 + b
  const y1 = BOOK_HEIGHT / 2 - b
  const pts: { p: Vector2; n: Vector2 }[] = []

  const line = (ax: number, ay: number, bx: number, by: number, n: Vector2) => {
    const len = Math.hypot(bx - ax, by - ay)
    const k = Math.max(1, Math.round(len / STEP))
    for (let i = 0; i < k; i++) {
      const t = i / k
      pts.push({ p: new Vector2(ax + (bx - ax) * t, ay + (by - ay) * t), n })
    }
  }
  const corner = (cx: number, cy: number, r: number, a0: number) => {
    const k = 10
    for (let i = 0; i < k; i++) {
      const a = a0 + (Math.PI / 2) * (i / k)
      const n = new Vector2(Math.cos(a), Math.sin(a))
      pts.push({ p: new Vector2(cx + r * n.x, cy + r * n.y), n })
    }
  }

  line(x0, y0, x1 - rBottom, y0, new Vector2(0, -1)) // 아래 변
  corner(x1 - rBottom, y0 + rBottom, rBottom, -Math.PI / 2) // 책배-아래 모서리
  line(x1, y0 + rBottom, x1, y1 - rTop, new Vector2(1, 0)) // 책배 변
  corner(x1 - rTop, y1 - rTop, rTop, 0) // 책배-위 모서리
  line(x1 - rTop, y1, x0, y1, new Vector2(0, 1)) // 위 변
  line(x0, y1, x0, y0, new Vector2(-1, 0)) // 책등 쪽 변 (물결 없음)
  return { pts, x0 }
}

const zRange = (side: 'front' | 'back') => {
  const zMin = side === 'front' ? BOOK_THICKNESS / 2 - BOARD_THICKNESS : -BOOK_THICKNESS / 2
  return { zMin, zMax: zMin + BOARD_THICKNESS, inner: side === 'front' ? zMin : zMin + BOARD_THICKNESS }
}

function createBoardGeometry({
  side,
  cornerScale,
  seed,
  subdivide,
}: Pick<Props, 'side' | 'cornerScale' | 'seed'> & { subdivide: boolean }) {
  const rTop = Math.max(0.002, CORNER_WEAR * cornerScale.top - EDGE_BEVEL)
  const rBottom = Math.max(0.002, CORNER_WEAR * cornerScale.bottom - EDGE_BEVEL)
  const { pts, x0 } = sampleOutline(rTop, rBottom)

  // 닳은 가장자리: 둘레를 따라 noise로 아주 살짝 물결. 책등 쪽으로 갈수록 0
  const noise = createNoise(seed)
  let dist = 0
  const outline = pts.map(({ p, n }, i) => {
    if (i > 0) dist += p.distanceTo(pts[i - 1].p)
    const taper = smoothstep(x0, x0 + 0.08, p.x)
    const w = EDGE_WAVE * taper * (noise.noise(dist * 6, 0.5) * 0.7 + noise.noise(dist * 23, 3.1) * 0.3)
    return p.clone().addScaledVector(n, w)
  })

  const depth = BOARD_THICKNESS - EDGE_BEVEL * 2
  const geo = new ExtrudeGeometry(new Shape(outline), {
    depth,
    steps: 1,
    bevelEnabled: true,
    bevelThickness: EDGE_BEVEL,
    bevelSize: EDGE_BEVEL,
    bevelSegments: 3,
  })
  // 베벨 포함 z 범위 [-b, depth+b] → 표지 위치로 이동
  geo.translate(0, 0, zRange(side).zMin + EDGE_BEVEL)
  // 휘는 표지는 면을 잘게 쪼개야 셰이더 휨이 매끄럽게 보임 (큰 삼각형은 휘지 않고 꺾임)
  const base = subdivide ? new TessellateModifier(0.06, 7).modify(geo) : geo
  return toCreasedNormals(base, Math.PI / 4)
}

/** 면지: 천이 접혀 들어온 가장자리만 남기고 안쪽 면을 덮는 얇은 종이 (휨 셰이더용으로 잘게 분할) */
function createEndpaperGeometry(side: 'front' | 'back') {
  const x0 = BOARD_INNER_X + 0.004
  const x1 = BOARD_OUTER_X - ENDPAPER_TURN_IN
  const h = BOOK_HEIGHT - ENDPAPER_TURN_IN * 2
  // 휨은 x 방향으로만 일어나므로 가로만 잘게 나눔
  const geo = new PlaneGeometry(x1 - x0, h, 48, 1)
  // 표지 안쪽 면과 속지 사이의 미세한 틈 안에 놓음 (관통 없음)
  geo.translate((x0 + x1) / 2, 0, zRange(side).inner + (side === 'front' ? -0.0003 : 0.0003))
  return geo
}

/** 면지의 아주 옅은 얼룩 — 세월에 바랜 종이 느낌 (곱해지는 밝기 텍스처) */
function createStainTexture(seed: number) {
  const w = 256
  const h = 400
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  const noise = createNoise(seed)
  const rnd = (i: number, k: number) => 0.5 + 0.5 * noise.noise(i * 3.7, k * 1.3)
  for (let i = 0; i < 14; i++) {
    const x = rnd(i, 1) * w
    const y = rnd(i, 2) * h
    const r = 18 + rnd(i, 3) * 70
    const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r)
    const a = 0.03 + rnd(i, 4) * 0.05
    g.addColorStop(0, `rgba(150, 118, 70, ${a})`)
    g.addColorStop(0.75, `rgba(150, 118, 70, ${a * 0.6})`)
    g.addColorStop(1, 'rgba(150, 118, 70, 0)')
    ctx.fillStyle = g
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
  }
  // 가장자리로 갈수록 살짝 더 바램
  const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.65)
  v.addColorStop(0, 'rgba(140, 110, 60, 0)')
  v.addColorStop(1, 'rgba(140, 110, 60, 0.07)')
  ctx.fillStyle = v
  ctx.fillRect(0, 0, w, h)
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  return tex
}

/** 앞/뒤 표지판. 좌표는 책 기준 절대 위치 (앞표지는 Book에서 경첩 그룹으로 감쌈) */
export default function Board({ side, cornerScale, seed, bend, endpaper = false }: Props) {
  const geometry = useMemo(
    () => createBoardGeometry({ side, cornerScale, seed, subdivide: !!bend }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [side, cornerScale.top, cornerScale.bottom, seed, bend],
  )
  const endpaperGeometry = useMemo(() => (endpaper ? createEndpaperGeometry(side) : null), [endpaper, side])

  const coverMaterial = useMemo(() => {
    const m = new MeshPhysicalMaterial({
      color: COVER_COLOR,
      roughness: COVER_ROUGHNESS,
      sheen: COVER_SHEEN,
      sheenRoughness: 0.8,
      sheenColor: '#ffffff',
    })
    if (bend) applyBend(m, bend, 'board-bend')
    return m
  }, [bend])

  const endpaperMaterial = useMemo(() => {
    const m = new MeshStandardMaterial({
      color: ENDPAPER_COLOR,
      map: createStainTexture(seed + 100),
      roughness: 1,
      metalness: 0,
      side: DoubleSide,
    })
    if (bend) applyBend(m, bend, 'endpaper-bend')
    return m
  }, [bend, seed])

  return (
    <group name={side === 'front' ? 'frontBoard' : 'backBoard'}>
      <mesh geometry={geometry} material={coverMaterial} />
      {endpaperGeometry && <mesh name="endpaper" geometry={endpaperGeometry} material={endpaperMaterial} />}
    </group>
  )
}
