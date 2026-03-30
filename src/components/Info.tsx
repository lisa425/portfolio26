import { useEffect, useRef, useState } from 'react'
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
  { id: 'profile', label: 'Profile' },
  { id: 'experience', label: 'Experience' },
  { id: 'skills', label: 'Skills' },
  { id: 'education', label: 'Education' },
  { id: 'contact', label: 'Contact' },
]

function Info({ onBack, isActive }: InfoProps) {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const lenisRef = useRef<Lenis | null>(null)
  const [activeSection, setActiveSection] = useState('profile')
  const navRefs = useRef<(HTMLLIElement | null)[]>([])

  // Cast returnObjects to their expected types
  const contact = t('info.contact', { returnObjects: true }) as any
  const workExperience = t('info.workExperience', {
    returnObjects: true,
  }) as any
  const skills = t('info.skills', { returnObjects: true }) as any
  const education = t('info.education', { returnObjects: true }) as any

  // Reset scroll position and state when Info section is opened
  useEffect(() => {
    if (isActive && lenisRef.current) {
      lenisRef.current.scrollTo(0, { immediate: true })
      setActiveSection('profile')
    }
  }, [isActive])

  // Initialize Lenis Smooth Scroll
  useEffect(() => {
    if (!containerRef.current || !contentRef.current) return

    const lenis = new Lenis({
      wrapper: containerRef.current,
      content: contentRef.current,
      lerp: 0.08, // Smoothness intensity
      wheelMultiplier: 1.2,
    })

    lenisRef.current = lenis

    lenis.on('scroll', ScrollTrigger.update)

    gsap.ticker.add((time) => {
      lenis.raf(time * 1000)
    })
    gsap.ticker.lagSmoothing(0)

    return () => {
      lenis.destroy()
      gsap.ticker.remove((time) => {
        lenis.raf(time * 1000)
      })
    }
  }, [])

  useEffect(() => {
    const ctx = gsap.context(() => {
      const timer = setTimeout(() => {
        SECTIONS.forEach((section) => {
          ScrollTrigger.create({
            trigger: `#${section.id}`,
            scroller: containerRef.current,
            start: 'top 60%',
            end: 'bottom 40%',
            onToggle: (self) => {
              if (self.isActive) {
                setActiveSection(section.id)
              }
            },
          })
        })

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
                start: 'top 90%', // Trigger slightly before it comes fully into view
                toggleActions: 'play none none reverse', // Reverses animation when scrolling back up
              },
            },
          )
        })

        ScrollTrigger.refresh()
      }, 500)

      return () => clearTimeout(timer)
    }, containerRef)
    return () => ctx.revert()
  }, [])

  // GSAP animation for flipping menu text
  useEffect(() => {
    const activeIndex = SECTIONS.findIndex((s) => s.id === activeSection)

    navRefs.current.forEach((nav, idx) => {
      if (nav) {
        gsap.killTweensOf(nav) // Stop previous overlapping animations

        if (idx === activeIndex) {
          gsap.fromTo(
            nav,
            { rotationX: 0 },
            {
              rotationX: 360,
              opacity: 1,
              duration: 0.8,
              ease: 'power2.out',
            },
          )
        } else {
          gsap.to(nav, {
            rotationX: 0,
            opacity: 0.5,
            duration: 0.3,
          })
        }
      }
    })
  }, [activeSection])

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (element && lenisRef.current) {
      // Use Lenis smooth scrollTo
      lenisRef.current.scrollTo(element, {
        offset: -window.innerHeight * 0.2,
        duration: 1.2,
      })
    }
  }

  return (
    <div
      className="inner info-inner"
      ref={containerRef}
      style={{ overflowY: 'auto', overflowX: 'hidden' }}
    >
      <div
        ref={contentRef}
        style={{ width: '100%', position: 'relative' }}
      >
        {/* Right Side Fixed Navigation */}
        <nav className="info-nav">
          <ul>
            {SECTIONS.map((section, idx) => (
              <li
                key={section.id}
                ref={(el) => {
                  navRefs.current[idx] = el
                }}
                className={activeSection === section.id ? 'active' : ''}
                onClick={() => scrollToSection(section.id)}
              >
                {section.label}
              </li>
            ))}
          </ul>
        </nav>

        {/* 50% width right aligned content */}
        <div className="info-content-scroll">
          {/* 1. Profile */}
          <section
            id="profile"
            className="info-section"
          >
            <h2 className="info-name">{t('info.name')}</h2>
            <p className="info-role">{t('info.role')}</p>
            <p className="info-about text-body">{t('info.about')}</p>
          </section>
          {/* 2. Experience */}
          <section
            id="experience"
            className="info-section"
          >
            <h3 className="info-block-title">{workExperience.title}</h3>
            {workExperience.jobs.map((job: any, jIdx: number) => (
              <div
                key={jIdx}
                className="job-entry  info-in"
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
          </section>
          {/* 3. Skills */}
          <section
            id="skills"
            className="info-section"
          >
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
          </section>
          {/* 4. Education */}
          <section
            id="education"
            className="info-section"
          >
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
          </section>
          {/* 5. Contact */}
          <section
            id="contact"
            className="info-section"
          >
            <h3 className="info-block-title">Get in touch</h3>
            <div className="info-contact info-in">
              <p className="btn-contact text-body">📧&nbsp;&nbsp;{contact.email}</p>
              <p className="btn-contact text-body">📞&nbsp;&nbsp;{contact.phone}</p>
            </div>
          </section>
          <div style={{ height: '10vh' }}></div> {/* Scroll padding */}
        </div>
      </div>
    </div>
  )
}

export default Info
