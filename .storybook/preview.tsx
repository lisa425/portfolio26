import type { Preview } from '@storybook/react-vite'
// 실제 앱과 동일한 전역 스타일(폰트/변수/컴포넌트 스타일)을 그대로 사용 —
// 스토리가 실화면과 다른 "가짜 룩"이 되지 않도록 한다
import '../src/App.scss'

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    // 사이트 배경색 기본 적용 (모노톤 다크 테마)
    backgrounds: {
      options: {
        dark: { name: 'dark', value: '#0d0d0d' },
        light: { name: 'light', value: '#ffffff' },
      },
    },
    a11y: {
      test: 'todo',
    },
  },
  initialGlobals: {
    backgrounds: { value: 'dark' },
  },
}

export default preview
