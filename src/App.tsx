import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Outlet } from "react-router";
import { useTranslation } from "react-i18next";
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import { useMobile } from "./hooks/useMobile";
import { savePreferredLang } from "./utils/routing";

gsap.registerPlugin(SplitText);
import "./App.scss";
import { useHeroScene } from "./hooks/useHeroScene";
import { useViewRouter } from "./hooks/useViewRouter";
import { useCursorTrail } from "./hooks/useCursorTrail";
import IntroLog from "./components/IntroLog";
import Seo from "./components/Seo";

// Code-split: Works & About are lazy-loaded on first visit
const Works = lazy(() => import("./components/Works"));
const About = lazy(() => import("./components/About"));

// ---------------------------------------------------------------------------
// Static timezone info — computed once at module load, never on re-render
// (setCurrentTime fires every second; keeping these here prevents repeated
//  Intl / Date API calls on each React re-render)
// ---------------------------------------------------------------------------
const _tzName = Intl.DateTimeFormat().resolvedOptions().timeZone;
const _tzShort =
  new Date()
    .toLocaleTimeString("en-US", { timeZoneName: "short" })
    .split(" ")
    .at(-1) ?? _tzName;
const _utcOffsetH = -new Date().getTimezoneOffset() / 60;
const _utcLabel = `UTC${_utcOffsetH >= 0 ? "+" : ""}${String(_utcOffsetH).padStart(2, "0")}:00`;

/** Max wait for `document.fonts.ready` before continuing intro (avoids hanging on slow/broken fonts). */
const FONTS_READY_MAX_WAIT_MS = 2500;

