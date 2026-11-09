/* ──────────────────────────────────────────────
 * 옛 양장본 — 조절 가능한 상수 + 파생 치수
 *
 * 좌표계 (Scene 기준, 책 중심 = 원점)
 *   x = 가로 (−x 책등 → +x 책배)
 *   y = 세로 (+y 머리 / −y 밑)
 *   z = 두께 (+z 앞표지, 카메라 쪽)
 *
 * 위에서 내려다본 단면 (머리 쪽):
 *
 *        joint   앞표지(board)
 *     ╭───╮⌄_______________________╮
 *    ╱  ╭─╮  ┃                     ⟩ ← 책배(살짝 오목)
 *   │ ░ │●│  ┃ 속지 뭉치            ⟩
 *    ╲  ╰─╯  ┃                     ⟩
 *     ╰───╯⌃‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾╯
 *   ↑   ↑ ↑                뒤표지(board)
 *  책등  틈 머리띠(속지 등에 붙음)
 * ────────────────────────────────────────────── */

/* ━━━ 주요 조절 상수 ━━━ */

/** 책등 표지와 속지 뭉치(등) 사이의 틈 */
export const SPINE_GAP = 0.015
/** 책등 곡률 — 속지 등이 볼록하게 튀어나온 정도 (책등 표지는 이 곡선과 평행) */
export const SPINE_CURVE = 0.026
/** 책등 표면 울퉁불퉁함 (simplex noise 진폭) */
export const SPINE_BUMPINESS = 0.0008
/** 표지 모서리 닳은 정도 — 모서리 둥글기와 가장자리 물결의 기준값 */
export const CORNER_WEAR = 0.035
/** 머리띠 굵기 (반지름, 지름 ≈ 0.03) */
export const HEADBAND_RADIUS = 0.015
/** 머리띠 줄무늬 색 [짙은 갈색, 크림] */
export const HEADBAND_COLORS = ['#3a2416', '#e8dcc0'] as const
/** 앞표지 열림 각도 (라디안) — 0 = 닫힘, Math.PI = 완전히 펼침 */
export const OPEN_ANGLE = 0

/* ━━━ 기본 치수 ━━━ */

export const BOOK_WIDTH = 1.4
export const BOOK_HEIGHT = 2.1
export const BOOK_THICKNESS = 0.3

/** 표지판 두께 */
export const BOARD_THICKNESS = 0.028
/** 표지판이 속지보다 위·아래·앞쪽으로 튀어나온 정도 */
export const BOARD_OVERHANG = 0.035
/** 책등 표지(천+심지) 두께 */
export const SPINE_COVER_THICKNESS = 0.016
/** 경첩 홈: 책등 곡면 끝이 표지 윗면보다 내려앉은 정도 / 홈 가운데가 더 파인 정도 */
export const JOINT_DROP = 0.006
export const JOINT_DIP = 0.004
/** 머리띠가 속지 단면보다 튀어나온 정도 */
export const HEADBAND_PROTRUDE = 0.007
/** 머리띠 줄무늬: 갈색 실 묶음 개수 / 묶음 폭 불규칙 정도(0 = 일정, 1 = 매우 들쭉날쭉) */
export const HEADBAND_STRIPES = 8
export const HEADBAND_STRIPE_JITTER = 0.2
/** 머리띠에 감긴 실 바퀴 수 (많을수록 실이 가늘고 촘촘) */
export const HEADBAND_WRAPS = 64
/** 실 한 가닥이 도드라진 정도 (머리띠 반지름 대비, 0 = 매끈) */
export const HEADBAND_THREAD_DEPTH = 0.16
/** 책등 쪽 아래에 줄지은 실 매듭(비즈) — 몇 바퀴마다 하나 (0 = 없음) */
export const HEADBAND_BEAD_EVERY = 3
/** 머리띠 구불거림 진폭 (정직한 곡선에서 벗어나는 정도) */
export const HEADBAND_WOBBLE = 0.0035
/** 책등 틈 속 그늘판이 머리/밑 끝에서 안쪽으로 들어간 깊이 / 색 (밝을수록 그늘이 옅음) */
export const GAP_SHADOW_INSET = 0.08
export const GAP_SHADOW_COLOR = '#8c7d69'

