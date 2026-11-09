import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BoxGeometry, BufferAttribute, BufferGeometry, DoubleSide, MeshStandardMaterial, type Group, type Mesh } from 'three'
import TextBlock from './book/TextBlock'
import Headband from './book/Headband'
import { PAGE_COLOR, PAGE_ROUGHNESS, TB_HALF_THICK } from './book/bookConfig'
import { GRAIN_HEADER, grainUniforms } from './book/paperGrain'
import {
  bezierPoint,
  bridgeControls,
  isSplit,
  LEFT_BOTTOM_Z,
  LEFT_X0,
  leftThickness,
  PAGE_H,
  PAGE_W,
  rightThickness,
  TOTAL_THICK,
  type V2,
} from './riffle/stackGeometry'

/*
 * 펼친 책의 속지 더미
 *  - RightStack: 오른쪽 더미 = 기존 속지 뭉치(둥근 등 포함). 윗면이 내려가며 얇아짐. 머리띠도 함께 납작해짐
 *  - LeftStack: 앞표지 안쪽에 쌓이는 왼쪽 더미 (Book의 앞표지 그룹 안에서 렌더, 앞표지 좌표계)
 *  - GutterBridge: 두 더미 윗면을 제본 골에서 잇는 휘어진 종이 면 (윗면이 골 쪽으로 말려 내려가는 모양)
 * 두께는 매 프레임 stackGeometry(pageState)에서 읽어 셰이더/변환에 반영 → React 재렌더 없음.
 */

export function RightStack() {
  const headbands = useRef<Group>(null)
  useFrame(() => {
    const g = headbands.current
    if (!g) return
    // 바닥(-TB_HALF_THICK)을 기준으로 두께 비율만큼 납작하게
    const r = rightThickness() / TOTAL_THICK
    g.scale.z = r
    g.position.z = -TB_HALF_THICK * (1 - r)
  })
  return (
    <group name="rightStack">
      <TextBlock />
      <group ref={headbands}>
        <Headband side={1} />
        <Headband side={-1} />
      </group>
    </group>
  )
}

/** 왼쪽 더미 재질: 바닥은 앞표지 안쪽(LEFT_BOTTOM_Z)에 붙고, 위(-z)로 uThick 만큼 쌓임 */
function createLeftStackMaterial(thick: { value: number }) {
  const m = new MeshStandardMaterial({ color: PAGE_COLOR, roughness: PAGE_ROUGHNESS })
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, grainUniforms(), { uThick: thick })
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uThick;
varying float vDepth;
varying vec3 vObjPos;
varying vec3 vObjNormal;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
float stackT = 0.5 - position.z; // 0 = 바닥(표지 쪽), 1 = 윗면
transformed.z = ${LEFT_BOTTOM_Z.toFixed(5)} - stackT * uThick;
vDepth = stackT * uThick;
vObjPos = transformed;
vObjNormal = normal;`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying float vDepth;
varying vec3 vObjPos;
varying vec3 vObjNormal;
${GRAIN_HEADER}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
diffuseColor.rgb *= paperGrain(vDepth, vObjPos, vObjNormal);`,
      )
  }
  m.customProgramCacheKey = () => 'left-stack'
  return m
}

export function LeftStack() {
  const mesh = useRef<Mesh>(null)
  const geometry = useMemo(() => {
    const g = new BoxGeometry(PAGE_W, PAGE_H, 1)
    g.translate(LEFT_X0 + PAGE_W / 2, 0, 0)
    return g
  }, [])
  const thick = useMemo(() => ({ value: 0 }), [])
  const material = useMemo(() => createLeftStackMaterial(thick), [thick])
  useFrame(() => {
    thick.value = leftThickness()
    if (mesh.current) mesh.current.visible = thick.value > 0.0005
  })
  return <mesh ref={mesh} name="leftStack" geometry={geometry} material={material} visible={false} frustumCulled={false} />
}

/* ━━━ 제본 골 곡면 ━━━ */

const BRIDGE_SEGMENTS = 40

export function GutterBridge() {
  const mesh = useRef<Mesh>(null)
  const geometry = useMemo(() => {
    const g = new BufferGeometry()
    const n = BRIDGE_SEGMENTS + 1
    g.setAttribute('position', new BufferAttribute(new Float32Array(n * 2 * 3), 3))
    const idx: number[] = []
    for (let i = 0; i < BRIDGE_SEGMENTS; i++) {
      const a = i * 2
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
    g.setIndex(idx)
    return g
  }, [])
  const p: V2 = [0, 0]

  useFrame(() => {
    const m = mesh.current
    if (!m) return
    m.visible = isSplit()
    if (!m.visible) return
    const c = bridgeControls()
    const pos = geometry.attributes.position as BufferAttribute
    for (let i = 0; i <= BRIDGE_SEGMENTS; i++) {
      bezierPoint(c, i / BRIDGE_SEGMENTS, p)
      pos.setXYZ(i * 2, p[0], PAGE_H / 2, p[1])
      pos.setXYZ(i * 2 + 1, p[0], -PAGE_H / 2, p[1])
    }
    pos.needsUpdate = true
    geometry.computeVertexNormals()
    geometry.computeBoundingSphere()
  })

  return (
    <mesh ref={mesh} name="gutterBridge" geometry={geometry} visible={false} frustumCulled={false}>
      <meshStandardMaterial color={PAGE_COLOR} roughness={PAGE_ROUGHNESS} side={DoubleSide} />
    </mesh>
  )
}
