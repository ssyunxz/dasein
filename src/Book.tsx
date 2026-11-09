import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useFrame, type ThreeElements, type ThreeEvent } from '@react-three/fiber'
import gsap from 'gsap'
import type { Group, Object3D } from 'three'
import Board from './book/Board'
import type { BendUniform } from './book/bend'
import Hinge from './book/Hinge'
import SpineCover from './book/SpineCover'
import { FRONT_HINGE, OPEN_ANGLE } from './book/bookConfig'
import {
  BEND_MAX,
  BEND_PEAK_AT,
  CLICK_MAX_MOVE_PX,
  CLOSE_DURATION,
  CLOSE_EASE,
  HOVER_DURATION,
  HOVER_LIFT_ANGLE,
  OPEN_DURATION,
  OPEN_EASE,
  OPEN_TARGET_ANGLE,
} from './interactionConfig'
import { useMemoStore } from './memo/useMemoStore'
import { GutterBridge, LeftStack, RightStack } from './PageStack'
import type { BookPhase } from './riffle/useBookStore'

/* 옛 양장본 — 구조 상수는 ./book/bookConfig.ts, 열기/닫기 상수는 ./interactionConfig.ts */

/** 앞표지 모서리별 닳은 정도 (CORNER_WEAR 배율) — 모서리마다 다르게 */
const FRONT_CORNERS = { top: 1.0, bottom: 0.55 }
const BACK_CORNERS = { top: 0.7, bottom: 1.25 }

type BookProps = ThreeElements['group'] & {
  /** 앞표지를 열린 상태로 둘지 (바뀌면 열림/닫힘 애니메이션) */
  coverOpen: boolean
  phase: BookPhase
  /** 클릭(탭)으로 열기/닫기 요청 */
  onToggle: () => void
  /** 앞표지와 함께 움직이는 내용 (왼쪽 펼침면 본문 등) — 앞표지 좌표계 */
  coverContent?: ReactNode
}

export default function Book({ coverOpen, phase, onToggle, coverContent, ...props }: BookProps) {
  const hinge = useRef<Group>(null)
  const bend = useMemo<BendUniform>(() => ({ value: 0 }), [])
  // GSAP이 조작하는 값들. 매 프레임 hinge 회전에 합쳐서 반영
  const motion = useRef({ angle: 0, hover: 0 })
  const [hovered, setHovered] = useState(false)
  const mounted = useRef(false)

  const getAngle = () => OPEN_ANGLE + motion.current.angle + motion.current.hover

  useFrame(() => {
    if (!hinge.current) return
    // rotation.y 가 음수일수록 책배 쪽이 카메라 쪽으로 들리며 열림
    hinge.current.rotation.y = -getAngle()
  })

  // 열림/닫힘: 각도 + 동작 중에만 살짝 휘었다가 펴짐
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }
    const duration = coverOpen ? OPEN_DURATION : CLOSE_DURATION
    const ease = coverOpen ? OPEN_EASE : CLOSE_EASE
    const tl = gsap.timeline()
    tl.to(motion.current, { angle: coverOpen ? OPEN_TARGET_ANGLE : 0, hover: 0, duration, ease }, 0)
    tl.to(bend, { value: BEND_MAX, duration: duration * BEND_PEAK_AT, ease: 'sine.out' }, 0)
    tl.to(bend, { value: 0, duration: duration * (1 - BEND_PEAK_AT), ease: 'sine.inOut' }, duration * BEND_PEAK_AT)
    return () => {
      tl.kill()
    }
  }, [coverOpen, bend])

  // 호버 힌트: 닫혀 있을 때만 앞표지가 살짝 들림
  useEffect(() => {
    if (phase !== 'closed') return
    const tween = gsap.to(motion.current, {
      hover: hovered ? HOVER_LIFT_ANGLE : 0,
      duration: HOVER_DURATION,
      ease: 'power2.out',
    })
    return () => {
      tween.kill()
    }
  }, [hovered, phase])

  useEffect(() => {
    useMemoStore.getState().setCursor('book', hovered ? 'pointer' : null)
  }, [hovered])

  /** 펼친 상태에서는 앞표지 쪽(왼쪽 더미 포함)을 눌렀을 때만 닫기 대상 */
  const isFrontCover = (o: Object3D | null) => {
    for (let n = o; n; n = n.parent) if (n === hinge.current) return true
    return false
  }
  const clickable = (o: Object3D | null) => phase === 'closed' || (phase === 'open' && isFrontCover(o))

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    setHovered(clickable(e.object))
  }
  const handlePointerOut = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    setHovered(false)
  }
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    // e.delta = pointerdown ~ up 사이 이동 거리(px). 많이 움직였으면 회전 드래그로 보고 무시
    if (e.delta > CLICK_MAX_MOVE_PX) return
    if (!clickable(e.object)) return // 애니메이션 중이거나 표지 밖
    onToggle()
  }

  return (
    <group {...props} onPointerMove={handlePointerMove} onPointerOut={handlePointerOut} onClick={handleClick}>
      {/* 오른쪽 속지 더미 (닫힌 상태에서는 속지 뭉치 전체) + 머리띠 */}
      <RightStack />
      {/* 두 더미 윗면을 잇는 제본 골 곡면 (펼침면이 나뉘었을 때만) */}
      <GutterBridge />

      {/* 고정 부품 */}
      <SpineCover />
      {/* 책등 천·면지와 앞표지를 잇는 경첩 (각도에 따라 모양이 바뀜) */}
      <Hinge getAngle={getAngle} />
      <Board side="back" cornerScale={BACK_CORNERS} seed={23} />

      {/* 앞표지 — 경첩 축(FRONT_HINGE)을 중심으로 rotation.y 회전.
          축은 속지 등 모서리 앞면 라인을 책등 윗면 위로 올린 세로선 → 열려도 책등을 뚫지 않음 */}
      <group name="frontBoardPivot" ref={hinge} position={FRONT_HINGE}>
        <group position={[-FRONT_HINGE[0], -FRONT_HINGE[1], -FRONT_HINGE[2]]}>
          {/* 안쪽 면 = 면지 (글씨 없음) */}
          <Board side="front" cornerScale={FRONT_CORNERS} seed={7} bend={bend} endpaper />
          {/* 넘어간 페이지들이 쌓이는 왼쪽 더미 */}
          <LeftStack />
          {coverContent}
        </group>
      </group>
    </group>
  )
}
