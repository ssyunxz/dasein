import { useEffect, useRef, type ReactNode } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Quaternion, Vector3, type Group } from 'three'

/* ──────────────────────────────────────────────
 * 자유 회전 설정값
 * 카메라는 고정, 드래그하면 책 자체가 손가락을 따라 회전.
 * 화면 기준 축으로 돌기 때문에 어느 방향이든 제한 없이 굴릴 수 있음.
 * ────────────────────────────────────────────── */

/** 드래그 1px 당 회전량 (라디안) */
const ROTATE_SPEED = 0.008
/** 손을 뗀 뒤 관성이 줄어드는 속도 (클수록 빨리 멈춤) */
const INERTIA_DECAY = 4
/** 손 뗄 때 이 시간(ms) 이상 멈춰 있었으면 관성 없이 정지 */
const INERTIA_STILL_MS = 80
/** 자동 회전 속도 (라디안/초) — 화면 세로축 기준 */
const AUTO_ROTATE_SPEED = 0.25
/** 조작 후 자동 회전 재개까지 대기 */
const AUTO_ROTATE_RESUME_MS = 2500
/** 자동 회전이 서서히 빨라지는 정도 (클수록 빨리 최고 속도) */
const AUTO_ROTATE_EASE = 1.2

type Props = {
  children: ReactNode
  /** 처음 보이는 각도 [x, y, z] (라디안) */
  initialRotation?: [number, number, number]
}

const _right = new Vector3()
const _up = new Vector3()
const _q = new Quaternion()

export default function FreeRotate({ children, initialRotation = [0, 0, 0] }: Props) {
  const group = useRef<Group>(null)
  const { gl, camera } = useThree()
  const s = useRef({
    pointers: new Set<number>(),
    dragging: false,
    lastX: 0,
    lastY: 0,
    lastT: 0,
    vx: 0, // 라디안/초
    vy: 0,
    idleSince: performance.now(),
    auto: 0, // 자동 회전 세기 0~1
  })

  // 화면 기준(카메라의 오른쪽/위쪽 축)으로 책을 회전
  const rotate = (ax: number, ay: number) => {
    const g = group.current
    if (!g) return
    _right.set(1, 0, 0).applyQuaternion(camera.quaternion)
    _up.set(0, 1, 0).applyQuaternion(camera.quaternion)
    g.quaternion.premultiply(_q.setFromAxisAngle(_up, ax))
    g.quaternion.premultiply(_q.setFromAxisAngle(_right, ay))
  }

  useEffect(() => {
    const el = gl.domElement
    const st = s.current

    const onDown = (e: PointerEvent) => {
      st.pointers.add(e.pointerId)
      // 두 손가락(핀치 줌) 중에는 회전하지 않음
      st.dragging = st.pointers.size === 1
      st.lastX = e.clientX
      st.lastY = e.clientY
      st.lastT = performance.now()
      st.vx = st.vy = 0
      st.auto = 0
    }
    const onMove = (e: PointerEvent) => {
      if (!st.dragging || !st.pointers.has(e.pointerId)) return
      const now = performance.now()
      const dt = Math.max(1, now - st.lastT) / 1000
      const ax = (e.clientX - st.lastX) * ROTATE_SPEED
      const ay = (e.clientY - st.lastY) * ROTATE_SPEED
      rotate(ax, ay)
      st.vx = ax / dt
      st.vy = ay / dt
      st.lastX = e.clientX
      st.lastY = e.clientY
      st.lastT = now
    }
    const onUp = (e: PointerEvent) => {
      if (!st.pointers.delete(e.pointerId)) return
      if (st.pointers.size > 0) return
      const now = performance.now()
      if (now - st.lastT > INERTIA_STILL_MS) st.vx = st.vy = 0
      st.dragging = false
      st.idleSince = now
    }

    el.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, camera])

  useFrame((_, delta) => {
    const st = s.current
    if (st.dragging) return
    const dt = Math.min(delta, 0.05)

    // 관성
    if (Math.abs(st.vx) + Math.abs(st.vy) > 0.01) {
      rotate(st.vx * dt, st.vy * dt)
      const k = Math.exp(-INERTIA_DECAY * dt)
      st.vx *= k
      st.vy *= k
      st.idleSince = performance.now()
      return
    }
    st.vx = st.vy = 0

    // 자동 회전 (대기 후 서서히 시작)
    if (performance.now() - st.idleSince > AUTO_ROTATE_RESUME_MS) {
      st.auto = Math.min(1, st.auto + dt * AUTO_ROTATE_EASE)
      rotate(AUTO_ROTATE_SPEED * st.auto * dt, 0)
    }
  })

  return (
    <group ref={group} rotation={initialRotation}>
      {children}
    </group>
  )
}
