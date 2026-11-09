import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferAttribute, BufferGeometry, CanvasTexture, DoubleSide, SRGBColorSpace, type Group } from 'three'
import { PAGE_COLOR, PAGE_ROUGHNESS, TB_FORE_X } from './book/bookConfig'
import { RIFFLE_LEAF_BEND, RIFFLE_LEAF_GAP, RIFFLE_LEAVES } from './riffle/riffleConfig'
import {
  bezierPoint,
  bridgeControls,
  gutterRight,
  leafState,
  OPEN_COVER_ANGLE,
  PAGE_H,
  type V2,
} from './riffle/stackGeometry'

/*
 * 촤르륵 넘어가는 종이들 (RIFFLE_LEAVES 장).
 * 각 장은 제본 골 곡면을 따라 뿌리(책등 쪽 모서리)가 오른쪽 끝 → 왼쪽 끝으로 이동하면서
 * 0° → 표지 열림 각도까지 회전. 끝으로 갈수록 각도가 뒤처지게(진행 방향 반대로) 휘어지고,
 * 휨은 중간 각도에서 가장 큼. 장마다 높이를 조금씩 달리해 겹치거나 더미를 뚫지 않음.
 */

const SEGMENTS = 36

/** 흐릿한 글줄 무늬 (읽을 수 없는 정도) */
function createLinesTexture() {
  const w = 256
  const h = 512
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  ctx.fillStyle = PAGE_COLOR
  ctx.fillRect(0, 0, w, h)
  ctx.filter = 'blur(1.6px)'
  ctx.fillStyle = 'rgba(70, 58, 48, 0.22)'
  const top = h * 0.09
  const bottom = h * 0.89
  const lh = 11
  for (let y = top; y < bottom; y += lh) {
    // 문단 끝처럼 가끔 짧은 줄
    const short = Math.sin(y * 0.37) > 0.82
    const x0 = w * 0.16
    const x1 = short ? w * (0.4 + 0.3 * Math.abs(Math.sin(y))) : w * 0.9
    ctx.fillRect(x0, y, x1 - x0, 3)
  }
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  return tex
}

function createLeafGeometry() {
  const n = SEGMENTS + 1
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array(n * 2 * 3), 3))
  const uv = new Float32Array(n * 2 * 2)
  const idx: number[] = []
  for (let i = 0; i < n; i++) {
    uv.set([i / SEGMENTS, 1, i / SEGMENTS, 0], i * 4)
    if (i < SEGMENTS) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2)
  }
  g.setAttribute('uv', new BufferAttribute(uv, 2))
  g.setIndex(idx)
  return g
}

export default function RiffleLeaves() {
  const group = useRef<Group>(null)
  const geometries = useMemo(() => Array.from({ length: RIFFLE_LEAVES }, createLeafGeometry), [])
  const texture = useMemo(() => createLinesTexture(), [])
  const root: V2 = [0, 0]

  useFrame(() => {
    const g = group.current
    if (!g) return
    g.visible = leafState.active
    if (!leafState.active) return

    const bridge = bridgeControls()
    const length = TB_FORE_X - gutterRight()[0] // 오른쪽 본문 끝까지
    const ds = length / SEGMENTS
    const n = RIFFLE_LEAVES

    geometries.forEach((geo, k) => {
      const p = leafState.progress[k]?.p ?? 0
      bezierPoint(bridge, p, root) // 뿌리: 골 곡면 위를 오른쪽 → 왼쪽
      const phi = OPEN_COVER_ANGLE * p
      const bend = RIFFLE_LEAF_BEND * Math.sin(Math.PI * p)
      // 높이: 오른쪽에서는 아직 안 넘어간 장일수록 위, 왼쪽에서는 먼저 넘어간 장일수록 아래
      const offRight = (n - k) * RIFFLE_LEAF_GAP + 0.0006
      const offLeft = (k + 1) * RIFFLE_LEAF_GAP + 0.0006
      const off = offRight + (-offLeft - offRight) * p
      const nx = -Math.sin(phi) * off
      const nz = Math.cos(phi) * off

      const pos = geo.attributes.position as BufferAttribute
      let x = root[0]
      let z = root[1]
      for (let i = 0; i <= SEGMENTS; i++) {
        pos.setXYZ(i * 2, x + nx, PAGE_H / 2, z + nz)
        pos.setXYZ(i * 2 + 1, x + nx, -PAGE_H / 2, z + nz)
        // 다음 점: 뿌리에서 멀어질수록 각도가 뒤처짐 (종이 끝이 공기에 밀리는 느낌)
        const a = phi - bend * ((i + 0.5) / SEGMENTS)
        x += Math.cos(a) * ds
        z += Math.sin(a) * ds
      }
      pos.needsUpdate = true
      geo.computeVertexNormals()
      geo.computeBoundingSphere()
    })
  })

  return (
    <group ref={group} name="riffleLeaves" visible={false}>
      {geometries.map((geo, k) => (
        <mesh key={k} geometry={geo} frustumCulled={false}>
          <meshStandardMaterial map={texture} roughness={PAGE_ROUGHNESS} side={DoubleSide} />
        </mesh>
      ))}
    </group>
  )
}
