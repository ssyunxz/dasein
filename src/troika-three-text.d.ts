// troika-three-text 는 타입 정의를 제공하지 않아 사용하는 함수만 선언
declare module 'troika-three-text' {
  export function preloadFont(
    options: { font: string; characters?: string | string[]; sdfGlyphSize?: number },
    callback?: () => void,
  ): void
}
