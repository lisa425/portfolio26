interface SkeletonProps {
  /** true면 셔머를 멈추고 페이드아웃 (콘텐츠 로드 완료 시) */
  hidden?: boolean;
}

/**
 * 이미지/콘텐츠 로딩 자리에 깔리는 셔머 오버레이.
 * 부모가 position: relative + 크기를 가져야 한다 (inset: 0으로 채움).
 * 스타일: App.scss `.ui-skeleton`
 */
function Skeleton({ hidden = false }: SkeletonProps) {
  return (
    <div
      className={`ui-skeleton${hidden ? " ui-skeleton--hidden" : ""}`}
      aria-hidden
    />
  );
}

export default Skeleton;
