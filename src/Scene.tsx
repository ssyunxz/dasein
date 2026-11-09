import { useEffect, useRef, useState } from 'react'
import { useThree } from '@react-three/fiber'
import { Environment, Float, OrbitControls, PerspectiveCamera } from '@react-three/drei'
import gsap from 'gsap'
import { Vector3, type Group, type PerspectiveCamera as PerspectiveCameraImpl } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import Book from './Book'
import Desk from './Desk'
import FreeRotate from './FreeRotate'
import RiffleLeaves from './RiffleLeaves'
import Spread, { SpreadLeft } from './Spread'
import { PAGES } from './data/pages'
import {
  CLOSE_DURATION,
  CLOSE_EASE,
  OPEN_AZIMUTH_LIMIT,
  OPEN_BOOK_SHIFT_X,
  OPEN_DURATION,
  OPEN_EASE,
  OPEN_TILT_LIMIT,
  openCameraPosition,
} from './interactionConfig'
import { FocusOverlay } from './memo/StickyMemo'
import { selectAllMemosHome, useMemoStore } from './memo/useMemoStore'
import { riffleTo } from './riffle/riffle'
import { ENDPAPER_PAUSE, RIFFLE_DURATION, TARGET_PAGE } from './riffle/riffleConfig'
import { useBookStore } from './riffle/useBookStore'

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
const FLOAT_INTENSITY = 0.2 // 위아래 흔들림 크기
const FLOAT_ROTATION_INTENSITY = 0.12 // 미세한 기울어짐

