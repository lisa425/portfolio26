// package.json이 "type": "module"이라 Jest 설정은 CJS(.cjs)로 명시
/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  // ts-jest가 .js도 변환하도록 확장 — three가 node_modules에 ESM으로만
  // 배포되어서(아래 transformIgnorePatterns) CJS 변환이 필요하다
  transform: {
    '^.+\\.[tj]sx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
  // node_modules는 기본적으로 변환하지 않지만 three는 ESM-only라 예외.
  // 누락 시 "Unexpected token 'export'" 에러가 난다.
  transformIgnorePatterns: ['/node_modules/(?!three)'],
  moduleNameMapper: {
    // 'swiper/css'는 확장자 없는 subpath export라 아래 .scss/.css 패턴에
    // 안 걸림 — 별도 매핑 필요 (없으면 ts-jest가 실제 CSS 파일을 파싱 시도)
    '^swiper/css$': 'identity-obj-proxy',
    '\\.(scss|css)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|webp|avif|svg|woff2?)$': '<rootDir>/src/test/fileMock.cjs',
  },
  setupFilesAfterEnv: ['<rootDir>/src/test/setupTests.ts'],
};
