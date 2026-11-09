import { Suspense, useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Text } from '@react-three/drei'
import gsap from 'gsap'
import {
  BoxGeometry,
  CanvasTexture,
  Euler,
  Matrix4,
  Mesh,
  Plane,
  Quaternion,
  Ray,
  Vector2,
  Vector3,
  type Group,
  type MeshBasicMaterial,
} from 'three'
import type { MemoData } from '../data/pages'
import { CLICK_MAX_MOVE_PX } from '../interactionConfig'
import {
  DRAG_FOLLOW,
  DRAG_LIFT,
  DRAG_TILT_MAX,
  DRAG_TILT_PER_SPEED,
  DROP_DURATION,
  FOCUS_DISTANCE,
  FOCUS_DURATION,
  FOCUS_EASE,
  FOCUS_OVERLAY_COLOR,
  FOCUS_OVERLAY_DISTANCE,
  FOCUS_OVERLAY_OPACITY,
  HAND_FONT,
  LAND_BOUNCE,
  MEMO_CLEARANCE,
  MEMO_CURL,
  MEMO_CURL_RADIUS,
  MEMO_FONT_SIZE,
  MEMO_HOVER_DURATION,
  MEMO_HOVER_LIFT,
  MEMO_INK,
  MEMO_SHADOW_OPACITY,
  MEMO_SHADOW_SPREAD,
  MEMO_SIZE,
  MEMO_THICKNESS,
  NUDGE_HEIGHT,
  RETURN_HOME_DURATION,
} from './memoConfig'
import {
  homePlacement,
  leftPlaneZ,
  maxSurfaceZ,
  resolveDrop,
  restPose,
  surfaceAt,
  type MemoPlacement,
} from './surfaces'
import { useMemoStore } from './useMemoStore'

/* ━━━ 모양 ━━━ */

/** 얇은 박스를 잘게 나눈 뒤, 오른쪽 위 모서리만 아주 살짝 들어올림 */
function createMemoGeometry() {
  const [w, h] = MEMO_SIZE
  const geo = new BoxGeometry(w, h, MEMO_THICKNESS, 18, 18, 1)
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const d = Math.hypot(pos.getX(i) - w / 2, pos.getY(i) - h / 2)
    const t = Math.max(0, 1 - d / MEMO_CURL_RADIUS)
    pos.setZ(i, pos.getZ(i) + MEMO_CURL * t * t)
  }
  geo.computeVertexNormals()
  return geo
}

