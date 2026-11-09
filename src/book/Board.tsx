import { useMemo } from 'react'
import { ExtrudeGeometry, Shape, Vector2 } from 'three'
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
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
} from './bookConfig'
import { createNoise, smoothstep } from './geometryUtils'

const EDGE_BEVEL = 0.0025 // 판 가장자리 둥글림
const EDGE_WAVE = CORNER_WEAR * 0.08 // 가장자리 물결 진폭
const STEP = 0.015 // 외곽선 샘플 간격

type Props = {
  side: 'front' | 'back'
  /** 책배 쪽 위/아래 모서리 둥글기 배율 (CORNER_WEAR 기준) — 모서리마다 다르게 닳은 느낌 */
  cornerScale: { top: number; bottom: number }
  seed: number
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

function createBoardGeometry({ side, cornerScale, seed }: Props) {
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
  const zMin = side === 'front' ? BOOK_THICKNESS / 2 - BOARD_THICKNESS : -BOOK_THICKNESS / 2
  geo.translate(0, 0, zMin + EDGE_BEVEL)
  return toCreasedNormals(geo, Math.PI / 4)
}

/** 앞/뒤 표지판. 좌표는 책 기준 절대 위치 (앞표지는 Book에서 pivot 그룹으로 감쌈) */
export default function Board(props: Props) {
  const { side, cornerScale, seed } = props
  const geometry = useMemo(
    () => createBoardGeometry({ side, cornerScale, seed }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [side, cornerScale.top, cornerScale.bottom, seed],
  )
  return (
    <mesh name={side === 'front' ? 'frontBoard' : 'backBoard'} geometry={geometry}>
      <meshPhysicalMaterial
        color={COVER_COLOR}
        roughness={COVER_ROUGHNESS}
        sheen={COVER_SHEEN}
        sheenRoughness={0.8}
        sheenColor="#ffffff"
      />
    </mesh>
  )
}
