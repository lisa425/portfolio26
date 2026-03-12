import { useEffect, useRef, useState } from "react";
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
  const buttonRef = useRef<HTMLButtonElement>(null);

  const [language, setLanguage] = useState(i18n.language);

  const changeLanguage = (lang: LangType) => {
    i18n.changeLanguage(lang);
    setLanguage(lang);
  };

  // Three.js Scene
  useHeroScene(canvasRef, containerRef, buttonRef);

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

  return (
    <div className="app-container" ref={containerRef}>
      <canvas className="webgl-canvas" ref={canvasRef} />

      <div className="content">
        <header className="header">
          <div className="logo">SINGULARITY</div>
          <div className="menu-nav">
            <button className="btn-nav">WORKS</button>
            <span className="divider"></span>
            <button className="btn-nav">INFO</button>
          </div>
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
          <div ref={textRef} className="title">
            <h1>Singularity</h1>
            <h3>:The Center of Creation</h3>
          </div>
          <ul className="sub">
            <li>Interactive Web Experiences</li>
            <li>Frontend Engineering</li>
            <li>UX/UI Collaboration</li>
          </ul>
          <button ref={buttonRef} className="btn-go-works">
            <span className="focus"></span>
            <span className="text">View Works</span>
          </button>
        </section>

        <section className="works"></section>
      </div>
    </div>
  );
}

export default App;
