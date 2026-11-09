import { useMemo } from 'react'
import { MeshStandardMaterial, Shape } from 'three'
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import {
  ARC_CENTER_X,
  PAGE_COLOR,
  PAGE_ROUGHNESS,
  PAGE_SHEET_DENSITY,
  PAGE_SIGNATURE_DENSITY,
  TB_BACK_HALF_ANGLE,
  TB_CORNER_X,
  TB_FORE_CONCAVE,
  TB_FORE_X,
  TB_HALF_THICK,
  TB_HEIGHT,
  TB_RADIUS,
} from './bookConfig'
import { arcPoints, extrudeAlongY } from './geometryUtils'

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
 * 종이 결 재질 — 두께(z) 방향으로 얇은 종이 장과 접장 묶음 경계를 셰이더로 그림.
 * 멀리서 줄무늬가 지글거리지 않도록 화면 밀도(fwidth)에 따라 자연스럽게 흐려짐.
 */
function createPageMaterial() {
  const m = new MeshStandardMaterial({ color: PAGE_COLOR, roughness: PAGE_ROUGHNESS })
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uSheet = { value: PAGE_SHEET_DENSITY }
    shader.uniforms.uSig = { value: PAGE_SIGNATURE_DENSITY }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObjPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObjPos = position;')
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vObjPos;
uniform float uSheet;
uniform float uSig;
float pageHash(float n) { return fract(sin(n * 12.9898) * 43758.5453); }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
{
  // 종이 한 장 한 장
  float t = vObjPos.z * uSheet;
  float f = fract(t);
  float fade = 1.0 - smoothstep(0.2, 0.7, fwidth(t));
  float seam = 1.0 - smoothstep(0.0, 0.3, min(f, 1.0 - f));
  float sheet = mix(0.95, 1.03, pageHash(floor(t)));
  float shade = mix(1.0, sheet * (1.0 - 0.08 * seam), fade);

  // 접장(signature) 묶음 경계 — 조금 더 굵고 진하게, 위치도 살짝 불규칙
  float s = vObjPos.z * uSig + 0.15 * sin(vObjPos.y * 3.1 + vObjPos.x * 7.0);
  float g = fract(s);
  float sigFade = 1.0 - smoothstep(0.15, 0.5, fwidth(s));
  float sigLine = 1.0 - smoothstep(0.0, 0.05, min(g, 1.0 - g));
  shade *= 1.0 - 0.16 * sigLine * sigFade;

  diffuseColor.rgb *= shade;
}`,
      )
  }
  m.customProgramCacheKey = () => 'book-pages'
  return m
}

export default function TextBlock() {
  const geometry = useMemo(() => createTextBlockGeometry(), [])
  const material = useMemo(() => createPageMaterial(), [])
  return <mesh name="textBlock" geometry={geometry} material={material} />
}
