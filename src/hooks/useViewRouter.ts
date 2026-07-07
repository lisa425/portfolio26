import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useBlocker, useLocation, useNavigate, useParams } from "react-router";
import gsap from "gsap";
import type { LangType } from "../types";
import {
  DEFAULT_LANG,
  isSupportedLang,
  pathForView,
  viewFromPath,
  type SectionView,
  type StableView,
  type ViewType,
} from "../utils/routing";

type TransitionTrigger = (onComplete: () => void) => void;

interface UseViewRouterParams {
  triggerWorksTransition: TransitionTrigger;
  triggerAboutTransition: TransitionTrigger;
  triggerHeroTransition: TransitionTrigger;
  /** Snaps camera/particles to a view's end state — used by the direct
   *  works ↔ about switch (no zoom flight, the swap hides behind the overlay) */
  applyViewInstant: (view: StableView) => void;
  /** Shared with useHeroScene — kept in sync with `view === "hero"` */
  isHeroActiveRef: React.RefObject<boolean>;
  /** false while IntroLog is showing; location changes are ignored until ready */
  isReady: boolean;
}

/** works ↔ about direct-switch motion (cut + directional fade) */
const SWITCH_OUT = { y: -24, duration: 0.25, ease: "power2.in" };
const SWITCH_IN = { y: 24, duration: 0.3, ease: "power2.out", delay: 0.15 };
/** Give up waiting for the target section's chunk and commit without motion */
const SWITCH_MOUNT_TIMEOUT_MS = 3000;

/**
 * URL-first view orchestration.
 *
 * Every navigation source (button click, browser back/forward, redirect)
 * changes the URL first; the location effect below is the single pipeline
 * that reacts to it — camera transition plays, then the view is committed.
 * The URL change itself never touches rendering, so the Three.js scene
 * (mounted in the layout above the routes) is never interrupted.
 */
