import { useMemo } from 'react'
import { QuadraticBezierCurve, Shape, Vector2 } from 'three'
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import {
  ARC_CENTER_X,
  BOARD_INNER_X,
  BOOK_HEIGHT,
  COVER_COLOR,
  COVER_ROUGHNESS,
  COVER_SHEEN,
  GAP_SHADOW_COLOR,
  GAP_SHADOW_INSET,
  JOINT_DIP,
  SPINE_ARC_END_X,
  SPINE_ARC_END_Z,
  SPINE_BUMPINESS,
  SPINE_COVER_THICKNESS,
  SPINE_GAP,
  SPINE_HALF_ANGLE,
  SPINE_MID_RADIUS,
  SPINE_TOP_Z,
  TB_RADIUS,
} from './bookConfig'
import { arcPoints, createNoise, extrudeAlongY, smoothstep } from './geometryUtils'

/**
 * 책등 표지 단면의 중심선 (앞표지 쪽 → 둥근 등 → 뒤표지 쪽).
 * 양 끝은 표지판 모서리에서 시작해, 경첩 홈에서 살짝 꺾여 내려앉은 뒤 C자 원호로 이어짐.
 */
function centerline() {
  const jointFront = new QuadraticBezierCurve(
    new Vector2(BOARD_INNER_X, SPINE_TOP_Z),
    new Vector2((BOARD_INNER_X + SPINE_ARC_END_X) / 2, SPINE_ARC_END_Z - JOINT_DIP),
    new Vector2(SPINE_ARC_END_X, SPINE_ARC_END_Z),
  ).getPoints(10)
  const arc = arcPoints(ARC_CENTER_X, SPINE_MID_RADIUS, Math.PI - SPINE_HALF_ANGLE, Math.PI + SPINE_HALF_ANGLE, 72)
  const jointBack = jointFront.map((p) => new Vector2(p.x, -p.y)).reverse()
  return [...jointFront.slice(0, -1), ...arc, ...jointBack.slice(1)]
}

/** 중심선을 두께만큼 양쪽으로 벌려 닫힌 단면을 만든 뒤, 세로로 잘게 나눠 밀어냄 */
function createSpineGeometry() {
  const c = centerline()
  const half = SPINE_COVER_THICKNESS / 2
  const outer: Vector2[] = []
  const inner: Vector2[] = []
  c.forEach((p, i) => {
    const a = c[Math.max(0, i - 1)]
    const b = c[Math.min(c.length - 1, i + 1)]
    const t = new Vector2().subVectors(b, a).normalize()
    const n = new Vector2(t.y, -t.x) // 바깥쪽 법선
    outer.push(p.clone().addScaledVector(n, half))
    inner.push(p.clone().addScaledVector(n, -half))
  })
  const shape = new Shape([...outer, ...inner.reverse()])
  const geo = extrudeAlongY(shape, BOOK_HEIGHT, 140)

  // simplex noise 로 미묘한 울퉁불퉁함 — 원호 중심 기준 방사 방향으로 밀어서
  // 안/바깥 면이 함께 움직이므로 두께와 틈 폭이 유지됨. 표지판과 만나는 끝은 0으로 수렴.
  const noise = createNoise(11)
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const ang = Math.atan2(z, x - ARC_CENTER_X)
    const s = ang * SPINE_MID_RADIUS // 둘레 방향 길이
    const n = noise.noise(s * 7, y * 5) * 0.65 + noise.noise(s * 22 + 40, y * 16) * 0.35
    const taper = smoothstep(BOARD_INNER_X, SPINE_ARC_END_X, x)
    const d = SPINE_BUMPINESS * n * taper
    pos.setXYZ(i, x + Math.cos(ang) * d, y, z + Math.sin(ang) * d)
  }
  return toCreasedNormals(geo, Math.PI / 5)
}

/**
 * 틈 속 그늘 — 책등과 속지 등 사이 깊숙한 곳에 놓인 어두운 판.
 * 그림자 없는 장면에서도 위/아래로 들여다보면 틈 안쪽이 어둡게 보이도록.
 */
function createGapShadowGeometry() {
  const rIn = TB_RADIUS + 0.002
  const rOut = TB_RADIUS + SPINE_GAP - 0.002
  const half = Math.asin((SPINE_ARC_END_Z - SPINE_COVER_THICKNESS) / rOut)
  const outer = arcPoints(ARC_CENTER_X, rOut, Math.PI - half, Math.PI + half, 32)
  const innerHalf = Math.min(half, Math.asin(((SPINE_ARC_END_Z - SPINE_COVER_THICKNESS) * 0.9) / rIn))
  const inner = arcPoints(ARC_CENTER_X, rIn, Math.PI + innerHalf, Math.PI - innerHalf, 32)
  return extrudeAlongY(new Shape([...outer, ...inner]), BOOK_HEIGHT - GAP_SHADOW_INSET * 2)
}

export default function SpineCover() {
  const geometry = useMemo(() => createSpineGeometry(), [])
  const shadowGeometry = useMemo(() => createGapShadowGeometry(), [])
  return (
    <group name="spineCover">
      <mesh geometry={geometry}>
        <meshPhysicalMaterial
          color={COVER_COLOR}
          roughness={COVER_ROUGHNESS}
          sheen={COVER_SHEEN}
          sheenRoughness={0.8}
          sheenColor="#ffffff"
        />
      </mesh>
      <mesh name="spineGapShadow" geometry={shadowGeometry}>
        <meshBasicMaterial color={GAP_SHADOW_COLOR} />
      </mesh>
    </group>
  )
}
