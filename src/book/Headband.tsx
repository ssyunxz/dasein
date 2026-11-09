import { useMemo } from 'react'
import { BufferAttribute, CatmullRomCurve3, Color, TubeGeometry, Vector3 } from 'three'
import {
  ARC_CENTER_X,
  HEADBAND_BEAD_EVERY,
  HEADBAND_COLORS,
  HEADBAND_PROTRUDE,
  HEADBAND_RADIUS,
  HEADBAND_STRIPE_JITTER,
  HEADBAND_STRIPES,
  HEADBAND_THREAD_DEPTH,
  HEADBAND_WOBBLE,
  HEADBAND_WRAPS,
  TB_HALF_THICK,
  TB_HEIGHT,
  TB_RADIUS,
} from './bookConfig'
import { createNoise } from './geometryUtils'

/* 머리띠 = 둥근 심지 + 그 위에 촘촘히 감긴 실(나선) + 책등 쪽 아래의 실 매듭(비즈) */

const BEAD_RADIUS = HEADBAND_RADIUS * 0.3

/**
 * 머리띠 경로: 속지 등 원호에서 반지름만큼 안쪽 → 바깥면이 속지 등 곡선을 따라감.
 * 손으로 감은 실처럼 noise로 살짝 구불거리게 (방사 방향 + 세로 방향).
 */
function createHeadbandPath(side: 1 | -1) {
  const noise = createNoise(side === 1 ? 101 : 202)
  const baseR = TB_RADIUS - HEADBAND_RADIUS - HEADBAND_WOBBLE // 구불거려도 속지 등 밖으로 안 나가게
  const half = Math.asin((TB_HALF_THICK - HEADBAND_RADIUS - HEADBAND_WOBBLE) / baseR)
  const baseY = side * (TB_HEIGHT / 2 + HEADBAND_PROTRUDE - HEADBAND_RADIUS)
  const n = 36
  const pts: Vector3[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const a = Math.PI - half + 2 * half * t
    const r = baseR + HEADBAND_WOBBLE * noise.noise(t * 4.5, 0.3)
    const y = baseY + HEADBAND_WOBBLE * 0.8 * noise.noise(t * 3.5, 7.7)
    pts.push(new Vector3(ARC_CENTER_X + r * Math.cos(a), y, r * Math.sin(a)))
  }
  return new CatmullRomCurve3(pts)
}

/**
 * 바퀴(wrap) 번호마다 실 색 인덱스 (0 = 갈색, 1 = 크림).
 * 갈색/크림 묶음 폭을 불규칙하게 정하고, 양 끝은 크림으로 시작·끝.
 */
function createWrapColors(seed: number) {
  const noise = createNoise(seed)
  const widths: number[] = []
  for (let i = 0; i < HEADBAND_STRIPES * 2 + 1; i++) {
    const base = i % 2 === 0 ? 1.1 : 0.85 // 짝수 = 크림, 홀수 = 갈색
    const r = noise.noise(i * 1.7, seed) // -1~1
    widths.push(base * (1 + HEADBAND_STRIPE_JITTER * r))
  }
  const total = widths.reduce((s, w) => s + w, 0)
  const colorOf: number[] = []
  let block = 0
  let acc = widths[0] / total
  for (let k = 0; k < HEADBAND_WRAPS; k++) {
    const u = (k + 0.5) / HEADBAND_WRAPS
    while (u > acc && block < widths.length - 1) acc += widths[++block] / total
    colorOf.push(block % 2 === 0 ? 1 : 0)
  }
  return colorOf
}

const threadHash = (k: number) => {
  const s = Math.sin(k * 127.1) * 43758.5453
  return s - Math.floor(s)
}

/**
 * 실 감긴 튜브: 나선 위상(phase = u·바퀴수 + v)마다 반원 단면으로 볼록하게 → 실 한 가닥씩 도드라짐.
 * 실 사이 골은 버텍스 컬러로 어둡게, 가닥마다 밝기도 조금씩 다르게.
 */
