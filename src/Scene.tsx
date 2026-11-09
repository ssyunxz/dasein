import { useEffect, useRef, useState } from 'react'
import { useThree } from '@react-three/fiber'
import { Environment, Float, OrbitControls, PerspectiveCamera } from '@react-three/drei'
import gsap from 'gsap'
import { Vector3, type Group } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import Book from './Book'
import FreeRotate from './FreeRotate'
import {
  CLOSE_DURATION,
  CLOSE_EASE,
  OPEN_BOOK_SHIFT_X,
  OPEN_CAMERA_POSITION,
  OPEN_DURATION,
  OPEN_EASE,
} from './interactionConfig'

/* ──────────────────────────────────────────────
 * 공간 / 조명 / 카메라 설정값
 * 바닥·그림자 없이 책이 공중에 떠 있는 장면
 * ────────────────────────────────────────────── */

/** 회전 방식
 *  'free'  : 카메라 고정, 드래그하면 책 자체가 어느 방향으로든 제한 없이 회전 (관성 있음)
 *  'orbit' : 카메라가 책 주위를 공전 (위아래는 정수리/바닥에서 멈춤) */
const ROTATION_MODE: 'free' | 'orbit' = 'orbit'

export const BACKGROUND_COLOR = '#f5f3ef'

/** 환경광 */
const ENV_PRESET = 'studio' as const // 'studio' | 'apartment'
const ENV_INTENSITY = 0.6

/** 보조 조명 — 앞쪽 키 라이트 + 뒤쪽 림 라이트 (뒷면도 어둡지 않게) */
const KEY_LIGHT_POSITION: [number, number, number] = [3, 4, 5]
const KEY_LIGHT_INTENSITY = 0.6
const RIM_LIGHT_POSITION: [number, number, number] = [-3, 2, -5]
const RIM_LIGHT_INTENSITY = 0.35
/** 책등(왼쪽) 쪽 보조광 — 책등이 그늘에 묻히지 않게 */
const FILL_LIGHT_POSITION: [number, number, number] = [-5, 1.5, 2]
const FILL_LIGHT_INTENSITY = 0.45
const AMBIENT_INTENSITY = 0.3

/** 둥실 떠 있는 움직임 (아주 약하게) */
const FLOAT_SPEED = 0.1
const FLOAT_INTENSITY = 0.2// 위아래 흔들림 크기
const FLOAT_ROTATION_INTENSITY = 0.12 // 미세한 기울어짐

/** 카메라 */
const CAMERA_FOV = 35
const CAMERA_TARGET: [number, number, number] = [0, 0, 0]
const ORBIT_CAMERA_POSITION: [number, number, number] = [1.5, -0.6, 4.6]
const FREE_CAMERA_POSITION: [number, number, number] = [0, 0.5, 4.8]
/** free 모드에서 처음 보이는 책 각도 — 표지 정면에서 살짝 틀어 책등이 보이게 */
const FREE_INITIAL_ROTATION: [number, number, number] = [0.08, -0.4, 0.0]

/** 컨트롤 */
const MIN_DISTANCE = 3
const MAX_DISTANCE = 8
const DAMPING_FACTOR = 0.06
const ORBIT_AUTO_ROTATE_SPEED = 0.01 // 낮을수록 느림
const ORBIT_AUTO_ROTATE_RESUME_MS = 2500

