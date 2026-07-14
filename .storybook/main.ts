import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  // 스토리는 공용 UI 계층(src/components/ui)에 컴포넌트와 co-locate
  stories: ['../src/components/ui/**/*.stories.@(ts|tsx)', '../src/**/*.mdx'],
  addons: ['@storybook/addon-a11y', '@storybook/addon-docs', '@storybook/addon-mcp'],
  framework: '@storybook/react-vite',
  // 실제 프로젝트 이미지(/assets/images/...)를 스토리에서 그대로 쓰기 위함
  staticDirs: ['../public'],
};
export default config;
