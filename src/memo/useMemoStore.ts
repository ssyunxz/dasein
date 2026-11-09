import { create } from 'zustand'
import { PAGES, type MemoData } from '../data/pages'
import { homePlacement, type MemoPlacement } from './surfaces'

/* 메모 위치/상태 저장소 (zustand) */

type CursorKey = 'memo' | 'page' | 'book'

type MemoStore = {
  /** 메모별 현재 배치 (home / left / desk) */
  placements: Record<string, MemoPlacement>
  draggingId: string | null
  focusedId: string | null
  /** 넘기기·닫기 거부 신호 — 값이 바뀔 때마다 페이지 모서리 들썩 + 밖의 메모 들썩 */
  rejectPulse: number
  /** 커서 요청 (우선순위: memo > page > book) */
  cursor: Record<CursorKey, string | null>

  initMemos: (memos: MemoData[]) => void
  place: (id: string, p: MemoPlacement) => void
  setDragging: (id: string | null) => void
  setFocused: (id: string | null) => void
  reject: () => void
  /** 페이지 넘기기 시도 — 메모가 모두 제자리일 때만 통과 */
  attemptTurn: () => boolean
  setCursor: (key: CursorKey, value: string | null) => void
}

const placementsOf = (memos: MemoData[]) =>
  Object.fromEntries(memos.map((m) => [m.id, homePlacement(m.homePosition, m.homeRotation)]))

export const selectAllMemosHome = (s: MemoStore) =>
  Object.values(s.placements).every((p) => p.location === 'home')

export const useMemoStore = create<MemoStore>((set, get) => ({
  placements: placementsOf(PAGES[0].memos),
  draggingId: null,
  focusedId: null,
  rejectPulse: 0,
  cursor: { memo: null, page: null, book: null },

  initMemos: (memos) => set({ placements: placementsOf(memos) }),
  place: (id, p) => set((s) => ({ placements: { ...s.placements, [id]: p } })),
  setDragging: (id) => set({ draggingId: id }),
  setFocused: (id) => set({ focusedId: id }),
  reject: () => set((s) => ({ rejectPulse: s.rejectPulse + 1 })),
  attemptTurn: () => {
    if (!selectAllMemosHome(get())) {
      get().reject()
      return false
    }
    console.log('[page] 넘기기 가능 — 다음 단계에서 실제 넘김 구현')
    return true
  },
  setCursor: (key, value) => set((s) => (s.cursor[key] === value ? s : { cursor: { ...s.cursor, [key]: value } })),
}))
