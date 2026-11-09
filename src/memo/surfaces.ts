import { Euler, Quaternion, Vector3 } from 'three'
import { BOARD_OUTER_X, BOARD_THICKNESS, BOOK_HEIGHT, BOOK_THICKNESS, TB_CORNER_X, TB_FORE_X } from '../book/bookConfig'
import {
  LEFT_X0,
  leftTopLocalZ,
  OPEN_COVER_ANGLE,
  PAGE_H,
  PAGE_W,
  rightTopZ,
  rotOpen,
} from '../riffle/stackGeometry'
import { DESK_RANDOM_ROTATION, MEMO_CLEARANCE, MEMO_HALF_DIAG, MEMO_SIZE, MEMO_THICKNESS } from './memoConfig'

/*
 * 펼친 책 위 "표면" 계산 — 책 좌표계(Book 그룹 기준).
 *  - 오른쪽 페이지 = 오른쪽 속지 더미 윗면 (두께에 따라 높이가 바뀜)
 *  - 왼쪽 페이지 = 열린 앞표지 위 왼쪽 더미 윗면 (표지 각도만큼 기울어짐)
 *  - 책상 = 책 뒷면이 놓인 평면 (z = -두께/2). 카메라는 +z 쪽에서 거의 수직으로 내려다봄
 */

const COS = Math.cos(OPEN_COVER_ANGLE)
const SIN = Math.sin(OPEN_COVER_ANGLE)

export { PAGE_H, PAGE_W }

/** 오른쪽 페이지 범위 (높이는 rightTopZ()) */
export const RIGHT_PAGE = { x0: TB_CORNER_X, x1: TB_FORE_X, cx: (TB_CORNER_X + TB_FORE_X) / 2 }

export const DESK_Z = -BOOK_THICKNESS / 2
/** 왼쪽 페이지가 책상 대비 기울어진 각도 (y축 회전) */
export const LEFT_TILT = Math.PI - OPEN_COVER_ANGLE

/** 열린 상태 왼쪽 페이지가 책상 위에서 차지하는 x 범위 (현재 두께 기준) */
export function leftPageRange() {
  const z = leftTopLocalZ()
  const a = rotOpen(LEFT_X0, z)[0]
  const b = rotOpen(LEFT_X0 + PAGE_W, z)[0]
  return { xMin: Math.min(a, b), xMax: Math.max(a, b) }
}

/** 펼친 책 전체 경계 (열린 앞표지 끝 ~ 뒤표지 책배) */
export const SPREAD = {
  xMin: Math.min(
    rotOpen(BOARD_OUTER_X, BOOK_THICKNESS / 2)[0],
    rotOpen(BOARD_OUTER_X, BOOK_THICKNESS / 2 - BOARD_THICKNESS)[0],
  ),
  xMax: BOARD_OUTER_X,
  yMax: BOOK_HEIGHT / 2,
}

/** 왼쪽 페이지(왼쪽 더미 윗면) 평면의 높이 — 책상 위 x 에서 */
export function leftPlaneZ(x: number) {
  // 왼쪽 더미 윗면의 한 점 A 와 방향 (cos, sin) 으로 이루어진 직선 위, x 에서의 z
  const A = rotOpen(LEFT_X0, leftTopLocalZ())
  return A[1] + ((x - A[0]) * SIN) / COS
}

export type Region = 'right' | 'left' | 'book' | 'desk'
export type Surface = { region: Region; z: number; tilt: number }

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

/** (x, y) 바로 아래 표면 */
export function surfaceAt(x: number, y: number): Surface {
  const inPageY = Math.abs(y) <= PAGE_H / 2
  if (inPageY && x >= RIGHT_PAGE.x0 && x <= RIGHT_PAGE.x1) return { region: 'right', z: rightTopZ(), tilt: 0 }
  const left = leftPageRange()
  if (inPageY && x >= left.xMin && x <= left.xMax) return { region: 'left', z: leftPlaneZ(x), tilt: LEFT_TILT }
  if (x >= SPREAD.xMin && x <= SPREAD.xMax && Math.abs(y) <= SPREAD.yMax) {
    // 페이지 밖이지만 책 위 (골, 표지 가장자리) — 드래그 높이용으로 넉넉하게
    if (x < RIGHT_PAGE.x0)
      return {
        region: 'book',
        z: Math.max(leftPlaneZ(clamp(x, left.xMin, left.xMax)), BOOK_THICKNESS / 2 + 0.04),
        tilt: LEFT_TILT,
      }
    return { region: 'book', z: Math.max(rightTopZ(), DESK_Z + BOARD_THICKNESS), tilt: 0 }
  }
  return { region: 'desk', z: DESK_Z, tilt: 0 }
}

