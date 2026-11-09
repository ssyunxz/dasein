import type { ThreeElements } from '@react-three/fiber'
import Board from './book/Board'
import Headband from './book/Headband'
import SpineCover from './book/SpineCover'
import TextBlock from './book/TextBlock'
import { FRONT_PIVOT, OPEN_ANGLE } from './book/bookConfig'

/* 옛 양장본 — 조절 상수는 ./book/bookConfig.ts 상단에 모여 있음 */

/** 앞표지 모서리별 닳은 정도 (CORNER_WEAR 배율) — 모서리마다 다르게 */
const FRONT_CORNERS = { top: 1.0, bottom: 0.55 }
const BACK_CORNERS = { top: 0.7, bottom: 1.25 }

type BookProps = ThreeElements['group'] & {
  /** 앞표지 열림 각도 (라디안). 기본값 = OPEN_ANGLE 상수 */
  openAngle?: number
}

export default function Book({ openAngle = OPEN_ANGLE, ...props }: BookProps) {
  return (
    <group {...props}>
      <TextBlock />
      <Headband side={1} />
      <Headband side={-1} />

      {/* 고정 부품 */}
      <SpineCover />
      <Board side="back" cornerScale={BACK_CORNERS} seed={23} />

      {/* 앞표지 — pivot = 속지 등 모서리의 앞면 라인(세로축).
          rotation.y 가 음수일수록 책배 쪽이 카메라 쪽으로 들리며 열림 */}
      <group name="frontBoardPivot" position={FRONT_PIVOT} rotation={[0, -openAngle, 0]}>
        <group position={[-FRONT_PIVOT[0], -FRONT_PIVOT[1], -FRONT_PIVOT[2]]}>
          <Board side="front" cornerScale={FRONT_CORNERS} seed={7} />
        </group>
      </group>
    </group>
  )
}
