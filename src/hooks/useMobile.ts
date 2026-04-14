import { useEffect, useState } from "react";

const MOBILE_BREAKPOINT_PX = 1000;

/**
 * Detects whether the current environment should be treated as "mobile".
 *
 * Two independent signals are checked:
 *  1. **Viewport width** — `window.innerWidth <= 1000px`
 *  2. **Device type**    — touch-capable device via User-Agent + `maxTouchPoints`
 *
 * `isMobile` is `true` when **either** condition is met.
 *
 * The hook listens for viewport resize so `isMobile` stays reactive when the
 * browser window is resized (e.g. DevTools responsive mode).
 */
export const useMobile = () => {
  const getIsMobileDevice = (): boolean => {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent || "";
    const mobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    // iPad on iOS 13+ reports as "Macintosh" — catch it via touch support
    const isTouchDesktopUA =
      /Macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
    return mobileUA || isTouchDesktopUA;
  };

  const getIsNarrowViewport = (): boolean => {
    if (typeof window === "undefined") return false;
    return window.innerWidth <= MOBILE_BREAKPOINT_PX;
  };

  const [isMobileDevice] = useState(getIsMobileDevice);
  const [isNarrowViewport, setIsNarrowViewport] = useState(getIsNarrowViewport);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX}px)`);
    const sync = () => setIsNarrowViewport(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const isMobile = isMobileDevice || isNarrowViewport;

  return { isMobile, isMobileDevice, isNarrowViewport };
};
