import type { Meta, StoryObj } from '@storybook/react-vite'
import Corners from './Corners'

/**
 * 패널 모서리의 4-코너 장식 프레임.
 * 부모는 position: relative여야 하고, 색은 `--corner-color`로 조절한다.
 * 실사용: Works detail 이미지 컨테이너(기본 0.6), About 섹션 패널(0.8).
 */
const meta = {
  title: 'UI/Corners',
  component: Corners,
  decorators: [
    (Story, { parameters }) => (
      <div
        style={{
          position: 'relative',
          width: 320,
          height: 180,
          border: '1px solid rgba(255,255,255,0.2)',
          ...(parameters.cornerColor && {
            ['--corner-color' as string]: parameters.cornerColor,
          }),
        }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Corners>

export default meta
type Story = StoryObj<typeof meta>

/** 기본색 rgba(255,255,255,0.6) — Works detail 이미지 프레임 */
export const Default: Story = {}

/** About 섹션 패널 변형 — 부모에서 --corner-color: 0.8 오버라이드 */
export const Bright: Story = {
  parameters: { cornerColor: 'rgba(255, 255, 255, 0.8)' },
}
