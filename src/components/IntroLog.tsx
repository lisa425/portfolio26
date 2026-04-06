import { useEffect, useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import "./IntroLog.scss";

const LINES = [
  "// INITIALIZING PARTICLE SYSTEM...",
  "// LOADING CORE MODULES...",
  "// DISTRIBUTING PARTICLE FIELD...",
  "// APPLYING FORCE SIMULATION...",
  "// CALCULATING MOTION VECTORS...",
  "// STABILIZING SYSTEM STATE...",
  "// FORMING INTERACTIVE STRUCTURES...",
  "// APPLYING MOTION AND GRAVITY...",
  "// SYNCHRONIZING USER INPUT...",
  "// READY TO EXPLORE",
];

// Must match .intro-log__line height in SCSS
const LINE_H = 22; // px
const ACTIVE_ROW = 2; // 0-indexed: row 3 = center of 5-row viewport

interface IntroLogProps {
  onComplete: () => void;
  loadProgress: number; // 0-100, shown as counter on first line
  isLoaded: boolean; // when true → start cycling after 0.5s
}

export default function IntroLog({
  onComplete,
  loadProgress,
  isLoaded,
}: IntroLogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const doneRef = useRef(false);
  const [visible, setVisible] = useState(true);
  const [cursorIndex, setCursorIndex] = useState(0); // first line shows cursor

  const finish = (instant = false) => {
    if (doneRef.current) return;
    doneRef.current = true;
    tlRef.current?.kill();

    if (instant) {
      setVisible(false);
      onComplete();
      return;
    }

    gsap.to(overlayRef.current, {
      opacity: 0,
      duration: 0.5,
      ease: "power2.in",
      onComplete: () => {
        setVisible(false);
        onComplete();
      },
    });
  };

  // ── Before first paint: track position + initial line states ──
  useLayoutEffect(() => {
    const track = trackRef.current;
    const viewport = viewportRef.current;
    const els = lineRefs.current;
    if (!track || !viewport) return;

    gsap.set(viewport, { opacity: 0 });
    gsap.set(track, { y: ACTIVE_ROW * LINE_H });
    gsap.set(els, {
      backgroundColor: "transparent",
      color: "rgba(255,255,255,0.25)",
    });
    // First line immediately highlighted
    gsap.set(els[0], {
      backgroundColor: "rgba(255,255,255,0.92)",
      color: "#0a0a0a",
    });
  }, []);

  // ── On mount: fade in the text viewport ──
  useEffect(() => {
    if (!visible) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    gsap.to(viewport, { opacity: 1, duration: 0.3, ease: "power2.out" });
  }, [visible]);

  // ── Start cycling once loading completes ──
  // `isLoaded` flips after WebGL + fonts gate + 500ms hold (see App `handleProgress`)
  useEffect(() => {
    if (!isLoaded || !visible || doneRef.current) return;

    const track = trackRef.current;
    if (!track) return;

    const els = lineRefs.current;

    const HOLD = 0.1; // hold per line (middle lines)
    const TRANS = 0.05; // scroll duration
    const SNAP = 0.06; // near-instant color snap
    const CYCLE = HOLD + TRANS;

    // Brief additional pause so (100/100) is visible before cycling
    const tl = gsap.timeline({ delay: 0.3 });
    tlRef.current = tl;

    for (let i = 1; i < LINES.length; i++) {
      const isLast = i === LINES.length - 1;
      const cur = els[i];
      const prev = els[i - 1];
      if (!cur || !prev) continue;

      const t = (i - 1) * CYCLE + HOLD;

      // Remove cursor from first line when cycling begins
      if (i === 1) {
        tl.call(() => setCursorIndex(-1), [], t);
      }

      // Track scrolls up
      tl.to(
        track,
        { y: (ACTIVE_ROW - i) * LINE_H, duration: TRANS, ease: "none" },
        t,
      );

      // Deactivate previous line
      tl.to(
        prev,
        {
          backgroundColor: "transparent",
          color: "rgba(255,255,255,0.25)",
          duration: SNAP,
          ease: "none",
        },
        t,
      );

      // Activate current line
      tl.to(
        cur,
        {
          backgroundColor: "rgba(255,255,255,0.92)",
          color: "#0a0a0a",
          duration: SNAP,
          ease: "none",
        },
        t,
      );

      if (isLast) {
        tl.call(() => setCursorIndex(LINES.length - 1), [], t + TRANS);
        tl.call(
          () => {
            setTimeout(() => finish(), 600);
          },
          [],
          t + TRANS + HOLD,
        );
      }
    }

    return () => {
      tlRef.current?.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  if (!visible) return null;

  return (
    <div className="intro-log" ref={overlayRef}>
      <div className="intro-log__scanlines" />

      <div className="intro-log__viewport" ref={viewportRef}>
        <div className="intro-log__track" ref={trackRef}>
          {LINES.map((text, i) => (
            <div
              key={i}
              className="intro-log__line"
              ref={(el) => {
                lineRefs.current[i] = el;
              }}
            >
              <span className="intro-log__line-text">
                {text}
                {/* Live progress counter only on the first line */}
                {i === 0 && (
                  <span className="intro-log__progress">
                    {" "}
                    ({Math.round(loadProgress)}/100)
                  </span>
                )}
              </span>
              {cursorIndex === i && <span className="intro-log__cursor" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
