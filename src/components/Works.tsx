import { useState, useEffect } from "react";
import gsap from "gsap";
import { createPortal } from "react-dom";
import BtnBack from "./BtnBack";
import starImg from "../assets/starcore.png";
import azurThumb from "../assets/meta_azur.jpg";
import baramThumb from "../assets/meta_baram.jpg";
import baThumb from "../assets/meta_ba.jpg";
import mmThumb from "../assets/meta_mm.jpg";

interface WorksProps {
  onBack: () => void;
  isActive: boolean;
}

type WorkType = {
  id: number;
  game: string;
  title: string;
  date: string;
  description: string;
  stack: string;
  img: string;
};

const dummyWorks: WorkType[] = [
  {
    id: 1,
    game: "Azure Promilia",
    title: "Official Website",
    date: "2025.11 - 2025.12",
    description:
      "Official promotional website for the game 'Azure Promilia'. Implemented rich interactions and 3D scenes to provide an immersive user experience.",
    stack: "Next.js · Three.js · GSAP",
    img: azurThumb,
  },
  {
    id: 2,
    game: "Baram",
    title: "Anchor Remaster Teaser(3D Promotion)",
    date: "2022.11 - 2022.12",
    description:
      "A visionary project demonstrating advanced web graphics for a cyberpunk themed experience.",
    stack: "JavaScript · Three.js · GSAP",
    img: baramThumb,
  },
  {
    id: 3,
    game: "Blue Archive",
    title: "Code:BOX Roadmap Promotion",
    date: "2025.07",
    description:
      "Interactive portfolio layout utilizing particle systems and custom shaders to visualize a universe.",
    stack: "Vue.js · Nuxt.js",
    img: baThumb,
  },
  {
    id: 4,
    game: "Vindictus",
    title: "New Character ‘Neamhain’ Promotion",
    date: "2025.01",
    description:
      "3D virtual exhibition gallery for digital artists to showcase their artworks in a virtual space.",
    stack: "React · TypeScript",
    img: starImg,
  },
  {
    id: 5,
    game: "Mabinogi Mobile",
    title: "1st Anniversary Update",
    date: "2026.03",
    description:
      "3D virtual exhibition gallery for digital artists to showcase their artworks in a virtual space.",
    stack: "React · TypeScript",
    img: mmThumb,
  },
];

function Works({ onBack, isActive }: WorksProps) {
  const [activeWork, setActiveWork] = useState<WorkType | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (isActive) {
      gsap.fromTo(
        ".work-card",
        { x: 200, opacity: 0 },
        {
          x: 0,
          opacity: 1,
          duration: 1.6,
          stagger: 0.1,
          ease: "back.out(1.7)",
        },
      );
    } else {
      gsap.set(".work-card", { opacity: 0, x: 200 });
    }
  }, [isActive]);

  const handleWorkClick = (work: WorkType) => {
    setActiveWork(work);
    setIsOpen(true);
  };

  const closeDetail = () => {
    setIsOpen(false);
  };

  return (
    <div className="inner works__inner">
      <BtnBack onClick={onBack} />
      <div className="works__list">
        {dummyWorks.map((work, idx) => (
          <div
            key={work.id}
            className={`work-card ${isOpen && activeWork?.id === work.id ? "active" : ""}`}
            onClick={() => handleWorkClick(work)}
          >
            <div className="work-card__index">
              {String(idx + 1).padStart(2, "0")}
            </div>
            <div className="work-card__thumb">
              <img src={work.img} alt="thumbnail" />
              <div className="work-card__label">
                <p className="work-card__title">{work.title}</p>
                <div className="work-card__stack">
                  <span>{work.stack}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {createPortal(
        <div className={`works__detail ${isOpen ? "active" : ""}`}>
          <button className="btn-close-detail" onClick={closeDetail}>
            ✕
          </button>
          {activeWork && (
            <div className="work-detail__content" key={activeWork.id}>
              <div className="work-detail__title">{activeWork.title}</div>
              <div className="work-detail__date">{activeWork.date}</div>
              <div className="work-detail__description">
                {activeWork.description}
              </div>
              <div className="work-detail__stack">{activeWork.stack}</div>
              <div className="work-detail__images">
                {activeWork.img && <img src={activeWork.img} alt="thumbnail" />}
              </div>
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}

export default Works;