/** 부드러운 원형 그림자 텍스처 */
function createShadowTexture() {
  const s = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = s
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(s / 2, s / 2, s * 0.15, s / 2, s / 2, s / 2)
  g.addColorStop(0, 'rgba(40,30,22,1)')
  g.addColorStop(1, 'rgba(40,30,22,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, s, s)
  return new CanvasTexture(canvas)
}

/* ━━━ 계산용 임시 객체 ━━━ */
const _inv = new Matrix4()
const _ray = new Ray()
const _plane = new Plane()
const _hit = new Vector3()
const _flat = new Quaternion()
const _e = new Euler()
const Z = new Vector3(0, 0, 1)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const damp = (rate: number, dt: number) => 1 - Math.exp(-rate * dt)
const clampAbs = (v: number, m: number) => Math.max(-m, Math.min(m, v))

type Props = {
  memo: MemoData
  /** 넘김이 끝나 책이 완전히 펼쳐졌을 때만 조작 가능 */
  interactive: boolean
}

export default function StickyMemo({ memo, interactive }: Props) {
  const active = interactive
  const outer = useRef<Group>(null)
  const inner = useRef<Group>(null)
  const shadow = useRef<Mesh>(null)
  const geometry = useMemo(() => createMemoGeometry(), [])
  const shadowTexture = useMemo(() => createShadowTexture(), [])
  const home = useMemo(() => homePlacement(memo.homePosition, memo.homeRotation), [memo])
  const camera = useThree((s) => s.camera)
  const focusedId = useMemoStore((s) => s.focusedId)
  const rejectPulse = useMemoStore((s) => s.rejectPulse)
  const tween = useRef<gsap.core.Animation | null>(null)

  const st = useRef({
    pos: new Vector3(),
    quat: new Quaternion(),
    spin: home.spin,
    hover: 0,
    hop: 0,
    airX: 0,
    airY: 0,
    vel: new Vector2(),
    target: new Vector2(),
    grab: new Vector2(),
    ray: null as Ray | null,
    down: null as { x: number; y: number; id: number } | null,
    dragging: false,
    hovered: false,
    focused: false,
    skipClick: false,
  })

  const placement = (): MemoPlacement => useMemoStore.getState().placements[memo.id] ?? home

  // 사라질 때 커서 요청 정리
  useEffect(() => () => useMemoStore.getState().setCursor('memo', null), [])

  // 처음 위치
  useEffect(() => {
    const p = restPose(placement())
    st.current.pos.copy(p.pos)
    st.current.quat.copy(p.quat)
    st.current.spin = placement().spin
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * 목표 자세로 이동. land = true 이면 z는 따로: 떨어지듯 내려와 아주 살짝 튕긴 뒤 안착.
   * xyDuration 을 z보다 짧게 주면 먼저 옆으로 빠진 뒤 내려앉아 책 모서리를 스치지 않음.
   */
  const animateTo = (
    end: { pos: Vector3; quat: Quaternion },
    duration: number,
    ease: string,
    land = false,
    xyDuration = duration,
  ) => {
    tween.current?.kill()
    const s = st.current
    const p0 = s.pos.clone()
    const q0 = s.quat.clone()
    const xy = { t: 0 }
    const rot = { t: 0 }
    const tl = gsap.timeline()
    tl.to(xy, {
      t: 1,
      duration: xyDuration,
      ease,
      onUpdate: () => {
        s.pos.x = lerp(p0.x, end.pos.x, xy.t)
        s.pos.y = lerp(p0.y, end.pos.y, xy.t)
        if (!land) s.pos.z = lerp(p0.z, end.pos.z, xy.t)
      },
    }, 0)
    tl.to(rot, { t: 1, duration, ease, onUpdate: () => void s.quat.slerpQuaternions(q0, end.quat, rot.t) }, 0)
    if (land) {
      const z = { v: p0.z }
      const apply = () => void (s.pos.z = z.v)
      tl.to(z, { v: end.pos.z, duration, ease: 'power2.in', onUpdate: apply }, 0)
        .to(z, { v: end.pos.z + LAND_BOUNCE, duration: 0.07, ease: 'power2.out', onUpdate: apply })
        .to(z, { v: end.pos.z, duration: 0.09, ease: 'power2.in', onUpdate: apply })
    }
    tween.current = tl
  }

  /* ━━━ 크게 보기 / 되돌아가기 ━━━ */
  useEffect(() => {
    const s = st.current
    const g = outer.current
    if (!g?.parent) return
    if (focusedId === memo.id && !s.focused) {
      s.focused = true
      s.hover = 0
      const parent = g.parent
      parent.updateWorldMatrix(true, false)
      const dir = camera.getWorldDirection(new Vector3())
      const pos = parent.worldToLocal(camera.position.clone().addScaledVector(dir, FOCUS_DISTANCE))
      const quat = parent.getWorldQuaternion(new Quaternion()).invert().multiply(camera.quaternion)
      animateTo({ pos, quat }, FOCUS_DURATION, FOCUS_EASE)
    } else if (focusedId !== memo.id && s.focused) {
      s.focused = false
      animateTo(restPose(placement()), FOCUS_DURATION, FOCUS_EASE)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedId])

  /* ━━━ 넘기기/닫기 거부 → 밖에 있는 메모만 살짝 들썩 ━━━ */
  const firstPulse = useRef(true)
  useEffect(() => {
    if (firstPulse.current) {
      firstPulse.current = false
      return
    }
    if (placement().location === 'home') return
    const s = st.current
    gsap
      .timeline()
      .to(s, { hop: NUDGE_HEIGHT, duration: 0.12, ease: 'power2.out' })
      .to(s, { hop: 0, duration: 0.3, ease: 'bounce.out' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rejectPulse])

  /* ━━━ 매 프레임: 드래그 추적, 기울기, 그림자 ━━━ */
  useFrame((_, delta) => {
    const s = st.current
    const g = outer.current
    const ig = inner.current
    if (!g || !ig) return
    const dt = Math.min(delta, 0.05)
    let tiltX = 0
    let tiltY = 0

    if (s.dragging) {
      if (s.ray && g.parent) {
        _inv.copy(g.parent.matrixWorld).invert()
        _ray.copy(s.ray).applyMatrix4(_inv)
        _plane.set(Z, -s.pos.z)
        if (_ray.intersectPlane(_plane, _hit)) s.target.set(_hit.x + s.grab.x, _hit.y + s.grab.y)
      }
      const px = s.pos.x
      const py = s.pos.y
      const k = damp(DRAG_FOLLOW, dt)
      s.pos.x += (s.target.x - s.pos.x) * k
      s.pos.y += (s.target.y - s.pos.y) * k
      // 아래 표면(메모 넓이만큼 살핀 최고점) + 들어올림 높이
      const zTarget = maxSurfaceZ(s.pos.x, s.pos.y) + MEMO_THICKNESS / 2 + DRAG_LIFT
      s.pos.z += (zTarget - s.pos.z) * damp(10, dt)
      // 속도 → 공기 받는 듯한 기울기 (메모 자기 방향 기준으로 변환)
      const vx = (s.pos.x - px) / Math.max(dt, 1e-3)
      const vy = (s.pos.y - py) / Math.max(dt, 1e-3)
      s.vel.x += (vx - s.vel.x) * damp(8, dt)
      s.vel.y += (vy - s.vel.y) * damp(8, dt)
      const c = Math.cos(-s.spin)
      const sn = Math.sin(-s.spin)
      const lx = s.vel.x * c - s.vel.y * sn
      const ly = s.vel.x * sn + s.vel.y * c
      tiltX = clampAbs(ly * DRAG_TILT_PER_SPEED, DRAG_TILT_MAX) // 진행 방향 쪽 가장자리가 들림
      tiltY = clampAbs(-lx * DRAG_TILT_PER_SPEED, DRAG_TILT_MAX)
      // 떠 있는 동안은 표면 기울기 없이 수평으로
      _flat.setFromEuler(_e.set(0, 0, s.spin, 'XYZ'))
      s.quat.slerp(_flat, damp(8, dt))
    }
    s.airX += (tiltX - s.airX) * damp(10, dt)
    s.airY += (tiltY - s.airY) * damp(10, dt)

    // 가만히 놓여 있을 때는 아래 표면(더미 윗면) 높이 변화를 그대로 따라감
    if (!s.dragging && !s.focused && !tween.current?.isActive()) restPose(placement(), s)

    g.position.copy(s.pos)
    g.quaternion.copy(s.quat)
    ig.position.z = s.hover + s.hop
    ig.rotation.set(s.airX, s.airY, 0)

    // 그림자: 바로 아래 표면에 붙음. 높이 뜰수록 넓고 옅게
    const sh = shadow.current
    if (sh) {
      const sf = surfaceAt(s.pos.x, s.pos.y)
      const restZ = sf.z + MEMO_THICKNESS / 2 + MEMO_CLEARANCE
      const height = Math.max(0, s.pos.z - restZ) + s.hover + s.hop
      sh.visible = !s.focused
      const z = sf.region === 'left' || (sf.region === 'book' && sf.tilt !== 0) ? leftPlaneZ(s.pos.x) : sf.z
      sh.position.set(s.pos.x, s.pos.y, z + 0.0006 * Math.cos(sf.tilt))
      sh.rotation.set(0, sf.tilt, s.spin, 'XYZ')
      sh.scale.setScalar(1.08 + height * MEMO_SHADOW_SPREAD)
      ;(sh.material as MeshBasicMaterial).opacity = MEMO_SHADOW_OPACITY / (1 + height * 14)
    }
  })

  /* ━━━ 포인터 ━━━ */
  const setCursor = useMemoStore.getState().setCursor

  const beginDrag = () => {
    const s = st.current
    const g = outer.current
    tween.current?.kill()
    s.dragging = true
    s.vel.set(0, 0)
    gsap.to(s, { hover: 0, duration: 0.15 })
    // 잡은 지점과 메모 중심의 차이를 유지 (메모가 포인터로 순간이동하지 않게)
    if (s.ray && g?.parent) {
      _inv.copy(g.parent.matrixWorld).invert()
      _ray.copy(s.ray).applyMatrix4(_inv)
      _plane.set(Z, -s.pos.z)
      if (_ray.intersectPlane(_plane, _hit)) s.grab.set(s.pos.x - _hit.x, s.pos.y - _hit.y)
    }
    s.target.set(s.pos.x, s.pos.y)
    setCursor('memo', 'grabbing')
  }

  const drop = () => {
    const s = st.current
    const store = useMemoStore.getState()
    const next = resolveDrop(s.pos.x, s.pos.y, s.spin, home)
    store.place(memo.id, next)
    s.spin = next.spin
    const pose = restPose(next)
    if (next.location === 'home') animateTo(pose, RETURN_HOME_DURATION, 'power2.inOut', true)
    else animateTo(pose, DROP_DURATION, 'power2.out', true, DROP_DURATION * 0.55)
  }

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (!active) return
    e.stopPropagation()
    const s = st.current
    s.skipClick = false
    if (useMemoStore.getState().focusedId) return // 크게 보기 중엔 클릭(onClick)만 처리
    ;(e.target as Element).setPointerCapture(e.pointerId)
    s.down = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY, id: e.pointerId }
    s.ray = e.ray.clone()
    useMemoStore.getState().setDragging(memo.id) // 카메라 조작 즉시 잠금
  }

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    const s = st.current
    if (!s.down) return
    e.stopPropagation()
    s.ray = e.ray.clone()
    if (!s.dragging) {
      const moved = Math.hypot(e.nativeEvent.clientX - s.down.x, e.nativeEvent.clientY - s.down.y)
      if (moved > CLICK_MAX_MOVE_PX) beginDrag()
    }
  }

  const onPointerUp = (e: ThreeEvent<PointerEvent>) => {
    const s = st.current
    if (!s.down) return
    e.stopPropagation()
    ;(e.target as Element).releasePointerCapture?.(s.down.id)
    const wasDrag = s.dragging
    s.down = null
    s.dragging = false
    useMemoStore.getState().setDragging(null)
    setCursor('memo', s.hovered ? 'grab' : null)
    if (!wasDrag) {
      // 드래그 없는 클릭 → 크게 보기 (이어서 오는 onClick 한 번은 무시)
      s.skipClick = true
      useMemoStore.getState().setFocused(memo.id)
      return
    }
    drop()
  }

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (!active) return
    e.stopPropagation()
    const s = st.current
    if (s.skipClick) {
      s.skipClick = false
      return
    }
    if (useMemoStore.getState().focusedId === memo.id) useMemoStore.getState().setFocused(null)
  }

  const onPointerOver = (e: ThreeEvent<PointerEvent>) => {
    if (!active) return
    e.stopPropagation()
    const s = st.current
    s.hovered = true
    if (s.focused) return setCursor('memo', 'pointer')
    if (!s.dragging) {
      setCursor('memo', 'grab')
      gsap.to(s, { hover: MEMO_HOVER_LIFT, duration: MEMO_HOVER_DURATION, ease: 'power2.out' })
    }
  }

  const onPointerOut = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    const s = st.current
    s.hovered = false
    if (!s.dragging) {
      setCursor('memo', null)
      gsap.to(s, { hover: 0, duration: MEMO_HOVER_DURATION, ease: 'power2.out' })
    }
  }

  return (
    <group>
      <group
        ref={outer}
        name={memo.id}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={onClick}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
      >
        <group ref={inner}>
          <mesh geometry={geometry}>
            <meshStandardMaterial color={memo.color} roughness={0.92} />
          </mesh>
          <Suspense fallback={null}>
          <Text
            font={HAND_FONT}
            fontSize={MEMO_FONT_SIZE}
            color={MEMO_INK}
            maxWidth={MEMO_SIZE[0] - 0.07}
            lineHeight={1.15}
            anchorX="center"
            anchorY="middle"
            textAlign="left"
            position={[0, -0.005, MEMO_THICKNESS / 2 + 0.0004]}
          >
            {memo.text}
          </Text>
          </Suspense>
        </group>
      </group>
      {/* 메모 그림자 (표면에 붙음) */}
      <mesh ref={shadow} raycast={() => null}>
        <planeGeometry args={[MEMO_SIZE[0] * 1.1, MEMO_SIZE[1] * 1.1]} />
        <meshBasicMaterial map={shadowTexture} transparent depthWrite={false} opacity={MEMO_SHADOW_OPACITY} />
      </mesh>
    </group>
  )
}

/**
 * 크게 보기 중 배경을 흐리게 덮는 반투명 막 — 카메라 바로 앞(메모보다 뒤)에 따라붙음.
 * 막을 클릭하면 메모가 제자리로 돌아감.
 */
export function FocusOverlay() {
  const focusedId = useMemoStore((s) => s.focusedId)
  const mesh = useRef<Mesh>(null)
  const material = useRef<MeshBasicMaterial>(null)
  const camera = useThree((s) => s.camera)
  const dir = useMemo(() => new Vector3(), [])

  useEffect(() => {
    if (!material.current) return
    const t = gsap.to(material.current, {
      opacity: focusedId ? FOCUS_OVERLAY_OPACITY : 0,
      duration: FOCUS_DURATION,
      ease: FOCUS_EASE,
    })
    return () => void t.kill()
  }, [focusedId])

  useFrame(() => {
    const m = mesh.current
    if (!m || !material.current) return
    m.visible = material.current.opacity > 0.002
    camera.getWorldDirection(dir)
    m.position.copy(camera.position).addScaledVector(dir, FOCUS_OVERLAY_DISTANCE)
    m.quaternion.copy(camera.quaternion)
  })

  return (
    <mesh
      ref={mesh}
      renderOrder={10}
      raycast={focusedId ? Mesh.prototype.raycast : () => null}
      onClick={(e) => {
        e.stopPropagation()
        useMemoStore.getState().setFocused(null)
      }}
    >
      <planeGeometry args={[30, 30]} />
      <meshBasicMaterial ref={material} color={FOCUS_OVERLAY_COLOR} transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}
