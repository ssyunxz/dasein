import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import Scene from './Scene'
import { preloadBookFonts } from './memo/preloadFonts'

// 폰트는 렌더를 멈추지 않고 미리 받아 둠 (글자는 각자 Suspense 안에서 준비되면 나타남)
preloadBookFonts()

export default function App() {
  return (
    <Canvas dpr={[1, 2]} gl={{ antialias: true }}>
      <Suspense fallback={null}>
        <Scene />
      </Suspense>
    </Canvas>
  )
}
