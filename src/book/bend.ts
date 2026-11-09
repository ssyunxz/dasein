import type { Material } from 'three'
import { BOARD_INNER_X, BOARD_OUTER_X } from './bookConfig'

/** 휨 정도를 담는 uniform — 매 프레임 값만 바꾸면 셰이더에서 바로 반영 */
export type BendUniform = { value: number }

/**
 * 휨 셰이더 패치: 책배 쪽으로 갈수록 s² 만큼 +z로 밀고, 법선도 그 기울기만큼 보정.
 * 앞표지판·면지·왼쪽 페이지가 같은 식을 쓰므로 함께 휘어짐.
 */
export function applyBend(material: Material, bend: BendUniform, key: string) {
  const span = (BOARD_OUTER_X - BOARD_INNER_X).toFixed(5)
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uBend = bend
    const header = `
uniform float uBend;
float bendS(float x) { return clamp((x - ${BOARD_INNER_X.toFixed(5)}) / ${span}, 0.0, 1.0); }`
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>${header}`)
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>
{
  float bs = bendS(position.x);
  float slope = uBend * 2.0 * bs / ${span};
  objectNormal = normalize(vec3(objectNormal.x - slope * objectNormal.z, objectNormal.y, objectNormal.z + slope * objectNormal.x));
}`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
{ float bs = bendS(position.x); transformed.z += uBend * bs * bs; }`,
      )
  }
  material.customProgramCacheKey = () => key
}
