import type { Ref } from "react";
import type { WorkType } from "../../types";
import { renderText } from "../../utils/renderText";
import WorksPreviewThumb from "./WorksPreviewThumb";
import styles from "./WorksPreviewCard.module.scss";

interface WorksPreviewCardProps {
  work: WorkType;
  /** 0-based 순번 — 헤더의 00X/00Y 인디케이터용 */
  index: number;
  total: number;
  /**
   * 카드 노출 상태. 모바일 리스트는 상시 true,
   * PC 호버 패널은 false로 렌더 후 Works가 DOM classList로 직접 토글한다.
   */
  active?: boolean;
  onClick?: () => void;
  /** PC 호버 패널: Works가 panelRefs로 위치/표시를 직접 제어하므로 ref 필요 */
  ref?: Ref<HTMLDivElement>;
}

/**
 * Works 프로젝트 프리뷰 카드 (헤더 + 썸네일 + 데이터 행 + 푸터).
 * 모바일 세로 리스트와 PC 노드 호버 패널이 같은 마크업을 공유한다.
 * 스타일: App.scss `.works-preview`
 */
function WorksPreviewCard({
  work,
  index,
  total,
  active = false,
  onClick,
  ref,
}: WorksPreviewCardProps) {
  return (
    // literal `works-preview`는 외부 계약용 훅 클래스 — Works.tsx의 GSAP 셀렉터,
    // App.scss의 모바일 리스트 오버라이드, PC 호버 classList('active') 토글이 참조한다
    <div
      className={`${styles["works-preview"]} works-preview${active ? " active" : ""}`}
      onClick={onClick}
      ref={ref}
    >
      <div className={styles["works-preview__header"]}>
        <span className={styles["works-preview__panel-id"]}>◼︎ TARGET NODE</span>
        <span className={styles["works-preview__index"]}>
          {String(index + 1).padStart(3, "0")}/
          {String(total).padStart(3, "0")}
        </span>
      </div>
      <WorksPreviewThumb src={work.thumbnail} alt={work.title} />
      <div className={styles["works-preview__data"]}>
        <div className={styles["works-preview__row"]}>
          <span className={styles["works-preview__key"]}>GAME</span>
          <span className={styles["works-preview__val"]}>{work.game}</span>
        </div>
        <div className={styles["works-preview__row"]}>
          <span className={styles["works-preview__key"]}>NAME</span>
          <span className={styles["works-preview__val"]}>
            {renderText(work.title)}
          </span>
        </div>
        <div className={styles["works-preview__row"]}>
          <span className={styles["works-preview__key"]}>TECH</span>
          <span className={styles["works-preview__val"]}>{work.stack}</span>
        </div>
      </div>
      <div className={styles["works-preview__footer"]}>
        <span className={styles["works-preview__status"]}>
          <span className={styles["works-preview__dot"]} />
          ONLINE
        </span>
        <span className={styles["works-preview__action"]}>[ ENTER ]</span>
      </div>
    </div>
  );
}

export default WorksPreviewCard;
