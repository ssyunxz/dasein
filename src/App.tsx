import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import Scene from './Scene'

export default function App() {
  return (
    <Canvas dpr={[1, 2]} gl={{ antialias: true }}>
      <Suspense fallback={null}>
        <Scene />
      </Suspense>
    </Canvas>
  )
}
