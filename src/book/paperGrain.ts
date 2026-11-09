import { PAGE_SHEET_DENSITY, PAGE_SIGNATURE_DENSITY } from './bookConfig'

/*
 * 속지 옆면의 "종이가 겹친 결" 셰이더 조각 — 오른쪽 더미(TextBlock)와 왼쪽 더미가 함께 사용.
 * depth = 더미 두께 방향 좌표, n = 오브젝트 법선. 멀리서 지글거리지 않게 화면 밀도(fwidth)로 흐려짐.
 */

export const GRAIN_HEADER = `
uniform float uSheet;
uniform float uSig;
float pageHash(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
float paperGrain(float depth, vec3 along, vec3 n) {
  // 종이 한 장 한 장
  float t = depth * uSheet;
  float f = fract(t);
  float fade = 1.0 - smoothstep(0.2, 0.7, fwidth(t));
  float seam = 1.0 - smoothstep(0.0, 0.3, min(f, 1.0 - f));
  float sheet = mix(0.95, 1.03, pageHash(floor(t)));
  float shade = mix(1.0, sheet * (1.0 - 0.08 * seam), fade);
  // 접장(signature) 묶음 경계 — 조금 더 굵고 진하게, 위치도 살짝 불규칙
  float s = depth * uSig + 0.15 * sin(along.y * 3.1 + along.x * 7.0);
  float g = fract(s);
  float sigFade = 1.0 - smoothstep(0.15, 0.5, fwidth(s));
  float sigLine = 1.0 - smoothstep(0.0, 0.05, min(g, 1.0 - g));
  shade *= 1.0 - 0.16 * sigLine * sigFade;
  // 윗면/바닥면(법선이 두께 방향): 결 없이 고른 종이
  float flatPage = smoothstep(0.7, 0.95, abs(normalize(n).z));
  return mix(shade, 1.0, flatPage);
}`

export const grainUniforms = () => ({
  uSheet: { value: PAGE_SHEET_DENSITY },
  uSig: { value: PAGE_SIGNATURE_DENSITY },
})