function App() {
  const { i18n } = useTranslation();
  const { isMobile } = useMobile();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const buttonWorksRef = useRef<HTMLButtonElement>(null);
  const buttonAboutRef = useRef<HTMLButtonElement>(null);
  const trailCanvasRef = useRef<HTMLCanvasElement>(null);

  const [loadProgress, setLoadProgress] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [locationStr, setLocationStr] = useState("37° 33' N ■ 126° 58' E");
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const isHeroActiveRef = useRef(true);

  // Intro log: plays every page load; false after first run so hero-return skips it
  const [showIntro, setShowIntro] = useState(true);
  const heroContentRef = useRef<HTMLDivElement>(null);

  // WebGL init reports 100 in the same tick as scene setup; the intro still waits on
  // `document.fonts.ready` + delay. Without tying the counter to that, (100/100) looked
  // "stuck" while fonts were still loading. Cap at 99 until fonts resolve (or timeout).

  const handleProgress = useCallback((progress: number) => {
    if (progress < 100) {
      setLoadProgress(progress);
      return;
    }
    setLoadProgress(99);
    Promise.race([
      document.fonts.ready,
      new Promise<void>((resolve) => {
        setTimeout(resolve, FONTS_READY_MAX_WAIT_MS);
      }),
    ]).then(() => {
      setLoadProgress(100);
      // Brief hold so 100/100 is readable before line cycling starts
      setTimeout(() => setIsLoaded(true), 500);
    });
  }, []);

  // Geolocation
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;

          const dLat = Math.floor(Math.abs(lat));
          const mLat = Math.floor((Math.abs(lat) - dLat) * 60);
          const dLng = Math.floor(Math.abs(lng));
          const mLng = Math.floor((Math.abs(lng) - dLng) * 60);

          const dirLat = lat >= 0 ? "N" : "S";
          const dirLng = lng >= 0 ? "E" : "W";

          setLocationStr(
            `${dLat}° ${mLat}' ${dirLat} ■ ${dLng}° ${mLng}' ${dirLng}`,
          );
        },
        (error) => {
          console.error("Geolocation error:", error);
          setLocationStr("37° 33' N ■ 126° 58' E");
        },
      );
    } else {
      setLocationStr("37° 33' N ■ 126° 58' E");
    }
  }, []);

  // Live Clock
  useEffect(() => {
    const DAY = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    const tick = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("en-US", {
          hour12: true,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const d = String(now.getDate()).padStart(2, "0");
      setCurrentDate(`${y}.${m}.${d}  ${DAY[now.getDay()]}`);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  // Three.js Scene
  const {
    triggerWorksTransition,
    triggerAboutTransition,
    triggerHeroTransition,
    triggerAssembly,
    applyViewInstant,
  } = useHeroScene(
    canvasRef,
    containerRef,
    buttonWorksRef,
    buttonAboutRef,
    handleProgress,
    isHeroActiveRef,
  );

  useCursorTrail(trailCanvasRef);

  // URL-first routing: button clicks and browser back/forward all change the
  // URL, and the hook runs the same camera-transition pipeline for every source
  const {
    view,
    lang,
    hasShownWorks,
    hasShownAbout,
    goWorks,
    goAbout,
    goHero,
    switchLang,
  } = useViewRouter({
    triggerWorksTransition,
    triggerAboutTransition,
    triggerHeroTransition,
    isHeroActiveRef,
    isReady: !showIntro,
  });

  // URL lang → i18next / <html> lang / <body> class / persisted preference
  // (one-way sync; the reverse direction is switchLang, which navigates)
  useEffect(() => {
    if (i18n.language !== lang) i18n.changeLanguage(lang);
    savePreferredLang(lang);
    document.documentElement.lang = lang;
    document.body.classList.remove("ko", "en");
    document.body.classList.add(lang);
  }, [lang, i18n]);

  // Btn hover — terminal typewriter effect via GSAP
  useEffect(() => {
    if (!isLoaded) return;

    const btnRefs = [buttonWorksRef.current, buttonAboutRef.current];
    const cleanups: (() => void)[] = [];

    btnRefs.forEach((btn) => {
      if (!btn) return;

      const textEl = btn.querySelector<HTMLElement>(".btn-text");
      const textContent = btn.querySelector<HTMLElement>(".btn-text__text");
      const cursorEl = btn.querySelector<HTMLElement>(".btn-text__cursor");
      if (!textEl || !textContent) return;

      if (isMobile) {
        // Mobile uses CSS blinking animations; skip all GSAP text interventions to prevent inline style overrides
        // Clear any GSAP inline styles that might hide the text
        gsap.set(textEl, { clearProps: "all" });
        return;
      }

      gsap.set(textEl, { opacity: 0, x: 10 });
      cursorEl?.classList.remove("active");

      const split = new SplitText(textContent, { type: "chars" });
      gsap.set(split.chars, { opacity: 0, display: "inline-block" });
      gsap.set(textContent, { clearProps: "opacity" });

      const CHAR_DELAY = 0.07; // gap between each char
      const HOLD = 0.05; // how long the active highlight stays

      const tl = gsap.timeline({
        paused: true,
        // cursor CSS animation starts only after all chars are done
        onComplete: () => cursorEl?.classList.add("active"),
      });

      // Slide wrapper in
      tl.to(textEl, { opacity: 1, x: 0, duration: 0.15, ease: "power2.out" });

      // Per-char: active highlight (white bg + black text) → settled (transparent + white)
      split.chars.forEach((char, i) => {
        const t = 0.15 + i * CHAR_DELAY;
        tl.set(
          char,
          { opacity: 1, backgroundColor: "#ffffff", color: "#000000" },
          t,
        );
        tl.to(
          char,
          { backgroundColor: "transparent", color: "#ffffff", duration: HOLD },
          t + HOLD,
        );
      });

      const reset = () => {
        tl.pause(0);
        gsap.set(textEl, { opacity: 0, x: 10 });
        gsap.set(split.chars, {
          opacity: 0,
          backgroundColor: "transparent",
          color: "#ffffff",
        });
        cursorEl?.classList.remove("active");
      };

      const onEnter = () => {
        cursorEl?.classList.remove("active");
        tl.restart();
      };
      const onLeave = () => reset();

      btn.addEventListener("mouseenter", onEnter);
      btn.addEventListener("mouseleave", onLeave);

      cleanups.push(() => {
        btn.removeEventListener("mouseenter", onEnter);
        btn.removeEventListener("mouseleave", onLeave);
        tl.kill();
        split.revert();
      });
    });

    return () => cleanups.forEach((fn) => fn());
  }, [isLoaded, isMobile]);

  const heroIntroMotion = () => {
    let split1: SplitText | undefined;
    let split2: SplitText | undefined;
    let split3: SplitText | undefined;

    if (!isMobile) {
      split1 = new SplitText(".desc-text-1", { type: "chars" });
      split2 = new SplitText(".desc-text-2", { type: "chars" });
      split3 = new SplitText(".desc-text-3", { type: "chars" });
    }

    const tl = gsap
      .timeline()
      // 0. particles converge from scatter → star shape
      .call(() => triggerAssembly())
      // 1. fade in hero content
      .fromTo(
        heroContentRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.5, ease: "linear" },
      )
      // 2. canvas brightness reveal
      .to(
        ".webgl-canvas",
        { filter: "brightness(1)", duration: 2, ease: "circ.out" },
        "<",
      );

    if (!isMobile) {
      tl.from(
        ".title-word",
        { y: "110%", duration: 1.2, stagger: 0.1, ease: "circ.out" },
        "<+0.15",
      )
        .from(
          ".desc-wrap",
          { x: -10, stagger: 0.1, duration: 0.8, ease: "circ.out" },
          "<+0.1",
        )
        .from(
          ".desc-wrap",
          { opacity: 0, stagger: 0.1, duration: 0.2, ease: "power1.out" },
          "<",
        )
        .from(
          split1!.chars,
          { opacity: 0, duration: 0.01, stagger: 0.025, ease: "none" },
          "<",
        )
        .from(
          split2!.chars,
          { opacity: 0, duration: 0.01, stagger: 0.025, ease: "none" },
          "<0.1",
        )
        .from(
          split3!.chars,
          { opacity: 0, duration: 0.01, stagger: 0.025, ease: "none" },
          "<0.1",
        )
        .from(
          ".desc-separator",
          { opacity: 0, duration: 0.4, ease: "power1.out" },
          "<0.1",
        )
        .from(
          ".hero-hud-data__monitor",
          { opacity: 0, x: 50, duration: 0.8, ease: "circ.out" },
          "<",
        )
        .from(
          ".hero-hint",
          {
            opacity: 0,
            duration: 0.8,
            ease: "linear",
          },
          "<",
        )
        .from(
          ".hero-hint",
          {
            y: -10,
            duration: 0.8,
            ease: "circ.out",
          },
          "<",
        )
        .call(() => {
          split1?.revert();
          split2?.revert();
          split3?.revert();
        });
    }

    tl.fromTo(
      ".hero-hint",
      { y: 0 },
      {
        y: 8,
        repeat: -1,
        yoyo: true,
        duration: 1.0,
        ease: "sine.inOut",
      },
      isMobile ? 0.5 : "+0.2",
    );

    return tl;
  };

  return (
    <div className="app-container" ref={containerRef}>
      <Seo />
      <canvas className="webgl-canvas" ref={canvasRef} />
      <canvas className="trail-canvas" ref={trailCanvasRef} />

      {/* ── IntroLog: mounts immediately, acts as loading screen + intro ── */}
      {/* Deep link (view !== hero): log acts as loading gate only — no line
          cycling, and the scene snaps to the zoomed-in state instead of
          playing the hero intro motion */}
      {showIntro && (
        <IntroLog
          loadProgress={loadProgress}
          isLoaded={isLoaded}
          instant={view !== "hero"}
          onComplete={() => {
            setShowIntro(false);
            // Prefetch Works & About chunks in the background after intro
            // so they're ready before the user clicks a nav button
            import("./components/Works");
            import("./components/About");
            if (view === "hero") {
              heroIntroMotion();
            } else {
              applyViewInstant(view === "about" ? "about" : "works");
              gsap.set(".webgl-canvas", { filter: "brightness(1)" });
              gsap.fromTo(
                heroContentRef.current,
                { opacity: 0 },
                { opacity: 1, duration: 0.5, ease: "linear" },
              );
            }
          }}
        />
      )}

      <div
        className="content"
        ref={heroContentRef}
        style={{
          opacity: showIntro ? 0 : 1,
          pointerEvents: showIntro ? "none" : "auto",
        }}
      >
        <header className="header">
          <div className="header-left" onClick={goHero}>
            <div className="title">ImChaewon</div>
            <div
              className={`header-sub-flip${view !== "hero" ? " is-sub" : ""}`}
              aria-label={view !== "hero" ? "go main" : "Archive v1.0"}
            >
              <span className="header-sub-flip__front">Archive v1.0</span>
              <span className="header-sub-flip__back">← back</span>
            </div>
          </div>

          <div className="header-right">
            <span className="menu-lang-label">&gt; LAN</span>
            <div className="menu-lang">
              <button
                className={lang === "ko" ? "btn-lang on" : "btn-lang"}
                onClick={() => switchLang("ko")}
              >
                KO
              </button>
              <span className="divider"></span>
              <button
                className={lang === "en" ? "btn-lang on" : "btn-lang"}
                onClick={() => switchLang("en")}
              >
                EN
              </button>
            </div>
          </div>
        </header>

        <section className={`hero${view !== "hero" ? " hidden" : ""}`}>
          <div className="hero-main-text">
            <div className="hero-main-text__title">
              <span className="title-mask">
                <span className="title-word">INTERACTIVE</span>
              </span>
              <br />
              <span className="title-mask">
                <span className="title-word">WEB_FRONTEND</span>
              </span>
              <br />
              <span className="title-mask">
                <span className="title-word">DEVELOPER</span>
              </span>
            </div>
            <div className="hero-sub-text">
              <p className="hero-sub-text__desc">
                <span className="desc-wrap">
                  <span className="desc-prompt">&gt;</span>
                  <span className="desc-text desc-text-1">
                    designing interactive web experiences
                  </span>
                </span>
                <span className="desc-wrap">
                  <span className="desc-prompt">&gt;</span>
                  <span className="desc-text desc-text-2">
                    focusing on structure and motion
                  </span>
                </span>
                <span className="desc-wrap">
                  <span className="desc-prompt">&gt;</span>
                  <span className="desc-text desc-text-3">
                    optimizing workflows and systems
                  </span>
                </span>
                {isMobile && (
                  <>
                    <span className="desc-separator">. . .</span>
                    <span className="desc-wrap desc-wrap-location">
                      <span className="desc-prompt">&gt;</span>
                      <span className="desc-text desc-location">
                        based in South_korea/Australia
                      </span>
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          {!isMobile && (
            <div className="hero-hud-data hero-hud-data__location">
              <div className="title title-mask">
                <span className="title-word">Based_in</span>
              </div>
              <div className="desc title-mask">
                <span className="title-word">
                  South Korea | Australia | Worldwide
                  <span className="emoji">🌏</span>
                </span>
              </div>
            </div>
          )}

          <div className="hero-hud-data hero-hud-data__monitor">
            <div className="hero-panel">
              <div className="hero-panel__header">
                <span className="hero-panel__label">◼ SYS.MONITOR</span>
                <span className="hero-panel__id">// 01</span>
              </div>
              <div className="hero-panel__body">
                <div className="hero-panel__row">
                  <span className="hero-panel__key">TIME</span>
                  <span className="hero-panel__val">{currentTime}</span>
                </div>
                <div className="hero-panel__row">
                  <span className="hero-panel__key">DATE</span>
                  <span className="hero-panel__val">{currentDate}</span>
                </div>
                <div className="hero-panel__row">
                  <span className="hero-panel__key">ZONE</span>
                  <span className="hero-panel__val">
                    {_tzShort} — {_utcLabel}
                  </span>
                </div>
                <div className="hero-panel__row">
                  <span className="hero-panel__key">GEO</span>
                  <span className="hero-panel__val">{locationStr}</span>
                </div>
              </div>
              <div className="hero-panel__footer">
                <span className="hero-panel__dot" />
                <span className="hero-panel__status">ONLINE</span>
              </div>
            </div>
          </div>

          <div className="hero-hint">
            <span className="hero-hint__mouse">
              <svg
                className="hero-hint__hand"
                xmlns="http://www.w3.org/2000/svg"
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="rgba(255,255,255,0.8)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
                <path d="m13 13 6 6" />
              </svg>
            </span>
            <span className="hero-hint__label">
              TOUCH STARS
              <br />
              TO EXPLORE
            </span>
          </div>

          <div className="hero-actions">
            <button
              ref={buttonWorksRef}
              className="btn-hud btn-hud--works"
              onClick={goWorks}
            >
              <span className="btn-text">
                {!isMobile && ">"} <span className="btn-text__text">works</span>
                <span className="btn-text__cursor"></span>
              </span>
            </button>
            <button
              ref={buttonAboutRef}
              className="btn-hud btn-hud--about"
              onClick={goAbout}
            >
              <span className="btn-text">
                {!isMobile && ">"} <span className="btn-text__text">about</span>
                <span className="btn-text__cursor"></span>
              </span>
            </button>
          </div>
        </section>

        {/* Works — lazy-loaded on first visit, kept mounted after */}
        {hasShownWorks && (
          <Suspense fallback={null}>
            <section
              className={`page-sub works${view === "works" ? " visible" : ""}`}
            >
              <Works isActive={view === "works"} />
            </section>
          </Suspense>
        )}

        {/* About — lazy-loaded on first visit, kept mounted after */}
        {hasShownAbout && (
          <Suspense fallback={null}>
            <section
              className={`page-sub about${view === "about" ? " visible" : ""}`}
            >
              <About isActive={view === "about"} />
            </section>
          </Suspense>
        )}
      </div>

      {/* Child routes render nothing visible; the catch-all redirect lives here */}
      <Outlet />
    </div>
  );
}

export default App;
