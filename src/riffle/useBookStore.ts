import { create } from 'zustand'

/** 책 상태: 닫힘 → 표지 열림 → 촤르륵 넘김 → 펼침 → (역넘김 + 표지 닫힘) */
export type BookPhase = 'closed' | 'opening' | 'riffling' | 'open' | 'closing'

type BookStore = {
  phase: BookPhase
  /** 펼침면(본문·메모)을 렌더할지 — 마지막 넘어가는 장이 90°를 지나는 순간 켜짐 */
  spreadVisible: boolean
  setPhase: (p: BookPhase) => void
  setSpreadVisible: (v: boolean) => void
}

export const useBookStore = create<BookStore>((set, get) => ({
  phase: 'closed',
  spreadVisible: false,
  setPhase: (phase) => set({ phase }),
  setSpreadVisible: (v) => {
    if (get().spreadVisible !== v) set({ spreadVisible: v })
  },
}))
