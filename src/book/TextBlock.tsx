import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { MeshStandardMaterial, Shape } from 'three'
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import {
  ARC_CENTER_X,
  PAGE_COLOR,
  PAGE_ROUGHNESS,
  TB_BACK_HALF_ANGLE,
  TB_CORNER_X,
  TB_FORE_CONCAVE,
  TB_FORE_X,
  TB_HALF_THICK,
  TB_HEIGHT,
  TB_RADIUS,
} from './bookConfig'
import { arcPoints, extrudeAlongY } from './geometryUtils'
import { GRAIN_HEADER, grainUniforms } from './paperGrain'
import { rightThickness, TOTAL_THICK } from '../riffle/stackGeometry'

/** 단면: 등 쪽은 볼록한 원호(rounded back), 책배 쪽은 살짝 오목 */
function createTextBlockGeometry() {
  const h = TB_HALF_THICK
  const shape = new Shape()
  shape.moveTo(TB_FORE_X, h)
  shape.lineTo(TB_CORNER_X, h)
  const back = arcPoints(ARC_CENTER_X, TB_RADIUS, Math.PI - TB_BACK_HALF_ANGLE, Math.PI + TB_BACK_HALF_ANGLE, 40)
  back.slice(1).forEach((p) => shape.lineTo(p.x, p.y))
  shape.lineTo(TB_FORE_X, -h)
  // 제어점을 2배 깊이에 두면 가운데가 정확히 TB_FORE_CONCAVE 만큼 들어감
  shape.quadraticCurveTo(TB_FORE_X - TB_FORE_CONCAVE * 2, 0, TB_FORE_X, h)

  return toCreasedNormals(extrudeAlongY(shape, TB_HEIGHT), Math.PI / 5)
}

/**
 * 오른쪽 속지 더미 재질 — 바닥(뒤표지 쪽)은 고정, 윗면 높이를 uThick 으로 실시간 조절.
 * 펼친 위치가 뒤로 갈수록(왼쪽 더미가 두꺼워질수록) 얇아짐. 옆면에는 종이 결.
 */
function createPageMaterial(thick: { value: number }) {
  const m = new MeshStandardMaterial({ color: PAGE_COLOR, roughness: PAGE_ROUGHNESS })
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, grainUniforms(), { uThick: thick })
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uThick;
varying vec3 vObjPos;
varying vec3 vObjNormal;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
transformed.z = ${(-TB_HALF_THICK).toFixed(5)} + (position.z + ${TB_HALF_THICK.toFixed(5)}) * (uThick / ${TOTAL_THICK.toFixed(5)});
vObjPos = transformed;
vObjNormal = normal;`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vObjPos;
varying vec3 vObjNormal;
${GRAIN_HEADER}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
diffuseColor.rgb *= paperGrain(vObjPos.z, vObjPos, vObjNormal);`,
      )
  }
  m.customProgramCacheKey = () => 'book-pages'
  return m
}

/** 오른쪽 속지 더미 (닫힌 상태에서는 속지 뭉치 전체) */
export default function TextBlock() {
  const geometry = useMemo(() => createTextBlockGeometry(), [])
  const thick = useMemo(() => ({ value: TOTAL_THICK }), [])
  const material = useMemo(() => createPageMaterial(thick), [thick])
  useFrame(() => {
    thick.value = rightThickness()
  })
  return <mesh name="textBlock" geometry={geometry} material={material} />
}
