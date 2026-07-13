import type { SubProjectType } from "../../types";
import { renderText } from "../../utils/renderText";
import styles from "./WorksSubList.module.scss";

interface WorksSubListProps {
  items: SubProjectType[];
  /** 섹션 헤딩 텍스트 (기본 OTHER PROJECTS) */
  title?: string;
}

/** 링크 라벨용 호스트명 — 파싱 실패 시 일반 라벨로 폴백 */
function hostnameOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "LINK";
  }
}

/**
 * View All의 "Other Projects" 단순 텍스트 리스트.
 * 썸네일/상세 이미지가 없는 subProject 항목을 YEAR/PROJECT/DEPT/STACK/LINK
 * 테이블형 행으로 보여준다. detail 모달 없이, url이 있는 항목만 외부 링크(새 탭).
 * 스타일: WorksSubList.module.scss
 */
function WorksSubList({ items, title = "OTHER PROJECTS" }: WorksSubListProps) {
  if (items.length === 0) return null;

  return (
    <section className={styles["sub-list"]}>
      <h3 className={styles["sub-list__title"]}>◼︎ {title}</h3>
      <div className={styles["sub-list__head"]} aria-hidden>
        <span>YEAR</span>
        <span>PROJECT</span>
        <span>DEPT</span>
        <span>STACK</span>
        <span>LINK</span>
      </div>
      <ul className={styles["sub-list__rows"]}>
        {items.map((item, i) => (
          <li key={`${item.title}-${i}`} className={styles["sub-list__row"]}>
            <span className={styles["sub-list__year"]}>{item.date.slice(0, 4)}</span>
            <span className={styles["sub-list__project"]}>
              <span className={styles["sub-list__name"]}>{renderText(item.title)}</span>
              {item.intro && (
                <span className={styles["sub-list__intro"]}>{renderText(item.intro)}</span>
              )}
            </span>
            <span className={styles["sub-list__dept"]}>{item.dept}</span>
            <span className={styles["sub-list__stack"]}>{item.stack}</span>
            <span className={styles["sub-list__link"]}>
              {item.url && (
                <a href={item.url} target="_blank" rel="noopener noreferrer">
                  {hostnameOf(item.url)} ↗
                </a>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default WorksSubList;
