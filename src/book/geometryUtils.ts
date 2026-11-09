import { ExtrudeGeometry, Shape, Vector2, type BufferGeometry } from 'three'
import { SimplexNoise } from 'three/examples/jsm/math/SimplexNoise.js'

/** 시드 고정 simplex noise — 새로고침해도 같은 울퉁불퉁함 */
export function createNoise(seed: number) {
  let a = seed >>> 0
  const random = () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return new SimplexNoise({ random })
}

/** 원호 위 점들 (단면 평면: x, z). 각도 a0 → a1, 양 끝 포함 */
export function arcPoints(cx: number, r: number, a0: number, a1: number, segments: number) {
  const pts: Vector2[] = []
  for (let i = 0; i <= segments; i++) {
    const a = a0 + ((a1 - a0) * i) / segments
    pts.push(new Vector2(cx + r * Math.cos(a), r * Math.sin(a)))
  }
  return pts
}

/**
 * (x, z) 단면을 세로(y)로 밀어낸 지오메트리. 원점 기준 y 중앙 정렬.
 * Shape의 두 번째 좌표가 최종 z(두께)가 됨.
 */
export function extrudeAlongY(shape: Shape, height: number, steps = 1): BufferGeometry {
  const geo = new ExtrudeGeometry(shape, { depth: height, steps, bevelEnabled: false })
  geo.translate(0, 0, -height / 2)
  geo.rotateX(Math.PI / 2) // shape y → z, 밀어낸 방향 → y
  return geo
}

export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}
