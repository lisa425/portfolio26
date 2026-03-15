import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import gsap from "gsap";
import type { LangType } from "./types";
import "./App.scss";
import { useHeroScene } from "./hooks/useHeroScene";

function App() {
  const { i18n } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLHeadingElement>(null);
  const buttonWorksRef = useRef<HTMLButtonElement>(null);
  const buttonInfoRef = useRef<HTMLButtonElement>(null);
  const focusRef = useRef<HTMLSpanElement>(null);

  const [language, setLanguage] = useState(i18n.language);

  const changeLanguage = (lang: LangType) => {
    i18n.changeLanguage(lang);
    setLanguage(lang);
  };

  // Three.js Scene
  useHeroScene(canvasRef, containerRef, buttonWorksRef, buttonInfoRef);

  // GSAP Animation
  useEffect(() => {
    if (textRef.current) {
      gsap.fromTo(
        textRef.current,
        { opacity: 0, y: 50 },
        { opacity: 1, y: 0, duration: 1.5, ease: "power3.out" },
      );
    }
  }, [language]);

  // .focus 요소가 마우스를 따라다니도록 (rAF로 최적화)
  const mousePos = useRef({ x: 0, y: 0 });
  const rafId = useRef<number>(0);
  const isRafScheduled = useRef(false);

  const updateFocusPosition = useCallback(() => {
    if (focusRef.current) {
      focusRef.current.style.transform = `translate(${mousePos.current.x}px, ${mousePos.current.y}px)`;
    }
    isRafScheduled.current = false;
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mousePos.current.x = e.clientX;
      mousePos.current.y = e.clientY;

      if (!isRafScheduled.current) {
        isRafScheduled.current = true;
        rafId.current = requestAnimationFrame(updateFocusPosition);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);

    // 인터랙티브 요소(button, a 등 cursor:pointer) 호버 시 .focus 숨기기
    const isInteractive = (el: EventTarget | null): boolean => {
      if (!el || !(el instanceof HTMLElement)) return false;
      let node: HTMLElement | null = el;
      while (node && node !== document.body) {
        const tag = node.tagName;
        if (tag === "BUTTON" || tag === "A" || node.getAttribute("role") === "button") return true;
        if (window.getComputedStyle(node).cursor === "pointer") return true;
        node = node.parentElement;
      }
      return false;
    };

    const handleMouseOver = (e: MouseEvent) => {
      if (focusRef.current && isInteractive(e.target)) {
        focusRef.current.className = "focus off";
      }
    };
    const handleMouseOut = (e: MouseEvent) => {
      if (focusRef.current && isInteractive(e.target)) {
        focusRef.current.className = "focus on";
      }
    };

    document.addEventListener("mouseover", handleMouseOver);
    document.addEventListener("mouseout", handleMouseOut);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(rafId.current);
      document.removeEventListener("mouseover", handleMouseOver);
      document.removeEventListener("mouseout", handleMouseOut);
    };
  }, [updateFocusPosition]);

  return (
    <div className="app-container" ref={containerRef}>
      <canvas className="webgl-canvas" ref={canvasRef} />

      <span className="focus" ref={focusRef}></span>
      
      <div className="content">
        <header className="header">
          <div className="logo">Chaewon Im</div>
          {/* <div className="menu-nav">
            <button className="btn-nav">WORKS</button>
            <span className="divider"></span>
            <button className="btn-nav">INFO</button>
          </div> */}
          <div className="logo">Singularity:The Center of Creation</div>
          <div className="menu-lang">
            <button
              className={language === "ko" ? "btn-lang on" : "btn-lang"}
              onClick={() => changeLanguage("ko")}
            >
              KO
            </button>
            <span className="divider"></span>
            <button
              className={language === "en" ? "btn-lang on" : "btn-lang"}
              onClick={() => changeLanguage("en")}
            >
              EN
            </button>
          </div>
        </header>

        <section className="hero">
          <div className="keyword-container"> 
            <p className="keyword kw-1">Interactive Web Experiences</p>
            <p className="keyword kw-2">Frontend Engineering</p>
            <p className="keyword kw-3">UX/UI Collaboration</p>
          </div>
          <button ref={buttonWorksRef} className="btn-star btn-go-works">
            <span className="text">View Works</span>
          </button>
          <button ref={buttonInfoRef} className="btn-star btn-go-info">
            <span className="text">View Info</span>
          </button>
        </section>

        <section className="works"></section>
      </div>
    </div>
  );
}

export default App;
