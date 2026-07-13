import type { Meta, StoryObj } from '@storybook/react-vite'
import WorkDetailImage from './WorkDetailImage'

/**
 * Works detail 모달의 프로젝트 이미지 갤러리 — 컨테이너는 16:9 하나로 고정,
 * `src` 배열의 이미지를 Swiper로 넘겨가며 본다. 각 슬라이드는 로드 전
 * 스켈레톤 셔머를 보여준다. 실제 스타일 스코프(.works__detail)를 재현해
 * 실화면과 동일한 룩으로 렌더한다.
 */
const meta = {
  title: 'UI/WorkDetailImage',
  component: WorkDetailImage,
  decorators: [
    (Story) => (
      // CSS Modules 분리 이후 .panel-image-container는 자기완결 스타일이라
      // .works__detail 스코프가 더 이상 필요 없음 — 폭만 잡아주는 단순 래퍼.
      // (.works__detail은 display:grid라, 자식이 하나뿐인 스토리에서 트랙
      //  크기가 붕괴돼 렌더가 깨지는 문제가 있었음)
      <div style={{ width: 520 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof WorkDetailImage>

export default meta
type Story = StoryObj<typeof meta>

/** 이미지 여러 장 — 하단 컨트롤([ < ] 01/04 [ > ])로 스와이프 전환 */
export const Gallery: Story = {
  args: {
    src: [
      '/assets/images/az_img1.jpg',
      '/assets/images/az_img2.jpg',
      '/assets/images/az_img3.jpg',
      '/assets/images/az_img4.jpg',
    ],
  },
}

/** 이미지 한 장 — 여러 장이 아니므로 하단 컨트롤 자체가 렌더되지 않음 */
export const SingleImage: Story = {
  args: {
    src: ['/assets/images/az_img1.jpg'],
  },
}

/** 존재하지 않는 이미지 — 스켈레톤이 정리되고 빈 슬라이드로 남는다 */
export const ErrorFallback: Story = {
  args: {
    src: ['/assets/images/does-not-exist.jpg'],
  },
}
