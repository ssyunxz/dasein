import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferAttribute, BufferGeometry, DoubleSide, type Mesh } from 'three'
import {
  BOARD_INNER_X,
  BOARD_THICKNESS,
  BOOK_HEIGHT,
  BOOK_THICKNESS,
  COVER_COLOR,
  COVER_ROUGHNESS,
  COVER_SHEEN,
  ENDPAPER_COLOR,
  ENDPAPER_TURN_IN,
  FRONT_HINGE,
  JOINT_DIP,
  SPINE_ARC_END_X,
  SPINE_ARC_END_Z,
  SPINE_COVER_THICKNESS,
  SPINE_TOP_Z,
  TB_CORNER_X,
  TB_HALF_THICK,
} from './bookConfig'
import { isSplit } from '../riffle/stackGeometry'

/*
 * 앞표지 경첩 연결부 — 표지가 열려도 책과 떨어져 보이지 않도록 매 프레임 모양을 다시 계산.
 *  1) 천 경첩: 책등 표지 천 끝(고정) → 앞표지 판 책등 쪽 모서리(회전). 바깥쪽으로 둥글게 감김
 *  2) 면지 경첩: 첫 페이지 위(고정) → 앞표지 안쪽 면지 모서리(회전). 천 경첩을 감싸며 넘어감
 * 두 곡선 모두 3차 베지어: 시작/끝 접선을 각 부품 면 방향에 맞춰 이음매가 매끄럽게.
 * (곡선 비율 값은 0°~170° 전 구간에서 관통이 없도록 시뮬레이션으로 정함)
 */

/** 천 경첩 곡선의 휘어짐 (양 끝 거리 대비) */
const CLOTH_CURVE_K = 0.45
/** 면지 경첩: 첫 페이지 위 고정점이 속지 등 모서리에서 떨어진 거리 / 휘어짐 */
const PAPER_START_PAD = 0.04
const PAPER_CURVE_K = 0.6
const SEGMENTS = 32

type V2 = [number, number]

const [HX, , HZ] = FRONT_HINGE
/** 앞표지와 함께 경첩 축 기준으로 회전한 점 (x, z 평면) */
const rotate = (x: number, z: number, th: number): V2 => {
  const dx = x - HX
  const dz = z - HZ
  return [HX + dx * Math.cos(th) - dz * Math.sin(th), HZ + dx * Math.sin(th) + dz * Math.cos(th)]
}

/** 3차 베지어 위 점과 접선 */
function bezier(p0: V2, p1: V2, p2: V2, p3: V2, t: number) {
  const u = 1 - t
  const p: V2 = [0, 1].map(
    (k) => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k],
  ) as V2
  const d: V2 = [0, 1].map(
    (k) => 3 * u * u * (p1[k] - p0[k]) + 6 * u * t * (p2[k] - p1[k]) + 3 * t * t * (p3[k] - p2[k]),
  ) as V2
  return { p, d }
}

/** 책등 천이 경첩 홈을 지나 표지 쪽으로 나오는 방향 (SpineCover의 joint 곡선 끝 접선) */
const CLOTH_START: V2 = [BOARD_INNER_X, SPINE_TOP_Z]
const clothStartDir = (() => {
  const dx = BOARD_INNER_X - (BOARD_INNER_X + SPINE_ARC_END_X) / 2
  const dz = SPINE_TOP_Z - (SPINE_ARC_END_Z - JOINT_DIP)
  const l = Math.hypot(dx, dz)
  return [dx / l, dz / l] as V2
})()
const PAPER_START: V2 = [TB_CORNER_X + PAPER_START_PAD, TB_HALF_THICK + 0.0002]
/** 앞표지 안쪽 면지 모서리 (닫힌 상태 기준) */
const PAPER_END_CLOSED: V2 = [BOARD_INNER_X + 0.004, BOOK_THICKNESS / 2 - BOARD_THICKNESS - 0.0003]

/**
 * 곡선을 세로(y)로 밀어낸 띠. thickness > 0 이면 양면 + 위/아래 마구리까지 있는 두께 있는 띠.
 * 정점 배치는 고정이고, 매 프레임 위치만 갱신.
 */
function createRibbon(thick: boolean) {
  const surfaces = thick ? 4 : 1 // 바깥, 안쪽, 위 마구리, 아래 마구리
  const n = SEGMENTS + 1
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(new Float32Array(surfaces * n * 2 * 3), 3))
  const index: number[] = []
  for (let s = 0; s < surfaces; s++) {
    for (let i = 0; i < SEGMENTS; i++) {
      const a = s * n * 2 + i * 2
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
  }
  geo.setIndex(index)
  return geo
}

