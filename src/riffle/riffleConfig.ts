/* ──────────────────────────────────────────────
 * 촤르륵 넘김(riffle) · 좌/우 속지 더미 설정값
 * ────────────────────────────────────────────── */

/** 전체 페이지 수 / 표지를 열면 도착할 메모 페이지 (펼침면 왼쪽 쪽수) */
export const TOTAL_PAGES = 320
export const TARGET_PAGE = 142

/** 실제로 움직이는 종이 장수 (나머지는 더미 두께 변화로 표현) */
export const RIFFLE_LEAVES = 7
/** 넘김 전체 시간 — 장 넘김과 더미 두께 변화가 같은 시간 동안 함께 진행 */
export const RIFFLE_DURATION = 1.6
/** 장 사이 시차 (앞쪽 → 뒤쪽으로 점점 늘어남) */
export const RIFFLE_STAGGER_MIN = 0.06
export const RIFFLE_STAGGER_MAX = 0.1
/** 앞쪽 장 하나가 넘어가는 시간 (마지막 장은 남은 시간을 다 써서 천천히 내려앉음) */
export const RIFFLE_FAST_LEAF = 0.42
/** 넘어가는 종이가 휘는 정도 (라디안, 가운데 각도에서 최대). 너무 크면 종이 끝이 더미를 뚫음 */
export const RIFFLE_LEAF_BEND = 0.7
/** 장마다 높이를 조금씩 다르게 (겹침·관통 방지) */
export const RIFFLE_LEAF_GAP = 0.0012

/** 표지가 열린 뒤 면지만 보이는 잠깐의 멈춤 */
export const ENDPAPER_PAUSE = 0.3

/**
 * 제본 골 곡면 — 왼쪽 더미 윗면과 오른쪽 더미 윗면을 잇는 휘어진 종이 면.
 * 양 끝이 골에서 떨어진 거리와 곡률. (경첩 천·책등을 뚫지 않도록 시뮬레이션으로 정한 값)
 */
export const GUTTER_RIGHT = 0.1
export const GUTTER_LEFT = 0.03
export const BRIDGE_K_RIGHT = 0.01
export const BRIDGE_K_LEFT = 0.8