export function useViewRouter({
  triggerWorksTransition,
  triggerAboutTransition,
  triggerHeroTransition,
  applyViewInstant,
  isHeroActiveRef,
  isReady,
}: UseViewRouterParams) {
  const location = useLocation();
  const navigate = useNavigate();

  // Current language from the /:lang route param (validated by the route
  // loader, so the fallback is defensive only)
  const { lang: langParam } = useParams();
  const lang: LangType = isSupportedLang(langParam) ? langParam : DEFAULT_LANG;

  // Deep link support: the initial view comes straight from the URL, so a
  // refresh at /works renders works immediately — no transition plays.
  // (The scene itself is snapped to the matching state via applyViewInstant
  // once loading completes; see App's IntroLog onComplete.)
  const [view, setView] = useState<ViewType>(
    () => viewFromPath(location.pathname) ?? "hero",
  );
  const viewRef = useRef<ViewType>(view);
  const heroAnimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep-alive: mount Works/About on first visit, stay mounted to preserve state
  // Set at transition START (not on view change) to avoid Suspense flash
  const [hasShownWorks, setHasShownWorks] = useState(view === "works");
  const [hasShownAbout, setHasShownAbout] = useState(view === "about");

  // useLayoutEffect (not useEffect): the refs must be in sync the moment the
  // commit lands — guards like switchLang read viewRef on the very next click,
  // and a paint-deferred sync would briefly leave it at "transitioning"
  useLayoutEffect(() => {
    viewRef.current = view;
    isHeroActiveRef.current = view === "hero";
  }, [view, isHeroActiveRef]);

  // Block ALL navigation while a camera transition is playing.
  // A blocked popstate is reverted by the router, so URL and view
  // can never drift apart mid-animation.
  const blocker = useBlocker(
    useCallback(() => viewRef.current === "transitioning", []),
  );
  useEffect(() => {
    if (blocker.state === "blocked") blocker.reset();
  }, [blocker]);

  const killHeroTweens = useCallback(() => {
    if (heroAnimTimerRef.current) {
      clearTimeout(heroAnimTimerRef.current);
      heroAnimTimerRef.current = null;
    }
    gsap.killTweensOf(".hero");
  }, []);

  const startSectionTransition = useCallback(
    (target: SectionView) => {
      if (target === "works") setHasShownWorks(true);
      else setHasShownAbout(true);
      setView("transitioning");
      killHeroTweens();
      gsap.set(".hero", { opacity: 0 });
      const trigger =
        target === "works" ? triggerWorksTransition : triggerAboutTransition;
      trigger(() => setView(target));
    },
    [killHeroTweens, triggerWorksTransition, triggerAboutTransition],
  );

  // works ↔ about direct switch: no camera flight — the outgoing section's
  // content fades out upward, the camera snaps behind the (near-opaque)
  // section overlays, and the incoming section fades in from below.
  // Both page-sub overlays share the same background color, so keeping both
  // at full opacity during the swap makes the snap invisible.
  const startDirectSwitch = useCallback(
    (target: SectionView) => {
      const from = viewRef.current as SectionView;
      if (target === "works") setHasShownWorks(true);
      else setHasShownAbout(true);

      const outPage = document.querySelector<HTMLElement>(`.page-sub.${from}`);
      const outInner = outPage?.querySelector<HTMLElement>(".inner") ?? null;

      // Take over from the .page-sub CSS opacity transition for the whole
      // switch — inline opacity keeps the outgoing overlay solid even after
      // React drops its .visible class on the next commit.
      outPage?.classList.add("page-sub--switching");
      if (outPage) gsap.set(outPage, { opacity: 1 });

      setView("transitioning");
      killHeroTweens();
      applyViewInstant(target);

      if (outInner) {
        gsap.fromTo(outInner, { y: 0, autoAlpha: 1 }, { ...SWITCH_OUT, autoAlpha: 0 });
      }

      const releaseControl = (inPage: HTMLElement | null, inInner: HTMLElement | null) => {
        setView(target);
        // Clear inline styles only after React has committed the new view's
        // .visible class — double rAF spans that commit, so the incoming
        // overlay never has a frame without an opacity source.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            for (const el of [outPage, inPage]) el?.classList.remove("page-sub--switching");
            if (outPage) gsap.set(outPage, { clearProps: "opacity" });
            if (outInner) gsap.set(outInner, { clearProps: "all" });
            if (inPage) gsap.set(inPage, { clearProps: "opacity,zIndex" });
            if (inInner) gsap.set(inInner, { clearProps: "all" });
          });
        });
      };

      // The incoming section may still be mounting (lazy chunk + Suspense) —
      // poll for its DOM before animating it in.
      const waitStart = performance.now();
      const animateIn = () => {
        const inPage = document.querySelector<HTMLElement>(`.page-sub.${target}`);
        const inInner = inPage?.querySelector<HTMLElement>(".inner");
        if (!inPage || !inInner) {
          if (performance.now() - waitStart < SWITCH_MOUNT_TIMEOUT_MS) {
            requestAnimationFrame(animateIn);
          } else {
            releaseControl(null, null); // chunk never arrived — commit without motion
          }
          return;
        }
        inPage.classList.add("page-sub--switching");
        // zIndex lifts the incoming overlay above the outgoing one regardless
        // of their DOM order (works is rendered before about)
        gsap.set(inPage, { opacity: 1, zIndex: 5 });
        gsap.fromTo(inInner, { y: SWITCH_IN.y, autoAlpha: 0 }, {
          y: 0,
          autoAlpha: 1,
          duration: SWITCH_IN.duration,
          ease: SWITCH_IN.ease,
          delay: SWITCH_IN.delay,
          onComplete: () => releaseControl(inPage, inInner),
        });
      };
      requestAnimationFrame(animateIn);
    },
    [applyViewInstant, killHeroTweens],
  );

  const startHeroTransition = useCallback(() => {
    setView("transitioning");
    killHeroTweens();
    // .hero fades back in partway through the zoom-out
    heroAnimTimerRef.current = setTimeout(() => {
      gsap.to(".hero", { opacity: 1, duration: 0.5, ease: "power2.out" });
    }, 1000);
    triggerHeroTransition(() => setView("hero"));
  }, [killHeroTweens, triggerHeroTransition]);

  // The orchestrator: reacts to every location change with the same pipeline.
  // setState here is intentional — the URL is the external system we subscribe
  // to (via useLocation) and `view` must sync to it exactly once per change.
  useEffect(() => {
    if (!isReady) return;
    const target = viewFromPath(location.pathname);
    if (target === null) return; // unknown paths redirect via the catch-all route
    const current = viewRef.current;
    if (current === "transitioning" || target === current) return;

    if (target === "hero") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      startHeroTransition();
    } else if (current === "hero") {
      startSectionTransition(target);
    } else {
      // works ↔ about (header nav, back/forward): direct cut + fade
      startDirectSwitch(target);
    }
  }, [
    location.pathname,
    isReady,
    view,
    startHeroTransition,
    startSectionTransition,
    startDirectSwitch,
  ]);

  // Section navigation is allowed from hero (star buttons → zoom) AND from
  // the other section (header nav → direct switch); only mid-transition
  // clicks and no-op clicks are ignored.
  const goWorks = useCallback(() => {
    const v = viewRef.current;
    if (v === "transitioning" || v === "works") return;
    navigate(pathForView("works", lang));
  }, [navigate, lang]);

  const goAbout = useCallback(() => {
    const v = viewRef.current;
    if (v === "transitioning" || v === "about") return;
    navigate(pathForView("about", lang));
  }, [navigate, lang]);

  const goHero = useCallback(() => {
    const v = viewRef.current;
    if (v === "hero" || v === "transitioning") return;
    navigate(pathForView("hero", lang));
  }, [navigate, lang]);

  // Language switch keeps the current view and REPLACES the history entry —
  // back button should never step through language changes
  const switchLang = useCallback(
    (nextLang: LangType) => {
      const v = viewRef.current;
      if (nextLang === lang || v === "transitioning") return;
      navigate(pathForView(v, nextLang), { replace: true });
    },
    [navigate, lang],
  );

  // View the current URL points at — updates the instant navigation happens,
  // unlike `view` which lags until the transition completes. Drives the
  // header nav's visibility/active state so it never flickers mid-switch.
  const urlView = viewFromPath(location.pathname);

  return {
    view,
    urlView,
    lang,
    hasShownWorks,
    hasShownAbout,
    goWorks,
    goAbout,
    goHero,
    switchLang,
  };
}