function updateRibbon(geo: BufferGeometry, pts: V2[], tangents: V2[], thickness: number, halfH: number) {
  const pos = geo.attributes.position as BufferAttribute
  const n = pts.length
  const half = thickness / 2
  pts.forEach((p, i) => {
    const l = Math.hypot(tangents[i][0], tangents[i][1]) || 1
    const nx = -tangents[i][1] / l
    const nz = tangents[i][0] / l
    const o: V2 = [p[0] + nx * half, p[1] + nz * half]
    const inn: V2 = [p[0] - nx * half, p[1] - nz * half]
    if (thickness > 0) {
      const set = (s: number, r: number, q: V2, y: number) => pos.setXYZ(s * n * 2 + i * 2 + r, q[0], y, q[1])
      set(0, 0, o, halfH)
      set(0, 1, o, -halfH)
      set(1, 0, inn, halfH)
      set(1, 1, inn, -halfH)
      set(2, 0, o, halfH)
      set(2, 1, inn, halfH)
      set(3, 0, o, -halfH)
      set(3, 1, inn, -halfH)
    } else {
      pos.setXYZ(i * 2, p[0], halfH, p[1])
      pos.setXYZ(i * 2 + 1, p[0], -halfH, p[1])
    }
  })
  pos.needsUpdate = true
  geo.computeVertexNormals()
  geo.computeBoundingSphere()
}

function sampleCurve(p0: V2, p1: V2, p2: V2, p3: V2) {
  const pts: V2[] = []
  const tangents: V2[] = []
  for (let i = 0; i <= SEGMENTS; i++) {
    const { p, d } = bezier(p0, p1, p2, p3, i / SEGMENTS)
    pts.push(p)
    tangents.push(d)
  }
  return { pts, tangents }
}

type Props = {
  /** 현재 앞표지 열림 각도 (라디안, 양수 = 열림) */
  getAngle: () => number
}

export default function Hinge({ getAngle }: Props) {
  const cloth = useRef<Mesh>(null)
  const paper = useRef<Mesh>(null)
  const clothGeo = useMemo(() => createRibbon(true), [])
  const paperGeo = useMemo(() => createRibbon(false), [])
  const last = useRef(Number.NaN)

  useFrame(() => {
    const th = getAngle()
    if (paper.current) paper.current.visible = !isSplit()
    if (th === last.current) return
    last.current = th
    const d: V2 = [Math.cos(th), Math.sin(th)] // 회전한 표지 판이 뻗는 방향

    // 1) 천 경첩
    const B = rotate(CLOTH_START[0], CLOTH_START[1], th)
    const distC = Math.hypot(B[0] - CLOTH_START[0], B[1] - CLOTH_START[1])
    if (cloth.current) cloth.current.visible = distC > 1e-4 // 닫힌 상태에선 길이 0
    if (distC > 1e-4) {
      const k = CLOTH_CURVE_K * distC
      const c = sampleCurve(
        CLOTH_START,
        [CLOTH_START[0] + clothStartDir[0] * k, CLOTH_START[1] + clothStartDir[1] * k],
        [B[0] - d[0] * k, B[1] - d[1] * k],
        B,
      )
      updateRibbon(clothGeo, c.pts, c.tangents, SPINE_COVER_THICKNESS, BOOK_HEIGHT / 2)
    }

    // 2) 면지 경첩 — 첫 페이지에서 책등 쪽으로 가다가 표지 안쪽으로 넘어감.
    //    페이지가 넘어가 좌/우 더미로 나뉘면 제본 골 곡면(GutterBridge)이 이 자리를 대신함
    if (paper.current) paper.current.visible = !isSplit()
    const E = rotate(PAPER_END_CLOSED[0], PAPER_END_CLOSED[1], th)
    const k = Math.max(0.012, PAPER_CURVE_K * Math.hypot(E[0] - PAPER_START[0], E[1] - PAPER_START[1]))
    const p = sampleCurve(PAPER_START, [PAPER_START[0] - k, PAPER_START[1]], [E[0] - d[0] * k, E[1] - d[1] * k], E)
    updateRibbon(paperGeo, p.pts, p.tangents, 0, BOOK_HEIGHT / 2 - ENDPAPER_TURN_IN)
  })

  return (
    <group name="frontHinge">
      <mesh ref={cloth} name="hingeCloth" geometry={clothGeo} frustumCulled={false}>
        <meshPhysicalMaterial
          color={COVER_COLOR}
          roughness={COVER_ROUGHNESS}
          sheen={COVER_SHEEN}
          sheenRoughness={0.8}
          sheenColor="#ffffff"
          side={DoubleSide}
        />
      </mesh>
      <mesh ref={paper} name="hingePaper" geometry={paperGeo} frustumCulled={false}>
        <meshStandardMaterial color={ENDPAPER_COLOR} roughness={1} side={DoubleSide} />
      </mesh>
    </group>
  )
}
