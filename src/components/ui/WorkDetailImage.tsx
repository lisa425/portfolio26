import { useRef, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import type { Swiper as SwiperInstance } from "swiper";
import "swiper/css";
import Corners from "./Corners";
import Skeleton from "./Skeleton";
import styles from "./WorkDetailImage.module.scss";

interface WorkDetailImageProps {
  /** 프로젝트 이미지 경로 배열 — 컨테이너 하나 안에서 스와이프로 전환 */
  src: string[];
}

/**
 * Works detail 모달의 프로젝트 이미지 갤러리.
 * 컨테이너는 하나로 고정(16:9)이고, `src` 배열의 이미지들을 Swiper로
 * 넘겨가며 본다. 각 슬라이드는 로드 전 스켈레톤 셔머를 보여준다.
 * 스타일: WorkDetailImage.module.scss
 */
function WorkDetailImage({ src }: WorkDetailImageProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [loadedSet, setLoadedSet] = useState<ReadonlySet<number>>(new Set());
  const swiperRef = useRef<SwiperInstance | null>(null);

  const markLoaded = (i: number) => {
    setLoadedSet((prev) => (prev.has(i) ? prev : new Set(prev).add(i)));
  };

  return (
    <div className={styles["panel-image-container"]}>
      <Corners />
      <div className={styles["image-wrapper"]}>
        <Swiper
          className={styles["image-swiper"]}
          onSwiper={(s) => {
            swiperRef.current = s;
          }}
          onSlideChange={(s) => setActiveIndex(s.activeIndex)}
        >
          {src.map((url, i) => (
            <SwiperSlide key={url} className={styles["image-slide"]}>
              <Skeleton hidden={loadedSet.has(i)} />
              <img
                src={url}
                alt=""
                loading={i === 0 ? "eager" : "lazy"}
                decoding="async"
                onLoad={() => markLoaded(i)}
                onError={() => markLoaded(i)}
                className={loadedSet.has(i) ? "is-loaded" : ""}
              />
            </SwiperSlide>
          ))}
        </Swiper>
      </div>

      {src.length > 1 && (
        <div className={styles["swiper-controls"]}>
          <button
            type="button"
            className={styles["swiper-btn"]}
            onClick={() => swiperRef.current?.slidePrev()}
            aria-label="previous image"
          >
            [ &lt; ]
          </button>
          <span className={styles["swiper-count"]}>
            {String(activeIndex + 1).padStart(2, "0")}/
            {String(src.length).padStart(2, "0")}
          </span>
          <button
            type="button"
            className={styles["swiper-btn"]}
            onClick={() => swiperRef.current?.slideNext()}
            aria-label="next image"
          >
            [ &gt; ]
          </button>
        </div>
      )}
    </div>
  );
}

export default WorkDetailImage;