/** 카메라 */
const CAMERA_FOV = 35
const CAMERA_TARGET: [number, number, number] = [0, 0, 0]
const ORBIT_CAMERA_POSITION: [number, number, number] = [1.5, -0.6, 4.6]
const FREE_CAMERA_POSITION: [number, number, number] = [0, 0.5, 4.8]
/** free 모드에서 처음 보이는 책 각도 — 표지 정면에서 살짝 틀어 책등이 보이게 */
const FREE_INITIAL_ROTATION: [number, number, number] = [0.08, -0.4, 0.0]
/** 열기/닫기 전체 흐름 동안 카메라가 한 번에 부드럽게 이동하는 이징 */
const CAMERA_FLOW_EASE = 'power2.inOut'

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

  /* ── 책 상태: closed → opening → riffling → open → closing → closed ── */
  const phase = useBookStore((s) => s.phase)
  const spreadVisible = useBookStore((s) => s.spreadVisible)
  const [coverOpen, setCoverOpen] = useState(false)
  const camera = useThree((s) => s.camera)
  const controls = useRef<OrbitControlsImpl>(null)
  const bookShift = useRef<Group>(null)
  const timeline = useRef<gsap.core.Timeline | null>(null)
  const [openDistance, setOpenDistance] = useState(MAX_DISTANCE)

  useEffect(() => () => void timeline.current?.kill(), [])

  /* ── 메모 상태 ── */
  const memoBusy = useMemoStore((s) => s.draggingId !== null || s.focusedId !== null)
  const cursor = useMemoStore((s) => s.cursor.memo ?? s.cursor.page ?? s.cursor.book ?? 'auto')
  useEffect(() => {
    document.body.style.cursor = cursor
  }, [cursor])

  /** 카메라를 목표로 한 번에 부드럽게 이동 */
  const moveCamera = (tl: gsap.core.Timeline, to: [number, number, number], duration: number) => {
    const target = controls.current?.target.clone() ?? new Vector3(...CAMERA_TARGET)
    tl.to(
      camera.position,
      { x: to[0], y: to[1], z: to[2], duration, ease: CAMERA_FLOW_EASE, onUpdate: () => camera.lookAt(target) },
      0,
    )
  }

  /** 표지 열림 → 면지 잠깐 → 촤르륵 넘김 → 목표 페이지 도착 */
  const openBook = () => {
    const { setPhase } = useBookStore.getState()
    const persp = camera as PerspectiveCameraImpl
    const openPos = openCameraPosition(persp.aspect, persp.fov)
    setOpenDistance(Math.hypot(...openPos))
    setPhase('opening')
    setCoverOpen(true)

    const riffleAt = OPEN_DURATION + ENDPAPER_PAUSE
    const tl = gsap.timeline()
    // 카메라는 표지 열림부터 넘김 끝까지 한 번의 이동으로 책상 내려다보는 시점에 도착
    moveCamera(tl, openPos, riffleAt + RIFFLE_DURATION)
    if (bookShift.current)
      tl.to(bookShift.current.position, { x: OPEN_BOOK_SHIFT_X, duration: OPEN_DURATION, ease: OPEN_EASE }, 0)
    tl.call(
      () => {
        setPhase('riffling')
        riffleTo(TARGET_PAGE, { onComplete: () => useBookStore.getState().setPhase('open') })
      },
      [],
      riffleAt,
    )
    timeline.current = tl
  }

  /** (메모가 모두 제자리일 때만) 역방향 넘김으로 처음까지 되감은 뒤 표지 닫힘 */
  const closeBook = () => {
    const ms = useMemoStore.getState()
    if (ms.draggingId || ms.focusedId) return
    if (!selectAllMemosHome(ms)) return ms.reject() // 닫히지 않고 들썩임 피드백만
    const { setPhase } = useBookStore.getState()
    setPhase('closing')

    const tl = gsap.timeline()
    moveCamera(tl, isFree ? FREE_CAMERA_POSITION : ORBIT_CAMERA_POSITION, RIFFLE_DURATION + CLOSE_DURATION)
    if (bookShift.current)
      tl.to(bookShift.current.position, { x: 0, duration: CLOSE_DURATION, ease: CLOSE_EASE }, RIFFLE_DURATION)
    riffleTo(0, { onComplete: () => setCoverOpen(false) })
    tl.call(() => setPhase('closed'), [], RIFFLE_DURATION + CLOSE_DURATION)
    timeline.current = tl
  }

  const toggleBook = () => {
    const p = useBookStore.getState().phase
    if (p === 'closed') openBook()
    else if (p === 'open') closeBook()
    // 애니메이션 중(opening / riffling / closing)에는 모든 클릭 무시
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

  // 책 좌표계를 공유하는 것들(넘어가는 종이, 펼침면, 책상)도 같은 그룹 안에 둠.
  // 펼치면 bookShift 그룹이 옆으로 옮겨가 펼친 책 전체가 화면 중앙에 옴
  const page = PAGES[0]
  const isOpen = phase === 'open'
  const bookNode = (
    <group ref={bookShift}>
      <Book
        coverOpen={coverOpen}
        phase={phase}
        onToggle={toggleBook}
        coverContent={<SpreadLeft page={page} visible={spreadVisible} />}
      />
      <RiffleLeaves />
      <Spread page={page} visible={spreadVisible} interactive={isOpen} />
      {/* 책상 그림자: 넘김이 시작되면 나타나 더미 두께 변화를 그대로 따라감 */}
      <Desk visible={coverOpen && phase !== 'opening'} />
    </group>
  )
  const controlsEnabled = (phase === 'closed' || phase === 'open') && !memoBusy
  // 펼친 상태: 수직에서 살짝 기울이기만 / 닫힌 상태: 자유 회전
  const polar: [number, number] = isOpen ? [Math.PI / 2 - OPEN_TILT_LIMIT, Math.PI / 2 + OPEN_TILT_LIMIT] : [0, Math.PI]
  const azimuth: [number, number] = isOpen ? [-OPEN_AZIMUTH_LIMIT, OPEN_AZIMUTH_LIMIT] : [-Infinity, Infinity]
  const maxDistance = isOpen ? Math.max(MAX_DISTANCE, openDistance * 1.25) : MAX_DISTANCE

  // Float을 바깥에 둬야 책을 어떻게 돌려도 흔들림은 항상 화면 위아래 방향
  const book = (
    <Float speed={FLOAT_SPEED} floatIntensity={FLOAT_INTENSITY} rotationIntensity={FLOAT_ROTATION_INTENSITY}>
      {isFree ? (
        <FreeRotate initialRotation={FREE_INITIAL_ROTATION} paused={phase !== 'closed'}>
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
          enabled={controlsEnabled}
          target={CAMERA_TARGET}
          enableRotate={false}
          enablePan={false}
          enableDamping
          dampingFactor={DAMPING_FACTOR}
          minDistance={MIN_DISTANCE}
          maxDistance={maxDistance}
        />
      ) : (
        <OrbitControls
          ref={controls}
          enabled={controlsEnabled} // 애니메이션·메모 드래그·크게 보기 중에는 조작 불가
          target={CAMERA_TARGET}
          enableDamping
          dampingFactor={DAMPING_FACTOR}
          enablePan={false}
          minDistance={MIN_DISTANCE}
          maxDistance={maxDistance}
          minPolarAngle={polar[0]}
          maxPolarAngle={polar[1]}
          minAzimuthAngle={azimuth[0]}
          maxAzimuthAngle={azimuth[1]}
          autoRotate={autoRotate && phase === 'closed'} // 닫혀 있을 때만 자동 회전
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
      {/* 메모 크게 보기 중 배경을 흐리게 덮는 막 (카메라 앞에 따라붙음) */}
      <FocusOverlay />
    </>
  )
}