export default function Scene() {
  const isFree = ROTATION_MODE === 'free'
  const [autoRotate, setAutoRotate] = useState(true)
  const resumeTimer = useRef<number | undefined>(undefined)

  /* ── 앞표지 열기/닫기 ── */
  const [isOpen, setIsOpen] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const camera = useThree((s) => s.camera)
  const controls = useRef<OrbitControlsImpl>(null)
  const bookShift = useRef<Group>(null)
  const timeline = useRef<gsap.core.Timeline | null>(null)

  useEffect(() => () => void timeline.current?.kill(), [])

  const toggleBook = () => {
    if (isAnimating) return // 동작 중 추가 클릭 무시
    const next = !isOpen
    const duration = next ? OPEN_DURATION : CLOSE_DURATION
    const ease = next ? OPEN_EASE : CLOSE_EASE
    const [cx, cy, cz] = next ? OPEN_CAMERA_POSITION : isFree ? FREE_CAMERA_POSITION : ORBIT_CAMERA_POSITION
    const target = controls.current?.target.clone() ?? new Vector3(...CAMERA_TARGET)

    setIsOpen(next)
    setIsAnimating(true)
    // 앞표지 회전(Book 안)과 같은 시간·이징으로 카메라와 책 위치를 함께 이동
    const tl = gsap.timeline({ onComplete: () => setIsAnimating(false) })
    tl.to(camera.position, { x: cx, y: cy, z: cz, duration, ease, onUpdate: () => camera.lookAt(target) }, 0)
    if (bookShift.current) tl.to(bookShift.current.position, { x: next ? OPEN_BOOK_SHIFT_X : 0, duration, ease }, 0)
    timeline.current = tl
  }

  useEffect(() => () => window.clearTimeout(resumeTimer.current), [])

  const handleStart = () => {
    window.clearTimeout(resumeTimer.current)
    setAutoRotate(false)
  }
  const handleEnd = () => {
    window.clearTimeout(resumeTimer.current)
    resumeTimer.current = window.setTimeout(() => setAutoRotate(true), ORBIT_AUTO_ROTATE_RESUME_MS)
  }

  // Float을 바깥에 둬야 책을 어떻게 돌려도 흔들림은 항상 화면 위아래 방향
  // 펼치면 bookShift 그룹이 옆으로 옮겨가 펼친 책 전체가 화면 중앙에 옴
  const bookNode = (
    <group ref={bookShift}>
      <Book isOpen={isOpen} isAnimating={isAnimating} onToggle={toggleBook} />
    </group>
  )
  const book = (
    <Float speed={FLOAT_SPEED} floatIntensity={FLOAT_INTENSITY} rotationIntensity={FLOAT_ROTATION_INTENSITY}>
      {isFree ? (
        <FreeRotate initialRotation={FREE_INITIAL_ROTATION} paused={isOpen || isAnimating}>
          {bookNode}
        </FreeRotate>
      ) : (
        bookNode
      )}
    </Float>
  )

  return (
    <>
      <color attach="background" args={[BACKGROUND_COLOR]} />

      <PerspectiveCamera
        makeDefault
        position={isFree ? FREE_CAMERA_POSITION : ORBIT_CAMERA_POSITION}
        fov={CAMERA_FOV}
        near={0.1}
        far={100}
      />

      {isFree ? (
        // free 모드: OrbitControls는 줌(휠/핀치)만 담당
        <OrbitControls
          ref={controls}
          enabled={!isAnimating}
          target={CAMERA_TARGET}
          enableRotate={false}
          enablePan={false}
          enableDamping
          dampingFactor={DAMPING_FACTOR}
          minDistance={MIN_DISTANCE}
          maxDistance={MAX_DISTANCE}
        />
      ) : (
        <OrbitControls
          ref={controls}
          enabled={!isAnimating} // 열림/닫힘 애니메이션 중에는 조작 불가
          target={CAMERA_TARGET}
          enableDamping
          dampingFactor={DAMPING_FACTOR}
          enablePan={false}
          minDistance={MIN_DISTANCE}
          maxDistance={MAX_DISTANCE}
          minPolarAngle={0}
          maxPolarAngle={Math.PI}
          autoRotate={autoRotate && !isOpen && !isAnimating} // 열린 상태에서는 자동 회전 끔
          autoRotateSpeed={ORBIT_AUTO_ROTATE_SPEED}
          onStart={handleStart}
          onEnd={handleEnd}
        />
      )}

      <ambientLight intensity={AMBIENT_INTENSITY} />
      <directionalLight position={KEY_LIGHT_POSITION} intensity={KEY_LIGHT_INTENSITY} />
      <directionalLight position={RIM_LIGHT_POSITION} intensity={RIM_LIGHT_INTENSITY} />
      <directionalLight position={FILL_LIGHT_POSITION} intensity={FILL_LIGHT_INTENSITY} />
      <Environment preset={ENV_PRESET} environmentIntensity={ENV_INTENSITY} />

      {book}
    </>
  )
}
