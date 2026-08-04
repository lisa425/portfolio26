import type { Meta, StoryObj } from '@storybook/react-vite'
import type { WorkType } from '../../types'
import WorksPreviewCard from './WorksPreviewCard'

/**
 * Works 프로젝트 프리뷰 카드 — 모바일 세로 리스트와 PC 노드 호버 패널이
 * 공유하는 마크업 (헤더 + 썸네일 + 데이터 행 + 푸터).
 * PC에서는 Works가 ref로 위치/active를 직접 제어하므로, 스토리에서는
 * fixed 포지셔닝만 무력화하고 active 상태로 고정해서 보여준다.
 */
const sampleWork: WorkType = {
  id: 1,
  projectKey: 'azure-promilia',
  category: 1,
  dept: '',
  game: 'Azure Promilia',
  title: 'Official Website & 1st Pre-registration',
  intro: '',
  date: '2025.11 - 2025.12',
  description: [],
  stack: 'Next.js',
  thumbnail: '/assets/images/az_thumb1.jpg',
  img: [],
  url: '',
}

const meta = {
  title: 'UI/WorksPreviewCard',
  component: WorksPreviewCard,
  decorators: [
    (Story) => (
      <div className="works">
        {/* 카드 자체가 .works-preview 클래스를 가지므로 스토리에서만
            fixed/slide-in 스타일을 풀어준다 */}
        <style>{`
          .sb-card-stage .works-preview {
            position: static;
            transform: none;
            pointer-events: auto;
          }
        `}</style>
        <div className="sb-card-stage" style={{ width: 340 }}>
          <Story />
        </div>
      </div>
    ),
  ],
  args: {
    work: sampleWork,
    index: 0,
    total: 5,
    active: true,
  },
} satisfies Meta<typeof WorksPreviewCard>

export default meta
type Story = StoryObj<typeof meta>

/** 기본 카드 — 노드 호버 시 나타나는 상태 */
export const Default: Story = {}

/** 클릭 가능한 카드 (모바일 리스트 동작) — Actions 패널에서 onClick 확인 */
export const Clickable: Story = {
  args: {
    onClick: () => {},
  },
  argTypes: {
    onClick: { action: 'card clicked' },
  },
}

/** 마지막 항목 인디케이터 (005/005) */
export const LastItem: Story = {
  args: {
    work: {
      ...sampleWork,
      id: 5,
      game: 'Mabinogi Mobile',
      title: '1st Anniversary Festival',
      date: '2026.03',
      stack: 'React · TypeScript',
      thumbnail: '/assets/images/mm_thumb1.jpg',
    },
    index: 4,
    total: 5,
  },
}
