import { useCallback, useEffect, useRef, useState } from "react";
import Corners from "./Corners";
import Skeleton from "./Skeleton";
import styles from "./WorkDetailImage.module.scss";

/** 로드 전 플레이스홀더 높이(px) — 팝업이 이미지 로드 전에 쪼그라들지 않게 함 */
export const PANEL_IMG_PLACEHOLDER_H = 240;

interface WorkDetailImageProps {
  src: string;
  /** 목록 내 순번 — 앞쪽 2장은 eager 로드 */
  index: number;
}

/**
 * Works detail 모달의 프로젝트 이미지.
 * 로드 전에는 240px 플레이스홀더 + 스켈레톤 셔머를 보여주고,
 * 로드 후 자연 높이로 전환한다 (CSS는 height를 auto로 애니메이션 못 하므로
 * JS가 px 값을 계산해 넣는다). 스타일: WorkDetailImage.module.scss
 */
function WorkDetailImage({ src, index }: WorkDetailImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [heightPx, setHeightPx] = useState(PANEL_IMG_PLACEHOLDER_H);
  const imgRef = useRef<HTMLImageElement>(null);

  const settleNaturalHeight = useCallback(() => {
    const img = imgRef.current;
    if (!img?.naturalWidth) {
      setHeightPx(PANEL_IMG_PLACEHOLDER_H);
      return;
    }
    setHeightPx(img.offsetHeight);
  }, []);

  useEffect(() => {
    setLoaded(false);
    setHeightPx(PANEL_IMG_PLACEHOLDER_H);
    const el = imgRef.current;
    if (el?.complete && el.naturalWidth > 0) {
      setLoaded(true);
      // Two rAFs so the browser paints placeholder height first; then `height` can transition.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          settleNaturalHeight();
        });
      });
    }
  }, [src, settleNaturalHeight]);

  const handleLoad = () => {
    setLoaded(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        settleNaturalHeight();
      });
    });
  };

  const handleError = () => {
    setLoaded(true);
    setHeightPx(PANEL_IMG_PLACEHOLDER_H);
  };

  return (
    <div className={styles["panel-image-container"]}>
      <Corners />
      <div
        className={styles["image-wrapper"]}
        style={{ height: heightPx }}
        aria-busy={!loaded}
      >
        <Skeleton hidden={loaded} />
        <img
          ref={imgRef}
          src={src}
          alt=""
          loading={index < 2 ? "eager" : "lazy"}
          decoding="async"
          onLoad={handleLoad}
          onError={handleError}
          className={loaded ? "is-loaded" : ""}
        />
      </div>
    </div>
  );
}

export default WorkDetailImage;
