import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Text } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import gsap from 'gsap'
import { BufferGeometry, DoubleSide, Float32BufferAttribute, Quaternion, Vector3, type Group } from 'three'
import { BOARD_OUTER_X, PAGE_COLOR, PAGE_ROUGHNESS } from './book/bookConfig'
import type { PageData } from './data/pages'
import { CLICK_MAX_MOVE_PX } from './interactionConfig'
import {
  PAGE_CORNER_LIFT,
  PAGE_CORNER_SIZE,
  PAGE_EDGE_ZONE,
  PAGE_FONT_SIZE,
  PAGE_LINE_HEIGHT,
  PAGE_MARGIN,
  PAGE_NUMBER_SIZE,
  PAGE_TEXT_COLOR,
  SERIF_FONT,
} from './memo/memoConfig'
import StickyMemo from './memo/StickyMemo'
import { RIGHT_PAGE } from './memo/surfaces'
import { useMemoStore } from './memo/useMemoStore'
import { LEFT_X0, leftTopLocalZ, PAGE_H, PAGE_W, rightTopZ } from './riffle/stackGeometry'

/*
 * 펼침면 — 본문과 메모는 표지가 아니라 "속지 더미 윗면"에 속함.
 *  - SpreadLeft: 왼쪽 더미 윗면의 본문 (앞표지 좌표계 → Book의 앞표지 그룹 안에서 렌더)
 *  - Spread: 오른쪽 더미 윗면의 본문 + 들썩이는 모서리 + 넘기기 클릭 영역 + 떡메모지 (책 좌표계)
 * 높이는 매 프레임 더미 윗면을 따라감. 마지막 넘어가는 장이 90°를 지나기 전에는 렌더하지 않음.
 */

type Side = 'left' | 'right'

/** 본문 (여백 안쪽, 위에서부터). 페이지 중심 기준, +z 를 향함 */
function PageBody({ text, side }: { text: string; side: Side }) {
  const left = side === 'left' ? PAGE_MARGIN.outer : PAGE_MARGIN.inner
  const right = side === 'left' ? PAGE_MARGIN.inner : PAGE_MARGIN.outer
  return (
    <Suspense fallback={null}>
      <Text
        font={SERIF_FONT}
        fontSize={PAGE_FONT_SIZE}
        lineHeight={PAGE_LINE_HEIGHT}
        color={PAGE_TEXT_COLOR}
        maxWidth={PAGE_W - left - right}
        textAlign="justify"
        anchorX="left"
        anchorY="top"
        overflowWrap="break-word"
        position={[-PAGE_W / 2 + left, PAGE_H / 2 - PAGE_MARGIN.top, 0]}
      >
        {text}
      </Text>
    </Suspense>
  )
}

/** 작은 페이지 번호 — 아래쪽 바깥 모서리 */
function PageNumber({ n, side }: { n: number; side: Side }) {
  const x = side === 'left' ? -PAGE_W / 2 + PAGE_MARGIN.outer : PAGE_W / 2 - PAGE_MARGIN.outer
  return (
    <Suspense fallback={null}>
      <Text
        font={SERIF_FONT}
        fontSize={PAGE_NUMBER_SIZE}
        color={PAGE_TEXT_COLOR}
        anchorX={side === 'left' ? 'left' : 'right'}
        anchorY="bottom"
        position={[x, -PAGE_H / 2 + PAGE_MARGIN.bottom * 0.4, 0]}
      >
        {String(n)}
      </Text>
    </Suspense>
  )
}

/* ━━━ 왼쪽 ━━━ */

/** 앞표지 좌표계. 왼쪽 더미 윗면은 -z 쪽이므로 글을 뒤집어 -z 를 향하게 → 열리면 카메라 쪽 */
export function SpreadLeft({ page, visible }: { page: PageData; visible: boolean }) {
  const group = useRef<Group>(null)
  useFrame(() => {
    if (group.current) group.current.position.z = leftTopLocalZ() - 0.0003
  })
  if (!visible) return null
  return (
    <group ref={group} name="spreadLeft" position={[LEFT_X0 + PAGE_W / 2, 0, leftTopLocalZ() - 0.0003]} rotation={[0, Math.PI, 0]}>
      <PageBody text={page.leftText} side="left" />
      <PageNumber n={page.pageNumber} side="left" />
    </group>
  )
}

/* ━━━ 오른쪽 ━━━ */