function createWrappedTube(path: CatmullRomCurve3, colorOf: number[]) {
  const radial = 16
  const tubular = HEADBAND_WRAPS * 8
  const geo = new TubeGeometry(path, tubular, HEADBAND_RADIUS, radial, false)
  const pos = geo.attributes.position
  const nor = geo.attributes.normal
  const colors = new Float32Array(pos.count * 3)
  const palette = HEADBAND_COLORS.map((c) => new Color(c))
  const c = new Color()

  for (let i = 0; i <= tubular; i++) {
    for (let j = 0; j <= radial; j++) {
      const idx = i * (radial + 1) + j
      const phase = (i / tubular) * HEADBAND_WRAPS + j / radial
      const k = Math.min(HEADBAND_WRAPS - 1, Math.max(0, Math.floor(phase)))
      const f = phase - Math.floor(phase)
      const profile = Math.sqrt(Math.max(0, 1 - (2 * f - 1) ** 2)) // 0(골) ~ 1(실 꼭대기)

      // 반지름: 실 꼭대기는 원래 반지름, 골은 살짝 안쪽 → 바깥으로 튀어나오지 않음
      const d = -HEADBAND_RADIUS * HEADBAND_THREAD_DEPTH * (1 - profile)
      pos.setXYZ(idx, pos.getX(idx) + nor.getX(idx) * d, pos.getY(idx) + nor.getY(idx) * d, pos.getZ(idx) + nor.getZ(idx) * d)

      const shade = (0.5 + 0.5 * profile) * (0.9 + 0.18 * threadHash(k))
      c.copy(palette[colorOf[k]]).multiplyScalar(shade)
      colors.set([c.r, c.g, c.b], idx * 3)
    }
  }
  geo.setAttribute('color', new BufferAttribute(colors, 3))
  geo.computeVertexNormals()
  return geo
}

/**
 * 실 매듭(비즈): 머리띠가 속지 등과 맞닿는 책등 쪽 아래 모서리에 줄지어 놓임.
 * 속지 등 바로 바깥(틈 안)에 있어 책등 표지와 닿지 않음.
 */
function createBeads(path: CatmullRomCurve3, side: 1 | -1, colorOf: number[]) {
  if (HEADBAND_BEAD_EVERY <= 0) return []
  const beads: { position: Vector3; color: string }[] = []
  for (let k = 1; k < HEADBAND_WRAPS - 1; k += HEADBAND_BEAD_EVERY) {
    const p = path.getPointAt((k + 0.5) / HEADBAND_WRAPS)
    const a = Math.atan2(p.z, p.x - ARC_CENTER_X)
    // 속지 등 곡면에 반쯤 붙어 틈 쪽으로 볼록 (틈 폭보다 충분히 작음)
    const r = TB_RADIUS + BEAD_RADIUS * 0.6
    const position = new Vector3(
      ARC_CENTER_X + r * Math.cos(a),
      p.y - side * HEADBAND_RADIUS * 0.45, // 머리띠 아래쪽 가장자리
      r * Math.sin(a),
    )
    beads.push({ position, color: HEADBAND_COLORS[colorOf[k]] })
  }
  return beads
}

/** side: 1 = 머리(위), -1 = 밑(아래) */
export default function Headband({ side }: { side: 1 | -1 }) {
  const { tube, ends, beads, endColors } = useMemo(() => {
    const path = createHeadbandPath(side)
    const colorOf = createWrapColors(side === 1 ? 5 : 9)
    return {
      tube: createWrappedTube(path, colorOf),
      ends: [path.getPoint(0), path.getPoint(1)],
      endColors: [HEADBAND_COLORS[colorOf[0]], HEADBAND_COLORS[colorOf[HEADBAND_WRAPS - 1]]],
      beads: createBeads(path, side, colorOf),
    }
  }, [side])

  return (
    <group name={side === 1 ? 'headbandTop' : 'headbandBottom'}>
      {/* 실 감긴 심지 — 실크 실의 은은한 광택 */}
      <mesh geometry={tube}>
        <meshPhysicalMaterial vertexColors roughness={0.55} sheen={0.6} sheenRoughness={0.4} sheenColor="#fff4e0" />
      </mesh>

      {/* 끝 마감 (튜브 끝 구멍 막기) */}
      {ends.map((p, i) => (
        <mesh key={i} position={p} scale={1 - HEADBAND_THREAD_DEPTH * 0.5}>
          <sphereGeometry args={[HEADBAND_RADIUS, 16, 10]} />
          <meshStandardMaterial color={endColors[i]} roughness={0.6} />
        </mesh>
      ))}

      {/* 실 매듭 */}
      {beads.map((b, i) => (
        <mesh key={i} position={b.position} scale={[1, 0.75, 1]}>
          <sphereGeometry args={[BEAD_RADIUS, 8, 6]} />
          <meshStandardMaterial color={b.color} roughness={0.6} />
        </mesh>
      ))}
    </group>
  )
}
