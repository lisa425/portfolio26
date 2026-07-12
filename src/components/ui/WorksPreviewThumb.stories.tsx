import type { Meta, StoryObj } from '@storybook/react-vite'
import WorksPreviewThumb from './WorksPreviewThumb'

/**
 * Works 프리뷰 카드의 4:3 썸네일 — 스켈레톤 → 페이드인 + 스캔라인 오버레이.
 * 스타일이 .works .works-preview 스코프에 있어 데코레이터로 재현한다.
 */
const meta = {
  title: 'UI/WorksPreviewThumb',
  component: WorksPreviewThumb,
  decorators: [
    (Story) => (
      <div className="works">
        {/* 카드의 fixed/hidden 기본 상태만 무력화 */}
        <div
          className="works-preview active"
          style={{ position: 'static', transform: 'none', width: 320 }}
        >
          <Story />
        </div>
      </div>
    ),
  ],
} satisfies Meta<typeof WorksPreviewThumb>

export default meta
type Story = StoryObj<typeof meta>

/** 정상 로드 — 그레이스케일 처리 + 스캔라인 */
export const Loaded: Story = {
  args: {
    src: '/assets/images/br_thumb1.jpg',
    alt: 'Baram 21st anniversary gallery',
  },
}

/** 존재하지 않는 이미지 — 스켈레톤이 숨고 빈 4:3 영역 유지 */
export const ErrorFallback: Story = {
  args: {
    src: '/assets/images/does-not-exist.jpg',
    alt: 'broken image',
  },
}