/** 들썩이는 모서리: 오른쪽 아래 귀퉁이 삼각형 (접힘선 중점 기준 좌표) */
function createCornerGeometry() {
  const h = PAGE_CORNER_SIZE / 2
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute([-h, -h, 0, h, -h, 0, h, h, 0], 3))
  g.setAttribute('normal', new Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3))
  return g
}

const FOLD_AXIS = new Vector3(1, 1, 0).normalize()
// 접힘선 중점 (페이지 오른쪽 아래 귀퉁이에서 대각선 안쪽)
const FOLD_X = RIGHT_PAGE.x1 - PAGE_CORNER_SIZE / 2
const FOLD_Y = -PAGE_H / 2 + PAGE_CORNER_SIZE / 2

type SpreadProps = {
  page: PageData
  /** 본문·메모 렌더 여부 (마지막 장이 90°를 지난 뒤부터) */
  visible: boolean
  /** 메모 드래그·넘기기 클릭 가능 여부 (넘김이 끝난 뒤부터) */
  interactive: boolean
}

export default function Spread({ page, visible, interactive }: SpreadProps) {
  const body = useRef<Group>(null)
  const corner = useRef<Group>(null)
  const edge = useRef<Group>(null)
  const cornerGeometry = useMemo(() => createCornerGeometry(), [])
  const lift = useRef({ a: 0 })
  const rejectPulse = useMemoStore((s) => s.rejectPulse)

  // 오른쪽 더미 윗면 높이를 따라감
  useFrame(() => {
    const z = rightTopZ()
    if (body.current) body.current.position.z = z + 0.0003
    if (corner.current) corner.current.position.z = z + 0.0004
    if (edge.current) edge.current.position.z = z + 0.002
  })

  // 넘기기/닫기 거부: 모서리가 살짝 들렸다가 툭 떨어짐
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const q = new Quaternion()
    const apply = () => corner.current?.quaternion.copy(q.setFromAxisAngle(FOLD_AXIS, -lift.current.a))
    const tl = gsap
      .timeline()
      .to(lift.current, { a: PAGE_CORNER_LIFT, duration: 0.2, ease: 'power2.out', onUpdate: apply })
      .to(lift.current, { a: 0, duration: 0.28, ease: 'bounce.out', onUpdate: apply })
    return () => void tl.kill()
  }, [rejectPulse])

  const setCursor = useMemoStore.getState().setCursor
  useEffect(() => () => setCursor('page', null), [setCursor])
  const onEdgeClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (!interactive || e.delta > CLICK_MAX_MOVE_PX) return
    useMemoStore.getState().attemptTurn()
  }

  if (!visible) return null
  const z = rightTopZ()
  return (
    <group name="spread">
      {/* 오른쪽 본문 */}
      <group ref={body} position={[RIGHT_PAGE.cx, 0, z + 0.0003]}>
        <PageBody text={page.rightText} side="right" />
      </group>

      {/* 오른쪽 아래 모서리 — 페이지 번호가 이 위에 있어 함께 들림 */}
      <group ref={corner} position={[FOLD_X, FOLD_Y, z + 0.0004]}>
        <mesh geometry={cornerGeometry}>
          <meshStandardMaterial color={PAGE_COLOR} roughness={PAGE_ROUGHNESS} side={DoubleSide} />
        </mesh>
        <group position={[RIGHT_PAGE.cx - FOLD_X, -FOLD_Y, 0.0002]}>
          <PageNumber n={page.pageNumber + 1} side="right" />
        </group>
      </group>

      {/* 넘기기 클릭 영역 — 오른쪽 페이지 바깥 가장자리 (보이지 않음) */}
      <group ref={edge} position={[0, 0, z + 0.002]}>
        <mesh
          position={[(RIGHT_PAGE.x1 - PAGE_EDGE_ZONE + BOARD_OUTER_X + 0.03) / 2, 0, 0]}
          onClick={onEdgeClick}
          onPointerOver={(e) => {
            if (!interactive) return
            e.stopPropagation()
            setCursor('page', 'pointer')
          }}
          onPointerOut={() => setCursor('page', null)}
        >
          <planeGeometry args={[BOARD_OUTER_X + 0.03 - (RIGHT_PAGE.x1 - PAGE_EDGE_ZONE), PAGE_H]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>

      {/* 떡메모지 (지금은 sticky 만) */}
      {page.memos
        .filter((m) => m.type === 'sticky')
        .map((m) => (
          <StickyMemo key={m.id} memo={m} interactive={interactive} />
        ))}
    </group>
  )
}
