export type LangType = "ko" | "en";

/** Works detail의 구조화된 성과 블록 (배경/해결/결과 등) */
export type WorkHighlight = {
  title: string;
  p: string[];
};

/** works.items(translation.json)의 프로젝트 항목 — Works 화면과 ui 컴포넌트가 공유 */
export type WorkType = {
  id: number;
  category: number;
  game: string;
  title: string;
  intro: string;
  date: string;
  description: WorkHighlight[];
  stack: string;
  thumbnail: string;
  img: string[];
  url: string;
};
