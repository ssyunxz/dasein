import { useEffect, useRef, useState } from 'react'
import { ContactShadows } from '@react-three/drei'
import gsap from 'gsap'
import { BOOK_HEIGHT } from './book/bookConfig'
import {
  DESK_SHADOW_BLUR,
  DESK_SHADOW_COLOR,
  DESK_SHADOW_FAR,
  DESK_SHADOW_OPACITY,
} from './memo/memoConfig'
import { DESK_Z, SPREAD } from './memo/surfaces'

/** 책상 그림자가 덮는 범위 (펼친 책 + 메모를 내려놓을 여백) */
const SHADOW_MARGIN = 1.4

/**
 * 책상 — 책 뒷면이 놓인 보이지 않는 평면 (책 좌표계 z = DESK_Z).
 * 열린 상태에서만 부드러운 접지 그림자(ContactShadows)를 서서히 드러냄.
 * ContactShadows는 자기 +y 방향 물체를 찍으므로 x축으로 90° 돌려 +z(책 쪽)를 보게 함.
 */
export default function Desk({ visible }: { visible: boolean }) {
  const [opacity, setOpacity] = useState(0)
  const current = useRef(0)

  useEffect(() => {
    const o = { v: current.current }
    const t = gsap.to(o, {
      v: visible ? DESK_SHADOW_OPACITY : 0,
      duration: 0.6,
      ease: 'power2.out',
      onUpdate: () => {
        current.current = o.v
        setOpacity(o.v)
      },
    })
    return () => void t.kill()
  }, [visible])

  if (opacity < 0.002) return null
  return (
    <ContactShadows
      position={[(SPREAD.xMin + SPREAD.xMax) / 2, 0, DESK_Z + 0.0005]}
      rotation={[Math.PI / 2, 0, 0]}
      scale={[SPREAD.xMax - SPREAD.xMin + SHADOW_MARGIN * 2, BOOK_HEIGHT + SHADOW_MARGIN * 2]}
      opacity={opacity}
      blur={DESK_SHADOW_BLUR}
      far={DESK_SHADOW_FAR}
      resolution={1024}
      color={DESK_SHADOW_COLOR}
    />
  )
}
