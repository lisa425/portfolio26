import { useEffect, useRef, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { useMobile } from '../hooks/useMobile'
import { renderText } from '../utils/renderText'

gsap.registerPlugin(ScrollTrigger)

interface InfoProps {
  isActive?: boolean
}

// 지그재그 배치: 중앙 정렬된 컨테이너(.info-content-scroll) 안에서
// side에 따라 왼쪽/오른쪽 가장자리에 정렬 — 창 너비가 줄어도 지그재그가
// 중앙 기준으로 유지되고 양옆 여백만 줄어든다 (SCSS .info-section--left/right)
const SECTIONS = [
  { id: 'profile', label: 'Profile', side: 'left' },
  { id: 'experience', label: 'Career', side: 'right' },
  { id: 'skills', label: 'Skills', side: 'left' },
  { id: 'education', label: 'Education', side: 'right' },
  { id: 'contact', label: 'Contact', side: 'left' },
] as const

function Info({ isActive }: InfoProps) {
  const { t, i18n } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const lenisRef = useRef<Lenis | null>(null)
  const [activeSection, setActiveSection] = useState('profile')
  const { isMobileDevice } = useMobile()
  const navRefs = useRef<(HTMLSpanElement | null)[]>([])
  const nodeRefs = useRef<(HTMLDivElement | null)[]>([])
  const svgRef = useRef<SVGSVGElement>(null)
  const lineRefs = useRef<(SVGLineElement | null)[]>([])

  const contact = t('info.contact', { returnObjects: true }) as any
  const workExperience = t('info.workExperience', {
    returnObjects: true,
  }) as any
  const skills = t('info.skills', { returnObjects: true }) as any
  const education = t('info.education', { returnObjects: true }) as any

  useEffect(() => {
    if (isActive && lenisRef.current) {
      lenisRef.current.scrollTo(0, { immediate: true })
      setActiveSection('profile')
    }
  }, [isActive])

  // Calculate SVG line positions between consecutive nodes
  const updateLines = useCallback(() => {
    if (!contentRef.current || !svgRef.current) return

    const contentRect = contentRef.current.getBoundingClientRect()

    nodeRefs.current.forEach((node, i) => {
      if (i === 0 || !node) return
      const prevNode = nodeRefs.current[i - 1]
      if (!prevNode) return

      const line = lineRefs.current[i - 1]
      if (!line) return

      const r1 = prevNode.getBoundingClientRect()
      const r2 = node.getBoundingClientRect()

      const x1 = r1.left + r1.width / 2 - contentRect.left
      const y1 = r1.top + r1.height / 2 - contentRect.top
      const x2 = r2.left + r2.width / 2 - contentRect.left
      const y2 = r2.top + r2.height / 2 - contentRect.top

      line.setAttribute('x1', String(x1))
      line.setAttribute('y1', String(y1))
      line.setAttribute('x2', String(x2))
      line.setAttribute('y2', String(y2))

      const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
      line.style.strokeDasharray = `${length}`
      line.style.strokeDashoffset = `${length}`
    })

    svgRef.current.setAttribute('height', `${contentRef.current.scrollHeight}`)
  }, [])

  // Initialize Lenis
  useEffect(() => {
    if (!containerRef.current || !contentRef.current) return

    const lenis = new Lenis({
      wrapper: containerRef.current,
      content: contentRef.current,
      lerp: 0.08,
      wheelMultiplier: 1.2,
    })
    lenisRef.current = lenis

    lenis.on('scroll', ScrollTrigger.update)
    const rafCb = (time: number) => {
      lenis.raf(time * 1000)
    }
    gsap.ticker.add(rafCb)
    gsap.ticker.lagSmoothing(0)

    return () => {
      lenis.destroy()
      gsap.ticker.remove(rafCb)
    }
  }, [])

  // ScrollTrigger setup: section tracking + reveal animations + line drawing
  useEffect(() => {
    const ctx = gsap.context(() => {
      const timer = setTimeout(() => {
        updateLines()

        // Section tracking
        SECTIONS.forEach((section) => {
          ScrollTrigger.create({
            trigger: `#${section.id}`,
            scroller: containerRef.current,
            start: isMobileDevice ? 'top 60%' : 'top 70%',
            end: isMobileDevice ? 'bottom 60%' : 'bottom 30%',
            onEnter: () => setActiveSection(section.id),
            onEnterBack: () => setActiveSection(section.id),
          })
        })

        // ─── Entry / Reveal Animations ───
        if (!isMobileDevice) {
          // PC: Standard ScrollTrigger reveal animations
          const revealElements = gsap.utils.toArray('.info-section__body')
          revealElements.forEach((el: any) => {
            gsap.fromTo(
              el,
              { opacity: 0, y: 50 },
              {
                opacity: 1,
                y: 0,
                duration: 1.2,
                ease: 'power3.out',
                scrollTrigger: {
                  trigger: el,
                  scroller: containerRef.current,
                  start: 'top 70%',
                  end: 'bottom 70%',
                  toggleActions: 'play none none reverse',
                },
              },
            )
          })

          // Node points reveal
          gsap.utils.toArray('.info-node').forEach((el: any) => {
            gsap.fromTo(
              el,
              { scale: 0, opacity: 0 },
              {
                scale: 1,
                opacity: 1,
                duration: 0.6,
                ease: 'back.out(2)',
                scrollTrigger: {
                  trigger: el,
                  scroller: containerRef.current,
                  start: 'top 70%',
                  end: 'bottom 70%',
                  toggleActions: 'play none none reverse',
                },
              },
            )
          })

          // Line drawing animation:
          // - 시작: 다음 섹션이 뷰포트 하단에 들어오는 순간 (최상단에서 이미
          //   들어와 있으면 8px 스크롤 지점으로 클램프 → 스크롤 0에서는 항상 길이 0)
          // - 도달: 다음 섹션 박스 리빌(top 70% 트리거)이 끝나는 top 55% 지점
          // - scrub: true(지연 없음) + fromTo/invalidateOnRefresh로
          //   리사이즈·언어 변경 후에도 스크롤 위치와 정확히 동기화 (잔상 방지)
          lineRefs.current.forEach((line, i) => {
            if (!line) return
            const targetSection = document.getElementById(SECTIONS[i + 1]?.id)
            const scroller = containerRef.current
            if (!targetSection || !scroller) return

            const sectionTopInContent = () => {
              const sRect = scroller.getBoundingClientRect()
              const tRect = targetSection.getBoundingClientRect()
              return tRect.top - sRect.top + scroller.scrollTop
            }

            gsap.fromTo(
              line,
              {
                strokeDashoffset: () =>
                  parseFloat(line.style.strokeDasharray || '0') || 0,
              },
              {
                strokeDashoffset: 0,
                ease: 'none',
                scrollTrigger: {
                  trigger: targetSection,
                  scroller,
                  start: () =>
                    Math.max(sectionTopInContent() - scroller.clientHeight, 8),
                  end: () =>
                    sectionTopInContent() - scroller.clientHeight * 0.55,
                  scrub: true,
                  invalidateOnRefresh: true,
                },
              },
            )
          })
        }

        ScrollTrigger.refresh()
      }, 500)

      return () => clearTimeout(timer)
    }, containerRef)

    return () => ctx.revert()
  }, [updateLines, isMobileDevice])

  // Recalculate line positions on resize or language change
  useEffect(() => {
    const onResize = () => {
      requestAnimationFrame(() => {
        updateLines()
        ScrollTrigger.refresh()
      })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [updateLines])

  useEffect(() => {
    const timer = setTimeout(() => {
      updateLines()
      ScrollTrigger.refresh()
    }, 300)
    return () => clearTimeout(timer)
  }, [i18n.language, updateLines])

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (element && lenisRef.current) {
      lenisRef.current.scrollTo(element, {
        offset: -window.innerHeight * 0.2,
        duration: 1.2,
      })
    }
  }

  return (
    <>
      {/* Terminal-style progress nav */}
      <nav className={`terminal-bar info-nav ${isMobileDevice ? 'is-mobile-device' : ''}`}>
        <span className="terminal-bar__label">&gt; INFO ───</span>
        <span className="terminal-bar__bar">
          [
          {SECTIONS.map((s) =>
            activeSection === s.id ||
            SECTIONS.findIndex((sec) => sec.id === activeSection) >= SECTIONS.findIndex((sec) => sec.id === s.id)
              ? '█'
              : '░',
          ).join('')}
          ]
        </span>
        <span className="info-nav__sections">
          {SECTIONS.map((section, idx) => (
            <span
              key={section.id}
              ref={(el) => {
                navRefs.current[idx] = el
              }}
              className={`info-nav__item ${activeSection === section.id ? 'active' : ''}`}
              onClick={() => scrollToSection(section.id)}
            >
              {section.label}
            </span>
          ))}
        </span>
      </nav>
      <div
        className={`inner info-inner ${isMobileDevice ? 'is-mobile-device' : ''}`}
        ref={containerRef}
        style={{ overflowY: 'auto', overflowX: 'hidden' }}
      >
        <div
          ref={contentRef}
          style={{ width: '100%', position: 'relative' }}
        >
          {/* SVG Lines overlay */}
          <svg
            ref={svgRef}
            className="info-lines"
            width="100%"
            height="100%"
          >
            {SECTIONS.slice(1).map((_, i) => (
              <line
                key={`line-${i}`}
                ref={(el) => {
                  lineRefs.current[i] = el
                }}
                className="info-line"
              />
            ))}
          </svg>

          {/* Constellation-layout content */}
          <div className="info-content-scroll">
            {/* 1. Profile */}
            <section
              id="profile"
              className={`info-section info-section--${SECTIONS[0].side}`}
            >
              <div
                className="info-node"
                ref={(el) => {
                  nodeRefs.current[0] = el
                }}
              >
                <div className="info-node__point">
                  <span className="bracket">[</span> <span className="mark">+</span> <span className="bracket">]</span>
                </div>
              </div>
              <div className="info-section__body">
                <div className="info-section__header">
                  <span className="info-section__id">◼ 001.PROFILE</span>
                </div>
                <div className="info-section__content">
                  <span className="corner top-left"></span>
                  <span className="corner top-right"></span>
                  <span className="corner bottom-left"></span>
                  <span className="corner bottom-right"></span>
                  <h2 className={`info-name ${i18n.language === 'ko' ? 'text-display' : 'text-body'}`}>
                    {t('info.name')}
                  </h2>
                  <p className="info-role">ROLE | {t('info.role')}</p>
                  <p className="info-about text-body">{renderText(t('info.about'))}</p>
                </div>
              </div>
            </section>

            {/* 2. Experience */}
            <section
              id="experience"
              className={`info-section info-section--${SECTIONS[1].side}`}
            >
              <div
                className="info-node"
                ref={(el) => {
                  nodeRefs.current[1] = el
                }}
              >
                <div className="info-node__point">
                  <span className="bracket">[</span> <span className="mark">+</span> <span className="bracket">]</span>
                </div>
              </div>
              <div className="info-section__body">
                <div className="info-section__header">
                  <span className="info-section__id">◼ 002.CAREER</span>
                </div>
                <div className="info-section__content">
                  <span className="corner top-left"></span>
                  <span className="corner top-right"></span>
                  <span className="corner bottom-left"></span>
                  <span className="corner bottom-right"></span>
                  {workExperience.jobs.map((job: any, jIdx: number) => (
                    <div
                      key={jIdx}
                      className="job-entry"
                    >
                      <div className="job-entry__header">
                        <h4 className="text-display">{job.company}</h4>
                        <p className={`job-entry__meta ${i18n.language === 'ko' && 'text-body'}`}>
                          {job.role} &nbsp;|&nbsp; {job.period} &nbsp;
                        </p>
                      </div>
                      <div className="job-entry__projects">
                        {job.projects.map((proj: any, pIdx: number) => (
                          <div
                            key={pIdx}
                            className="project-entry text-body"
                          >
                            <h5 className="text-display">{proj.name}</h5>
                            <ul>
                              {proj.bullets.map((bullet: string, bIdx: number) => (
                                <li key={bIdx}>{renderText(bullet)}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* 3. Skills */}
            <section
              id="skills"
              className={`info-section info-section--${SECTIONS[2].side}`}
            >
              <div
                className="info-node"
                ref={(el) => {
                  nodeRefs.current[2] = el
                }}
              >
                <div className="info-node__point">
                  <span className="bracket">[</span> <span className="mark">+</span> <span className="bracket">]</span>
                </div>
              </div>
              <div className="info-section__body">
                <div className="info-section__header">
                  <span className="info-section__id">◼ 003.SKILLS</span>
                </div>
                <div className="info-section__content">
                  <span className="corner top-left"></span>
                  <span className="corner top-right"></span>
                  <span className="corner bottom-left"></span>
                  <span className="corner bottom-right"></span>
                  <div className="skills-list">
                    {skills.categories.map((cat: any, cIdx: number) => (
                      <div
                        key={cIdx}
                        className="skill-category"
                      >
                        <strong>{cat.name}</strong>
                        {cat.items.map((item: any) => (
                          <span className="text-body">▪︎ {item}</span>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* 4. Education */}
            <section
              id="education"
              className={`info-section info-section--${SECTIONS[3].side}`}
            >
              <div
                className="info-node"
                ref={(el) => {
                  nodeRefs.current[3] = el
                }}
              >
                <div className="info-node__point">
                  <span className="bracket">[</span> <span className="mark">+</span> <span className="bracket">]</span>
                </div>
              </div>
              <div className="info-section__body">
                <div className="info-section__header">
                  <span className="info-section__id">◼ 004.EDUCATION</span>
                </div>
                <div className="info-section__content">
                  <span className="corner top-left"></span>
                  <span className="corner top-right"></span>
                  <span className="corner bottom-left"></span>
                  <span className="corner bottom-right"></span>
                  <div className="education-entry">
                    <h4 className="text-display">{education.school}</h4>
                    <p className="education-entry__meta">{education.period}</p>
                    <ul>
                      {education.bullets.map((bullet: string, eIdx: number) => (
                        <li
                          key={eIdx}
                          className="text-body"
                        >
                          - {renderText(bullet)}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </section>

            {/* 5. Contact */}
            <section
              id="contact"
              className={`info-section info-section--${SECTIONS[4].side}`}
            >
              <div
                className="info-node"
                ref={(el) => {
                  nodeRefs.current[4] = el
                }}
              >
                <div className="info-node__point">
                  <span className="bracket">[</span> <span className="mark">+</span> <span className="bracket">]</span>
                </div>
              </div>
              <div className="info-section__body">
                <div className="info-section__header">
                  <span className="info-section__id">◼ 005.CONTACT</span>
                </div>
                <div className="info-section__content">
                  <span className="corner top-left"></span>
                  <span className="corner top-right"></span>
                  <span className="corner bottom-left"></span>
                  <span className="corner bottom-right"></span>
                  <div className="info-contact">
                    <p className="btn-contact">
                      Email
                      <a
                        className="meta text-body"
                        href={`mailto:${contact.email}`}
                      >
                        {contact.email}
                      </a>
                    </p>
                    <p className="btn-contact">
                      Phone
                      <a
                        className="meta text-body"
                        href={`tel:${contact.phone.replace(/\s/g, '')}`}
                      >
                        {contact.phone}
                      </a>
                    </p>
                    <p className="btn-contact">
                      LinkedIn
                      <a
                        className="meta text-body"
                        href={contact.LinkedIn}
                        target="_blank"
                      >
                        {contact.LinkedIn}
                      </a>
                    </p>
                    <p className="btn-contact">
                      Blog
                      <a
                        className="meta text-body"
                        href={contact.Blog}
                        target="_blank"
                      >
                        {contact.Blog}
                      </a>
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="info-section__footer">© 2026 ChaeWon Im. All rights reserved.</section>
          </div>
        </div>
      </div>
    </>
  )
}

export default Info
