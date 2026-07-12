import type { Meta, StoryObj } from '@storybook/react-vite'
import Skeleton from './Skeleton'

/**
 * 이미지/콘텐츠 로딩 자리에 깔리는 셔머 오버레이.
 * 부모가 position: relative + 크기를 가져야 한다 (inset: 0으로 채움).
 */
const meta = {
  title: 'UI/Skeleton',
  component: Skeleton,
  decorators: [
    (Story) => (
      <div
        style={{
          position: 'relative',
          width: 320,
          height: 180,
          background: 'rgba(255,255,255,0.02)',
        }}
      >
        <Story />
      </div>
    ),
  ],
  argTypes: {
    hidden: { control: 'boolean' },
  },
} satisfies Meta<typeof Skeleton>

export default meta
type Story = StoryObj<typeof meta>

/** 로딩 중 — 셔머 애니메이션 재생 */
export const Loading: Story = {
  args: { hidden: false },
}

/** 로드 완료 — 페이드아웃되어 보이지 않음 */
export const Hidden: Story = {
  args: { hidden: true },
}
