import { preloadFont } from 'troika-three-text'
import { PAGES } from '../data/pages'
import { HAND_FONT, SERIF_FONT } from './memoConfig'

/**
 * 앱 시작 직후 폰트 파일과 실제로 쓰는 글자만 미리 준비 — 책을 펼쳤을 때 글자가 늦게 뜨지 않게.
 * (렌더를 멈추지 않는 백그라운드 로딩)
 */
export function preloadBookFonts() {
  const pageChars = PAGES.map((p) => p.leftText + p.rightText + p.pageNumber + (p.pageNumber + 1)).join('')
  const memoChars = PAGES.flatMap((p) => p.memos.map((m) => m.text)).join('')
  preloadFont({ font: SERIF_FONT, characters: pageChars + '0123456789' })
  preloadFont({ font: HAND_FONT, characters: memoChars })
}
