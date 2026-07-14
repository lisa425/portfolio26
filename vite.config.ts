import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 프리뷰 하네스가 autoPort로 PORT 환경변수를 주입하는데 Vite는 기본적으로
  // 이를 읽지 않아 하네스가 추적하는 포트와 실제 바인딩 포트가 어긋날 수 있음
  server: {
    port: Number(process.env.PORT) || 5173,
  },
});
