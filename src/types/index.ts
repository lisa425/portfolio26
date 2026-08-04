export type LangType = 'ko' | 'en'

export type ProjectKey =
  | 'azure-promilia'
  | 'mabinogi-heroes-dev-environment'
  | 'mabinogi-heroes-operations-automation'
  | 'mabinogi-mobile-preregistration'
  | 'baram-gallery'

/** Works detail의 구조화된 성과 블록 (배경/해결/결과 등) */
export type WorkHighlight = {
  title: string
  p: string[]
}

/**
 * WorksSubList가 렌더하는 공용 행 데이터 — SubProjectType과 WorkType(매핑 후)
 * 둘 다 이 모양에 맞춰 같은 텍스트 리스트 컴포넌트를 공유한다.
 */
export type WorksListRowItem = {
  title: string
  dept: string
  intro?: string
  date: string
  stack: string
  /** 있으면 리스트에서 외부 링크(새 탭)로 노출 — onItemClick과 동시 사용 안 함 */
  url?: string
}

/**
 * works.subProject(translation.json)의 항목 — View All의 "Other Projects"
 * 단순 리스트용 축약 스키마 (썸네일/상세 이미지 없음, detail 모달 미연결)
 */
export type SubProjectType = WorksListRowItem

/** works.selectedProject(translation.json)의 프로젝트 항목 — Works 화면과 ui 컴포넌트가 공유 */
export type WorkType = {
  id: number
  projectKey: ProjectKey
  category: number
  dept: string
  game: string
  title: string
  intro: string
  date: string
  description: WorkHighlight[]
  stack: string
  thumbnail: string
  img: string[]
  url: string
}