/* ━━━ 색 / 재질 ━━━ */

export const COVER_COLOR = '#7d6b47' // 오래된 베이지 천 (짙은 녹색: '#2f4a3a')
export const COVER_ROUGHNESS = 0.85
export const COVER_SHEEN = 0.35
export const PAGE_COLOR = '#ece2cc'
export const PAGE_ROUGHNESS = 0.95
/** 종이 결: 단위 길이당 종이 장 수 / 접장(signature) 묶음 수 */
export const PAGE_SHEET_DENSITY = 420
export const PAGE_SIGNATURE_DENSITY = 34

/* ━━━ 파생 치수 (직접 수정 X) ━━━ */

export const EPS = 0.0008 // 부품 사이 미세 간격 (관통·깜빡임 방지)
const halfT = BOOK_THICKNESS / 2

/** 속지 뭉치 */
export const TB_HALF_THICK = halfT - BOARD_THICKNESS - EPS
export const TB_HEIGHT = BOOK_HEIGHT - BOARD_OVERHANG * 2
export const TB_FORE_X = BOOK_WIDTH / 2 - BOARD_OVERHANG
export const TB_APEX_X = -BOOK_WIDTH / 2 + SPINE_COVER_THICKNESS + SPINE_GAP
/** 속지 등 원호: 현 = 속지 두께, 처짐 = SPINE_CURVE */
export const TB_RADIUS = (TB_HALF_THICK ** 2 + SPINE_CURVE ** 2) / (2 * SPINE_CURVE)
export const ARC_CENTER_X = TB_APEX_X + TB_RADIUS
export const TB_BACK_HALF_ANGLE = Math.asin(TB_HALF_THICK / TB_RADIUS)
/** 속지 등 모서리 (앞/뒷면과 둥근 등이 만나는 선) */
export const TB_CORNER_X = TB_APEX_X + SPINE_CURVE
export const TB_FORE_CONCAVE = SPINE_CURVE * 0.7

/** 책등 표지 — 속지 등 원호와 같은 중심, 반지름만 틈만큼 큼 (틈 폭 일정) */
export const SPINE_MID_RADIUS = TB_RADIUS + SPINE_GAP + SPINE_COVER_THICKNESS / 2
export const SPINE_TOP_Z = halfT - SPINE_COVER_THICKNESS / 2
export const SPINE_ARC_END_Z = SPINE_TOP_Z - JOINT_DROP
export const SPINE_HALF_ANGLE = Math.asin(SPINE_ARC_END_Z / SPINE_MID_RADIUS)
export const SPINE_ARC_END_X = ARC_CENTER_X - SPINE_MID_RADIUS * Math.cos(SPINE_HALF_ANGLE)

/** 표지판 — 속지 등 모서리 바로 바깥에서 시작 */
export const BOARD_INNER_X = TB_CORNER_X + 0.003
export const BOARD_OUTER_X = BOOK_WIDTH / 2

/** 속지 등 모서리의 앞면 라인 (세로 방향) */
export const FRONT_PIVOT: [number, number, number] = [TB_CORNER_X, 0, TB_HALF_THICK + EPS]

/**
 * 앞표지 실제 경첩 축 = FRONT_PIVOT 라인을 표지 두께 + 여유만큼 바깥(+z)으로 올린 곳.
 * 속지 앞면 라인에서 그대로 돌리면 표지 두께가 고정된 책등 표지를 뚫고 지나가므로,
 * 축을 책등 윗면보다 높여 표지가 책등 위를 넘어가며 열리게 함 (실제 양장본 경첩과 비슷한 궤적).
 */
export const FRONT_HINGE_LIFT = BOARD_THICKNESS + 0.008
export const FRONT_HINGE: [number, number, number] = [
  FRONT_PIVOT[0],
  FRONT_PIVOT[1],
  FRONT_PIVOT[2] + FRONT_HINGE_LIFT,
]

/** 면지(앞표지 안쪽에 붙은 종이) — 가장자리에 표지 천이 접혀 들어온 폭만큼 안쪽 */
export const ENDPAPER_COLOR = '#e2d2ad' // 누렇게 바랜 종이
export const ENDPAPER_TURN_IN = 0.018
