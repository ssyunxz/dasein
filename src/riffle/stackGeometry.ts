import {
  BOARD_INNER_X,
  BOARD_THICKNESS,
  BOOK_THICKNESS,
  FRONT_HINGE,
  OPEN_ANGLE,
  TB_CORNER_X,
  TB_FORE_X,
  TB_HALF_THICK,
  TB_HEIGHT,
} from '../book/bookConfig'
import { OPEN_TARGET_ANGLE } from '../interactionConfig'
import { BRIDGE_K_LEFT, BRIDGE_K_RIGHT, GUTTER_LEFT, GUTTER_RIGHT, TOTAL_PAGES } from './riffleConfig'

/*
 * 펼친 책의 좌/우 속지 더미 형상 — 매 프레임 바뀌는 값은 여기 모듈 상태에서 읽음 (React 재렌더 없이).
 * 좌표: 책 좌표계(x 오른쪽, z 카메라 쪽). 왼쪽 더미는 앞표지 기준(닫힌 상태) 좌표로도 제공.
 */

export type V2 = [number, number]

/** 현재 펼친 위치 (0 = 표지 바로 뒤, TOTAL_PAGES = 끝). GSAP이 실수로 애니메이션 */
export const pageState = { current: 0 }

/** 넘어가는 종이들의 진행도 (0 = 오른쪽에 놓임, 1 = 왼쪽에 놓임) */
export const leafState = { active: false, progress: [] as { p: number }[] }

/** 펼침면이 좌/우로 나뉜 상태인지 (넘김 중이거나 0쪽이 아닐 때) */
export const isSplit = () => leafState.active || pageState.current > 0.01

export const OPEN_COVER_ANGLE = OPEN_ANGLE + OPEN_TARGET_ANGLE
const [HX, , HZ] = FRONT_HINGE
const COS = Math.cos(OPEN_COVER_ANGLE)
const SIN = Math.sin(OPEN_COVER_ANGLE)

export const PAGE_W = TB_FORE_X - TB_CORNER_X
export const PAGE_H = TB_HEIGHT
export const TOTAL_THICK = TB_HALF_THICK * 2

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/** 왼쪽 더미 두께 = 전체 × (현재 쪽 / 전체 쪽) */
export const leftThickness = () => TOTAL_THICK * clamp01(pageState.current / TOTAL_PAGES)
export const rightThickness = () => TOTAL_THICK - leftThickness()
/** 오른쪽 더미 윗면 높이 (바닥은 뒤표지 쪽 -TB_HALF_THICK 고정) */
export const rightTopZ = () => -TB_HALF_THICK + rightThickness()

/** 왼쪽 더미: 앞표지 안쪽(면지 바로 아래)에 붙어 있음. 앞표지 좌표계 기준 */
export const LEFT_X0 = BOARD_INNER_X + 0.004
export const LEFT_BOTTOM_Z = BOOK_THICKNESS / 2 - BOARD_THICKNESS - 0.0004
/** 왼쪽 더미 윗면 (앞표지 좌표계에서는 -z 쪽이 위) */
export const leftTopLocalZ = () => LEFT_BOTTOM_Z - leftThickness()

/** 앞표지 좌표 → 열린 상태 책 좌표 */
export const rotOpen = (x: number, z: number): V2 => [
  HX + (x - HX) * COS - (z - HZ) * SIN,
  HZ + (x - HX) * SIN + (z - HZ) * COS,
]
/** 열린 왼쪽 페이지가 뻗는 방향 (골 → 바깥) */
export const LEFT_DIR: V2 = [COS, SIN]

/** 골 곡면 양 끝: 오른쪽 더미 윗면 / 왼쪽 더미 윗면 */
export const gutterRight = (): V2 => [TB_CORNER_X + GUTTER_RIGHT, rightTopZ()]
export const gutterLeft = (): V2 => rotOpen(LEFT_X0 + GUTTER_LEFT, leftTopLocalZ())

/** 골 곡면 3차 베지어 제어점 (u = 0 오른쪽 끝 → u = 1 왼쪽 끝). 곡선이 오른쪽 본문으로 넘어가지 않게 제어점 x 제한 */
export function bridgeControls(): [V2, V2, V2, V2] {
  const R = gutterRight()
  const L = gutterLeft()
  const k = BRIDGE_K_LEFT * Math.hypot(L[0] - R[0], L[1] - R[1])
  return [R, [R[0] - BRIDGE_K_RIGHT, R[1]], [Math.min(L[0] - LEFT_DIR[0] * k, R[0] - 0.005), L[1] - LEFT_DIR[1] * k], L]
}

export function bezierPoint(c: [V2, V2, V2, V2], t: number, out: V2 = [0, 0]): V2 {
  const u = 1 - t
  const a = u * u * u
  const b = 3 * u * u * t
  const cc = 3 * u * t * t
  const d = t * t * t
  out[0] = a * c[0][0] + b * c[1][0] + cc * c[2][0] + d * c[3][0]
  out[1] = a * c[0][1] + b * c[1][1] + cc * c[2][1] + d * c[3][1]
  return out
}
