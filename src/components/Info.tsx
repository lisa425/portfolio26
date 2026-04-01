import { useEffect, useRef, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import BtnBack from './BtnBack'

gsap.registerPlugin(ScrollTrigger)

interface InfoProps {
  onBack: () => void
  isActive?: boolean
}

const SECTIONS = [
  { id: 'profile', label: 'Profile', offsetX: 18 },
  { id: 'experience', label: 'Experience', offsetX: 48 },
  { id: 'skills', label: 'Skills', offsetX: 23 },
  { id: 'education', label: 'Education', offsetX: 55 },
  { id: 'contact', label: 'Contact', offsetX: 38 },
]

function Info({ onBack, isActive }: InfoProps) {
  const { t, i18n } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const lenisRef = useRef<Lenis | null>(null)
  const [activeSection, setActiveSection] = useState('profile')
  const navRefs = useRef<(HTMLSpanElement | null)[]>([])
  const nodeRefs = useRef<(HTMLDivElement | null)[]>([])
  const svgRef = useRef<SVGSVGElement>(null)
  const lineRefs = useRef<(SVGLineElement | null)[]>([])

  const contact = t('info.contact', { returnObjects: true }) as any
  const workExperience = t('info.workExperience', { returnObjects: true }) as any
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
            start: 'top 60%',
            end: 'bottom 40%',
            onToggle: (self) => {
              if (self.isActive) setActiveSection(section.id)
            },
          })
        })

        // Reveal animations
        const revealElements = gsap.utils.toArray('.info-name, .info-role, .info-about, .info-block-title, .info-in')
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
                start: 'top 90%',
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
                start: 'top 85%',
                toggleActions: 'play none none reverse',
              },
            },
          )
        })

        // Line drawing animation (each line draws as its target section scrolls in)
        lineRefs.current.forEach((line, i) => {
          if (!line) return
          const targetSection = document.getElementById(SECTIONS[i + 1]?.id)
          if (!targetSection) return

          gsap.to(line, {
            strokeDashoffset: 0,
            ease: 'none',
            scrollTrigger: {
              trigger: targetSection,
              scroller: containerRef.current,
              start: 'top 90%',
              end: 'top 50%',
              scrub: 1,
            },
          })
        })

        ScrollTrigger.refresh()
      }, 500)

      return () => clearTimeout(timer)
    }, containerRef)

    return () => ctx.revert()
  }, [updateLines])

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

  // Nav active highlight (instant switch)
  useEffect(() => {
    const activeIndex = SECTIONS.findIndex((s) => s.id === activeSection)
    navRefs.current.forEach((nav, idx) => {
      if (!nav) return
      nav.style.opacity = idx === activeIndex ? '1' : '0.35'
    })
  }, [activeSection])

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (element && lenisRef.current) {
      lenisRef.current.scrollTo(element, { offset: -window.innerHeight * 0.2, duration: 1.2 })
    }
  }

  return (
    <>
      {/* Terminal-style progress nav */}
      <nav className="terminal-bar info-nav">
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
        className="inner info-inner"
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
              className="info-section"
              style={{ marginLeft: `${SECTIONS[0].offsetX}%` }}
            >
              <div
                className="info-node"
                ref={(el) => {
                  nodeRefs.current[0] = el
                }}
              >
                <div className="info-node__point" />
              </div>
              <div className="info-section__body">
                <h2 className="info-name">{t('info.name')}</h2>
                <p className="info-role">{t('info.role')}</p>
                <p className="info-about text-body">{t('info.about')}</p>
              </div>
            </section>

            {/* 2. Experience */}
            <section
              id="experience"
              className="info-section"
              style={{ marginLeft: `${SECTIONS[1].offsetX}%` }}
            >
              <div
                className="info-node"
                ref={(el) => {
                  nodeRefs.current[1] = el
                }}
              >
                <div className="info-node__point" />
              </div>
              <div className="info-section__body">
                <h3 className="info-block-title">{workExperience.title}</h3>
                {workExperience.jobs.map((job: any, jIdx: number) => (
                  <div
                    key={jIdx}
                    className="job-entry info-in"
                  >
                    <div className="job-entry__header">
                      <h4>{job.company}</h4>
                      <p className="job-entry__meta">
                        {job.role} &nbsp;|&nbsp; {job.period} &nbsp;|&nbsp; {job.location}
                      </p>
                    </div>
                    {job.projects.map((proj: any, pIdx: number) => (
                      <div
                        key={pIdx}
                        className="project-entry text-body"
                      >
                        <h5>■ {proj.name}</h5>
                        <ul>
                          {proj.bullets.map((bullet: string, bIdx: number) => (
                            <li key={bIdx}>{bullet}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </section>

            {/* 3. Skills */}
            <section
              id="skills"
              className="info-section"
              style={{ marginLeft: `${SECTIONS[2].offsetX}%` }}
            >
              <div
                className="info-node"
                ref={(el) => {
                  nodeRefs.current[2] = el
                }}
              >
                <div className="info-node__point" />
              </div>
              <div className="info-section__body">
                <h3 className="info-block-title">{skills.title}</h3>
                <div className="skills-list info-in">
                  {skills.categories.map((cat: any, cIdx: number) => (
                    <div
                      key={cIdx}
                      className="skill-category"
                    >
                      <strong>■ {cat.name}</strong>
                      <span className="text-body">{cat.items}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* 4. Education */}
            <section
              id="education"
              className="info-section"
              style={{ marginLeft: `${SECTIONS[3].offsetX}%` }}
            >
              <div
                className="info-node"
                ref={(el) => {
                  nodeRefs.current[3] = el
                }}
              >
                <div className="info-node__point" />
              </div>
              <div className="info-section__body">
                <h3 className="info-block-title">{education.title}</h3>
                <div className="education-entry info-in">
                  <h4>{education.school}</h4>
                  <p className="education-entry__meta text-body">{education.period}</p>
                  <ul>
                    {education.bullets.map((bullet: string, eIdx: number) => (
                      <li
                        key={eIdx}
                        className="text-body"
                      >
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>

            {/* 5. Contact */}
            <section
              id="contact"
              className="info-section"
              style={{ marginLeft: `${SECTIONS[4].offsetX}%` }}
            >
              <div
                className="info-node"
                ref={(el) => {
                  nodeRefs.current[4] = el
                }}
              >
                <div className="info-node__point" />
              </div>
              <div className="info-section__body">
                <h3 className="info-block-title">Get in touch</h3>
                <div className="info-contact info-in">
                  <p className="btn-contact text-body">📧&nbsp;&nbsp;{contact.email}</p>
                  <p className="btn-contact text-body">📞&nbsp;&nbsp;{contact.phone}</p>
                </div>
              </div>
            </section>

            {/* <div className="info-section__footer">
              <p className="text-body">
                <span className="text-body">© 2026 CHAEWON IM. All rights reserved.</span>
              </p>
            </div> */}
          </div>
        </div>
      </div>
    </>
  )
}

export default Info
