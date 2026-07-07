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
  type ViewType,
} from "../utils/routing";

type TransitionTrigger = (onComplete: () => void) => void;

interface UseViewRouterParams {
  triggerWorksTransition: TransitionTrigger;
  triggerAboutTransition: TransitionTrigger;
  triggerHeroTransition: TransitionTrigger;
  /** Shared with useHeroScene — kept in sync with `view === "hero"` */
  isHeroActiveRef: React.RefObject<boolean>;
  /** false while IntroLog is showing; location changes are ignored until ready */
  isReady: boolean;
}

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
      // works ↔ about without passing hero — unreachable from Phase 1 UI.
      // Defensive chain (zoom out, then into the other star); Phase 4 polishes this.
      setView("transitioning");
      killHeroTweens();
      triggerHeroTransition(() => startSectionTransition(target));
    }
  }, [
    location.pathname,
    isReady,
    view,
    startHeroTransition,
    startSectionTransition,
    killHeroTweens,
    triggerHeroTransition,
  ]);

  const goWorks = useCallback(() => {
    if (viewRef.current !== "hero") return;
    navigate(pathForView("works", lang));
  }, [navigate, lang]);

  const goAbout = useCallback(() => {
    if (viewRef.current !== "hero") return;
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

  return {
    view,
    lang,
    hasShownWorks,
    hasShownAbout,
    goWorks,
    goAbout,
    goHero,
    switchLang,
  };
}
