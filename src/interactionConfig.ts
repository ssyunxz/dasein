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

/** 열린 상태 카메라 — 위에서 비스듬히 내려다보는 각도 */
export const OPEN_CAMERA_POSITION: [number, number, number] = [0, 2.1, 4.9]

/**
 * 열렸을 때 책을 옆으로 옮기는 거리 — 펼친 폭(왼쪽: 열린 앞표지 끝 ~ 오른쪽: 뒤표지 책배)의
 * 가운데가 화면 중심에 오도록. 펼치면 무게중심이 책등 쪽으로 가므로 +x 로 이동.
 */
const openedLeftX =
  FRONT_HINGE[0] - (BOARD_OUTER_X - BOARD_INNER_X) * Math.cos(Math.PI - OPEN_TARGET_ANGLE)
export const OPEN_BOOK_SHIFT_X = -(openedLeftX + BOARD_OUTER_X) / 2
