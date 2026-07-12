import { useEffect, useState } from "react";
import Skeleton from "./Skeleton";

interface WorksPreviewThumbProps {
  src: string;
  alt: string;
}

/**
 * Works 프리뷰 카드의 4:3 썸네일 — 로드 전 스켈레톤, 로드 후 페이드인,
 * 스캔라인 오버레이 포함. 스타일: App.scss `.works-preview__thumb`
 */
function WorksPreviewThumb({ src, alt }: WorksPreviewThumbProps) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
  }, [src]);

  return (
    <div className="works-preview__thumb">
      <Skeleton hidden={loaded} />
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        className={loaded ? "is-loaded" : ""}
      />
      <div className="works-preview__thumb-scan" />
    </div>
  );
}

export default WorksPreviewThumb;
