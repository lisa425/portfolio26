# Project Rules: Singularity Portfolio

## 1. Code Style & Tech Stack
- **Framework**: Vite + React + TypeScript
- **Styling**: SCSS (Nesting, Variables 적극 활용)
- **Libraries**: Three.js, GSAP, react-i18next
- **Naming**: 
  - 컴포넌트는 PascalCase (예: `WorkPanel.tsx`)
  - 변수 및 함수는 camelCase
  - 파일 경로는 kebab-case 권장 (단, 컴포넌트 파일 제외)
- **TypeScript**: 
  - `any` 사용을 지양하고 구체적인 타입을 정의할 것.
  - 공통 타입은 `src/types/index.ts`에서 관리하고 `import type`으로 가져올 것.
- **Build**: `npm run build`는 사용자가 명시적으로 요청할 때만 수행한다.

## 2. Interaction Guidelines
- **Auto-Execution**: 
  - 단순 코드 수정, 파일 생성, 패키지 설치(npm install)는 사용자 승인 없이 바로 실행 가능.
- **Ask for Permission**:
  - `npm run build`와 같은 무거운 작업이나 프로젝트 구조를 근본적으로 바꾸는 작업은 실행 전 반드시 확인.
  - 기존에 작성된 복잡한 Three.js 로직을 대폭 수정해야 할 때도 사전에 확인.
- **Language**: 모든 설명과 사용자 응대, 코드 내 주석은 한국어를 기본으로 함.

## 3. Asset Management
- 이미지는 `src/assets/`에 넣고 `import`하여 사용하는 방식을 기본으로 함.
- 3D 모델(GLB/GLTF)이나 대용량 파일은 `public/assets/`를 사용함.
