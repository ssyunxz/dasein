/* ──────────────────────────────────────────────
 * 페이지 본문 · 떡메모지 · 책상 설정값
 * ────────────────────────────────────────────── */

const DEG = Math.PI / 180
const BASE = import.meta.env.BASE_URL

/* ━━━ 폰트 ━━━ (drei <Text>는 woff2 미지원 → TTF) */
export const SERIF_FONT = `${BASE}fonts/GowunBatang-Regular.ttf`
export const HAND_FONT = `${BASE}fonts/NanumPenScript-Regular.ttf`

/* ━━━ 페이지 본문 ━━━ */
export const PAGE_TEXT_COLOR = '#3d342d' // 바랜 짙은 회갈색
export const PAGE_FONT_SIZE = 0.042
export const PAGE_LINE_HEIGHT = 1.85
export const PAGE_NUMBER_SIZE = 0.03
/** 여백 (inner = 책등 쪽, outer = 바깥쪽) */
export const PAGE_MARGIN = { top: 0.17, bottom: 0.22, inner: 0.16, outer: 0.12 }

/* ━━━ 떡메모지 ━━━ */
export const MEMO_SIZE: [number, number] = [0.36, 0.34]
export const MEMO_THICKNESS = 0.0015
/** 표면과 메모 바닥 사이 간격 (파묻힘 방지) */
export const MEMO_CLEARANCE = 0.0012
/** 한쪽 모서리가 들린 정도 / 들림이 퍼지는 반경 */
export const MEMO_CURL = 0.009
export const MEMO_CURL_RADIUS = 0.2
export const MEMO_INK = '#2a2d38'
export const MEMO_FONT_SIZE = 0.05
export const MEMO_HALF_DIAG = Math.hypot(MEMO_SIZE[0], MEMO_SIZE[1]) / 2

/* ━━━ 호버 / 드래그 ━━━ */
export const MEMO_HOVER_LIFT = 0.008
export const MEMO_HOVER_DURATION = 0.25
/** 드래그 중 떠오르는 높이 (아래 표면 기준) */
export const DRAG_LIFT = 0.1
/** 포인터 따라가는 부드러움 (클수록 즉각) */
export const DRAG_FOLLOW = 16
/** 이동 속도 → 기울기 변환 계수 / 최대 기울기 */
export const DRAG_TILT_PER_SPEED = 0.16
export const DRAG_TILT_MAX = 20 * DEG

/* ━━━ 내려놓기 ━━━ */
export const RETURN_HOME_DURATION = 0.75 // 오른쪽 페이지에 놓으면 제자리로 미끄러지듯
export const DROP_DURATION = 0.42 // 왼쪽 페이지 / 책상에 내려앉기
export const LAND_BOUNCE = 0.006 // 내려앉을 때 살짝 튕기는 높이
export const DESK_RANDOM_ROTATION = 15 * DEG

/* ━━━ 크게 보기 ━━━ */
export const FOCUS_DISTANCE = 1.45 // 카메라 앞 거리
export const FOCUS_DURATION = 0.7
export const FOCUS_EASE = 'power2.inOut'
export const FOCUS_OVERLAY_DISTANCE = 1.9
export const FOCUS_OVERLAY_OPACITY = 0.72
export const FOCUS_OVERLAY_COLOR = '#f5f3ef'

/* ━━━ 넘기기/닫기 거부 피드백 ━━━ */
export const NUDGE_HEIGHT = 0.03 // 밖에 있는 메모가 들썩이는 높이
export const PAGE_CORNER_SIZE = 0.3 // 들리는 페이지 모서리 크기
export const PAGE_CORNER_LIFT = 13 * DEG
/** 오른쪽 페이지 바깥 가장자리 클릭 영역 폭 */
export const PAGE_EDGE_ZONE = 0.1

/* ━━━ 책상 그림자 ━━━ */
export const DESK_SHADOW_OPACITY = 0.42
export const DESK_SHADOW_BLUR = 2.4
export const DESK_SHADOW_FAR = 0.9
export const DESK_SHADOW_COLOR = '#3b3128'
/** 메모 자체 그림자 (떠오를수록 넓고 옅게) */
export const MEMO_SHADOW_OPACITY = 0.3
export const MEMO_SHADOW_SPREAD = 3.5
