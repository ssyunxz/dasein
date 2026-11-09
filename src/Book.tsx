import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, type ThreeElements, type ThreeEvent } from '@react-three/fiber'
import gsap from 'gsap'
import type { Group } from 'three'
import Board, { type BendUniform } from './book/Board'
import Headband from './book/Headband'
import Hinge from './book/Hinge'
import SpineCover from './book/SpineCover'
import TextBlock from './book/TextBlock'
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

/* 옛 양장본 — 구조 상수는 ./book/bookConfig.ts, 열기/닫기 상수는 ./interactionConfig.ts */

/** 앞표지 모서리별 닳은 정도 (CORNER_WEAR 배율) — 모서리마다 다르게 */
const FRONT_CORNERS = { top: 1.0, bottom: 0.55 }
const BACK_CORNERS = { top: 0.7, bottom: 1.25 }

type BookProps = ThreeElements['group'] & {
  isOpen: boolean
  isAnimating: boolean
  /** 클릭(탭)으로 열기/닫기 요청 */
  onToggle: () => void
}

export default function Book({ isOpen, isAnimating, onToggle, ...props }: BookProps) {
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
    const duration = isOpen ? OPEN_DURATION : CLOSE_DURATION
    const ease = isOpen ? OPEN_EASE : CLOSE_EASE
    const tl = gsap.timeline()
    tl.to(motion.current, { angle: isOpen ? OPEN_TARGET_ANGLE : 0, hover: 0, duration, ease }, 0)
    tl.to(bend, { value: BEND_MAX, duration: duration * BEND_PEAK_AT, ease: 'sine.out' }, 0)
    tl.to(bend, { value: 0, duration: duration * (1 - BEND_PEAK_AT), ease: 'sine.inOut' }, duration * BEND_PEAK_AT)
    return () => {
      tl.kill()
    }
  }, [isOpen, bend])

  // 호버 힌트: 닫혀 있고 움직이지 않을 때만 앞표지가 살짝 들림
  useEffect(() => {
    if (isAnimating) return
    const lift = hovered && !isOpen ? HOVER_LIFT_ANGLE : 0
    const tween = gsap.to(motion.current, { hover: lift, duration: HOVER_DURATION, ease: 'power2.out' })
    return () => {
      tween.kill()
    }
  }, [hovered, isOpen, isAnimating])

  useEffect(() => {
    document.body.style.cursor = hovered ? 'pointer' : 'auto'
  }, [hovered])
  useEffect(() => () => void (document.body.style.cursor = 'auto'), [])

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    setHovered(true)
  }
  const handlePointerOut = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    setHovered(false)
  }
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    // e.delta = pointerdown ~ up 사이 이동 거리(px). 많이 움직였으면 회전 드래그로 보고 무시
    if (e.delta > CLICK_MAX_MOVE_PX) return
    onToggle()
  }

  return (
    <group {...props} onPointerOver={handlePointerOver} onPointerOut={handlePointerOut} onClick={handleClick}>
      <TextBlock />
      <Headband side={1} />
      <Headband side={-1} />

      {/* 고정 부품 */}
      <SpineCover />
      {/* 책등 천·첫 페이지와 앞표지를 잇는 경첩 (각도에 따라 모양이 바뀜) */}
      <Hinge getAngle={getAngle} />
      <Board side="back" cornerScale={BACK_CORNERS} seed={23} />

      {/* 앞표지 — 경첩 축(FRONT_HINGE)을 중심으로 rotation.y 회전.
          축은 속지 등 모서리 앞면 라인을 책등 윗면 위로 올린 세로선 → 열려도 책등을 뚫지 않음 */}
      <group name="frontBoardPivot" ref={hinge} position={FRONT_HINGE}>
        <group position={[-FRONT_HINGE[0], -FRONT_HINGE[1], -FRONT_HINGE[2]]}>
          <Board side="front" cornerScale={FRONT_CORNERS} seed={7} bend={bend} endpaper />
        </group>
      </group>
    </group>
  )
}
