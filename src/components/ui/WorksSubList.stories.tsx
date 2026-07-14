import type { Meta, StoryObj } from '@storybook/react-vite'
import type { SubProjectType } from '../../types'
import WorksSubList from './WorksSubList'

/**
 * View All의 "Other Projects" 단순 텍스트 리스트 — 썸네일 없는 subProject
 * 항목을 YEAR/PROJECT/DEPT/STACK/LINK 행으로 보여준다.
 * url이 있는 항목만 외부 링크(새 탭)가 붙는다.
 */
const sampleItems: SubProjectType[] = [
  {
    title: "[Vindictus] New Character 'Neamhain' Update",
    dept: 'NEXON',
    intro: '신규 캐릭터의 정체성과 세계관을 비주얼로 표현하는 웹 애니메이션 연출 및 구현',
    date: '2025.01',
    stack: 'React · TypeScript',
    url: 'http://vindictus.nexon.net/event/2025/0121/neamhain',
  },
  {
    title: '[Blue Archive] Code:BOX Update Page',
    dept: 'NEXON',
    intro: '게임의 SF 세계관에 맞춘 인터랙티브 업데이트 페이지',
    date: '2025.07',
    stack: 'Nuxt.js',
    url: 'https://bluearchive.nexon.com/events/2025/07/update',
  },
  {
    title: '[Mabinogi Mobile] Login Reward Page',
    dept: 'NEXON',
    intro: '시즌 이벤트 보상 안내 페이지',
    date: '2026.03',
    stack: 'React · TypeScript',
    // url 없음 — 링크 미노출 케이스
  },
]

const meta = {
  title: 'UI/WorksSubList',
  component: WorksSubList,
  decorators: [
    (Story) => (
      <div style={{ width: 960, maxWidth: '95vw' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    items: sampleItems,
  },
} satisfies Meta<typeof WorksSubList>

export default meta
type Story = StoryObj<typeof meta>

/** 기본 리스트 — 3번째 항목은 url이 없어 LINK 칸이 비어 있다 */
export const Default: Story = {}

/** 커스텀 헤딩 */
export const CustomTitle: Story = {
  args: { title: 'SUB PROJECTS' },
}

/** 빈 배열이면 아무것도 렌더하지 않는다 */
export const Empty: Story = {
  args: { items: [] },
}

/**
 * Selected Project 용도 — onItemClick이 주어지면 행 전체가 클릭 가능해지고
 * (배경 강조 + 좌측 강조선), LINK 칸이 외부 링크 대신 `[ ENTER ]`로 바뀐다.
 */
export const Clickable: Story = {
  args: {
    title: 'SELECTED PROJECT',
    onItemClick: (index) => alert(`clicked row ${index}`),
  },
}
