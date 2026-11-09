import gsap from 'gsap'
import {
  RIFFLE_DURATION,
  RIFFLE_FAST_LEAF,
  RIFFLE_LEAVES,
  RIFFLE_STAGGER_MAX,
  RIFFLE_STAGGER_MIN,
  TOTAL_PAGES,
} from './riffleConfig'
import { leafState, OPEN_COVER_ANGLE, pageState } from './stackGeometry'
import { useBookStore } from './useBookStore'

/**
 * 장별 시작 시각과 길이: 시차는 점점 늘고, 앞 장들은 빠르게,
 * 마지막 장은 남은 시간을 모두 써서 천천히 내려앉음 → 전체가 RIFFLE_DURATION 에 끝남.
 */
function schedule() {
  const n = RIFFLE_LEAVES
  const start: number[] = []
  const dur: number[] = []
  let t = 0
  for (let i = 0; i < n; i++) {
    start.push(t)
    t += RIFFLE_STAGGER_MIN + (RIFFLE_STAGGER_MAX - RIFFLE_STAGGER_MIN) * (i / Math.max(1, n - 1))
  }
  const lastStart = start[n - 1]
  const slow = Math.max(RIFFLE_FAST_LEAF, RIFFLE_DURATION - lastStart)
  for (let i = 0; i < n; i++) {
    const k = (i / Math.max(1, n - 1)) ** 3
    dur.push(i === n - 1 ? slow : RIFFLE_FAST_LEAF + (slow - RIFFLE_FAST_LEAF) * k)
  }
  return { start, dur }
}

let running: gsap.core.Timeline | null = null

/**
 * 목표 쪽으로 촤르륵 넘기기 (앞으로/뒤로 모두). 실제로 움직이는 종이는 RIFFLE_LEAVES 장이고,
 * 같은 시간 동안 currentPage가 목표로 이동하며 좌/우 더미 두께가 실시간으로 바뀜.
 */
export function riffleTo(page: number, opts: { onComplete?: () => void } = {}) {
  running?.kill()
  const to = Math.min(TOTAL_PAGES, Math.max(0, page))
  const forward = to >= pageState.current
  const n = RIFFLE_LEAVES
  leafState.progress = Array.from({ length: n }, () => ({ p: forward ? 0 : 1 }))
  leafState.active = true

  const { start, dur } = schedule()
  const at90 = Math.PI / 2 / OPEN_COVER_ANGLE // 진행도 기준 90° 지점
  const setSpread = useBookStore.getState().setSpreadVisible

  const tl = gsap.timeline({
    onComplete: () => {
      leafState.active = false
      setSpread(forward) // 혹시 놓친 경우 대비
      running = null
      opts.onComplete?.()
    },
  })
  tl.to(pageState, { current: to, duration: RIFFLE_DURATION, ease: 'power2.inOut' }, 0)

  for (let i = 0; i < n; i++) {
    // 앞으로: 오른쪽 맨 위 장(0)부터 / 뒤로: 왼쪽 맨 위 장(n-1)부터
    const leaf = leafState.progress[forward ? i : n - 1 - i]
    const lastTwo = i >= n - 2
    // 앞으로: 마지막 장이 90°를 지나면 펼침면 등장 / 뒤로: 첫 장이 90°를 지나면 펼침면 숨김
    const signal = forward ? i === n - 1 : i === 0
    tl.to(
      leaf,
      {
        p: forward ? 1 : 0,
        duration: dur[i],
        ease: lastTwo ? 'power3.out' : 'power2.inOut',
        onUpdate: signal
          ? () => {
              if (forward ? leaf.p >= at90 : leaf.p <= at90) setSpread(forward)
            }
          : undefined,
      },
      start[i],
    )
  }
  running = tl
  return tl
}
