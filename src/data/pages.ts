/* 펼침면(좌·우 페이지) 데이터. 나중에 항목만 추가하면 페이지가 늘어나도록 배열로 관리 */

/** 메모 종류 — 지금은 'sticky'(떡메모지)만 구현. 'half'(반 접힘) / 'tri'(삼각 접힘)는 다음 단계 */
export type MemoType = 'sticky' | 'half' | 'tri'

export type MemoData = {
  id: string
  type: MemoType
  text: string
  color: string
  /** 오른쪽 페이지 기준 위치 (페이지 중심 = 0,0 / x 오른쪽, y 위쪽, 단위 = 장면 단위) */
  homePosition: [number, number]
  /** 페이지 위에서 돌아간 각도 (라디안, 반시계 +) */
  homeRotation: number
}

export type PageData = {
  /** 왼쪽 페이지 번호 (오른쪽은 +1) */
  pageNumber: number
  leftText: string
  rightText: string
  memos: MemoData[]
}

export const PAGES: PageData[] = [
  {
    pageNumber: 142,
    leftText: [
      '　아침 안개가 걷히기 전에 그는 늘 같은 길을 걸었다. 강을 따라 이어진 좁은 흙길은 계절마다 다른 냄새를 품고 있었고, 그 냄새로 그는 날짜를 셈했다.',
      '　누군가는 그것을 습관이라 불렀지만, 그에게는 하루를 시작하기 위한 일종의 의식이었다. 발밑의 돌 하나, 물가에 기운 갈대 한 줄기까지 그는 어제와 오늘의 차이를 알아보았다.',
      '　그날 아침, 길 끝의 오래된 벤치 위에 낯선 책 한 권이 놓여 있었다. 표지는 바래 있었고 모서리는 닳아 둥글어져 있었다. 그는 한참을 서서 그 책을 바라보다가, 마침내 조심스럽게 손을 뻗었다.',
    ].join('\n'),
    rightText: [
      '　책장을 넘기자 오래된 종이 특유의 냄새가 났다. 여백 곳곳에는 연필로 그은 희미한 밑줄이 남아 있었고, 어떤 문장 옆에는 알아보기 힘든 글씨가 적혀 있었다.',
      '　그는 그 글씨의 주인을 상상했다. 같은 문장 앞에서 멈춰 섰을 누군가, 같은 자리에서 숨을 고르며 창밖을 바라보았을 누군가를.',
      '　읽는다는 것은 어쩌면 시간을 건너 다른 사람의 걸음을 따라 걷는 일인지도 모른다. 그는 그렇게 생각하며, 책갈피 대신 손가락 하나를 페이지 사이에 끼워 두었다.',
    ].join('\n'),
    memos: [
      {
        id: 'memo-142-1',
        type: 'sticky',
        text: '이 문장,\n다시 읽어보기.\n— 10월의 나',
        color: '#f3ebcf', // 살짝 바랜 미색
        homePosition: [0.14, -0.43],
        homeRotation: -0.11,
      },
    ],
  },
]
