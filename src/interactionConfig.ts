/* ──────────────────────────────────────────────
 * 앞표지 열기/닫기 인터랙션 설정값
 * ────────────────────────────────────────────── */

import { BOARD_INNER_X, BOARD_OUTER_X, FRONT_HINGE } from './book/bookConfig'

const DEG = Math.PI / 180

/** 열림 최종 각도 — 옛 책이라 180°까지 펴지지 않고 살짝 들뜬 상태 */
export const OPEN_TARGET_ANGLE = 167 * DEG
/** 마우스를 올렸을 때 앞표지가 살짝 들리는 각도 ("열 수 있다" 힌트) */
export const HOVER_LIFT_ANGLE = 2.5 * DEG
export const HOVER_DURATION = 0.35

/** 열림/닫힘 시간(초)과 이징 */
export const OPEN_DURATION = 1.6
export const CLOSE_DURATION = 1.2
export const OPEN_EASE = 'power3.inOut'
export const CLOSE_EASE = 'power3.inOut'

/** 열리는 도중 표지가 휘는 최대량 (책배 쪽 끝이 바깥으로 밀리는 거리). 동작 중에만 0 → 이 값 → 0 */
export const BEND_MAX = 0.035
/** 휨이 최대가 되는 시점 (전체 시간 대비 비율) */
export const BEND_PEAK_AT = 0.4

/** 클릭으로 인정하는 최대 포인터 이동 거리(px). 이보다 많이 움직이면 드래그(회전)로 봄 */
export const CLICK_MAX_MOVE_PX = 6

/**
 * 열린 상태 카메라 — 책상 위 책을 거의 수직으로 내려다보는 시점.
 * 펼친 책 + 메모 내려놓을 여백(OPEN_VIEW_*)이 화면에 다 들어오도록 화면 비율에 맞춰 거리 계산.
 */
export const OPEN_VIEW_WIDTH = 4.3
export const OPEN_VIEW_HEIGHT = 3.1
export const OPEN_VIEW_TILT = 6 * DEG // 완전 수직에서 살짝만 기울임

export function openCameraPosition(aspect: number, fovDeg: number): [number, number, number] {
  const t = Math.tan((fovDeg * DEG) / 2)
  const d = Math.max(OPEN_VIEW_HEIGHT / 2 / t, OPEN_VIEW_WIDTH / 2 / (t * aspect))
  return [0, d * Math.sin(OPEN_VIEW_TILT), d * Math.cos(OPEN_VIEW_TILT)]
}

/** 열린 상태에서 허용하는 기울이기 범위 (수직 기준 위아래 / 좌우) */
export const OPEN_TILT_LIMIT = 18 * DEG
export const OPEN_AZIMUTH_LIMIT = 15 * DEG

/**
 * 열렸을 때 책을 옆으로 옮기는 거리 — 펼친 폭(왼쪽: 열린 앞표지 끝 ~ 오른쪽: 뒤표지 책배)의
 * 가운데가 화면 중심에 오도록. 펼치면 무게중심이 책등 쪽으로 가므로 +x 로 이동.
 */
const openedLeftX =
  FRONT_HINGE[0] - (BOARD_OUTER_X - BOARD_INNER_X) * Math.cos(Math.PI - OPEN_TARGET_ANGLE)
export const OPEN_BOOK_SHIFT_X = -(openedLeftX + BOARD_OUTER_X) / 2