/** 메모가 차지하는 영역(중심 + 네 귀퉁이) 아래에서 가장 높은 표면 — 드래그 중 책 모서리·골을 뚫지 않게 */
export function maxSurfaceZ(x: number, y: number, r = MEMO_HALF_DIAG) {
  let z = surfaceAt(x, y).z
  for (const [dx, dy] of [
    [r, r],
    [r, -r],
    [-r, r],
    [-r, -r],
  ])
    z = Math.max(z, surfaceAt(x + dx, y + dy).z)
  return z
}

/* ━━━ 메모 배치 ━━━ */

export type MemoLocation = 'home' | 'left' | 'desk'
export type MemoPlacement = { location: MemoLocation; x: number; y: number; spin: number }

/** 데이터의 homePosition(오른쪽 페이지 기준) → 책 좌표 */
export function homePlacement(homePosition: [number, number], homeRotation: number): MemoPlacement {
  return { location: 'home', x: RIGHT_PAGE.cx + homePosition[0], y: homePosition[1], spin: homeRotation }
}

const _e = new Euler()

/** 배치 → 실제 위치/방향 (표면 바로 위, 표면 기울기에 맞춤). 더미 두께가 바뀌면 높이도 따라감 */
export function restPose(p: MemoPlacement, out = { pos: new Vector3(), quat: new Quaternion() }) {
  let z = rightTopZ()
  let tilt = 0
  if (p.location === 'left') {
    z = leftPlaneZ(p.x)
    tilt = LEFT_TILT
  } else if (p.location === 'desk') z = DESK_Z
  const off = MEMO_THICKNESS / 2 + MEMO_CLEARANCE
  out.pos.set(p.x + Math.sin(tilt) * off, p.y, z + Math.cos(tilt) * off)
  out.quat.setFromEuler(_e.set(0, tilt, p.spin, 'XYZ'))
  return out
}

/**
 * 내려놓기 규칙
 *  - 오른쪽 페이지 → 원래 자리
 *  - 왼쪽 페이지 → 그 자리에 얹힘 (페이지 밖으로 삐져나오지 않게 안쪽으로)
 *  - 책 밖 → 책상 (책과 겹치지 않게 바깥으로 밀어냄), 회전은 ±15° 무작위
 */
export function resolveDrop(x: number, y: number, spin: number, home: MemoPlacement): MemoPlacement {
  const s = surfaceAt(x, y)
  if (s.region === 'right' || (s.region === 'book' && x >= RIGHT_PAGE.x0)) return { ...home }
  if (s.region === 'left' || s.region === 'book') {
    const left = leftPageRange()
    const m = Math.max(MEMO_SIZE[0], MEMO_SIZE[1]) / 2 + 0.01
    return {
      location: 'left',
      x: clamp(x, left.xMin + m, left.xMax - m),
      y: clamp(y, -PAGE_H / 2 + m, PAGE_H / 2 - m),
      spin,
    }
  }
  // 책상: 메모가 책 가장자리와 겹치면 가장 가까운 바깥쪽으로 밀어냄
  const r = MEMO_HALF_DIAG + 0.02
  const box = { x0: SPREAD.xMin - r, x1: SPREAD.xMax + r, y0: -SPREAD.yMax - r, y1: SPREAD.yMax + r }
  let dx = x
  let dy = y
  if (x > box.x0 && x < box.x1 && y > box.y0 && y < box.y1) {
    const d = [x - box.x0, box.x1 - x, y - box.y0, box.y1 - y]
    const i = d.indexOf(Math.min(...d))
    if (i === 0) dx = box.x0
    else if (i === 1) dx = box.x1
    else if (i === 2) dy = box.y0
    else dy = box.y1
  }
  return { location: 'desk', x: dx, y: dy, spin: (Math.random() * 2 - 1) * DESK_RANDOM_ROTATION }
}
