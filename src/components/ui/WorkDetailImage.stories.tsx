import type { Meta, StoryObj } from '@storybook/react-vite'
import WorkDetailImage from './WorkDetailImage'

/**
 * Works detail 모달의 프로젝트 이미지 — 로드 전 240px 플레이스홀더 + 셔머,
 * 로드 후 자연 높이 전환. 실제 스타일 스코프(.works__detail)를 재현해
 * 실화면과 동일한 룩으로 렌더한다.
 */
const meta = {
  title: 'UI/WorkDetailImage',
  component: WorkDetailImage,
  decorators: [
    (Story) => (
      // 실제 DOM: .works__detail(.active) > … > .panel-image-container
      // 모달 fixed 포지셔닝만 무력화하고 스타일 스코프는 그대로 사용
      <div
        className="works__detail active"
        style={{ position: 'static', width: 520, pointerEvents: 'auto' }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof WorkDetailImage>

export default meta
type Story = StoryObj<typeof meta>

/** 정상 로드 — 스켈레톤이 잠깐 보였다가 이미지가 페이드인 */
export const Loaded: Story = {
  args: {
    src: '/assets/images/az_img1.jpg',
    index: 0,
  },
}

/** 존재하지 않는 이미지 — onError 후에도 240px 플레이스홀더 높이 유지 */
export const ErrorFallback: Story = {
  args: {
    src: '/assets/images/does-not-exist.jpg',
    index: 0,
  },
}
