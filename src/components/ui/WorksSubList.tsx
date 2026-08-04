import type { WorksListRowItem } from '../../types'
import { renderText } from '../../utils/renderText'
import styles from './WorksSubList.module.scss'

interface WorksSubListProps {
  items: WorksListRowItem[]
  /** 섹션 헤딩 텍스트 (기본 OTHER PROJECTS) */
  title?: string
  /**
   * 주어지면 각 행 전체가 클릭 가능해지고(카드 느낌의 미묘한 배경/좌측 강조선),
   * 클릭 시 이 콜백이 행의 인덱스와 함께 호출된다 — LINK 칸은 외부 링크 대신
   * `[ ENTER ]` 힌트를 보여준다. Selected Project(detail 모달 오픈) 용도.
   * 없으면 기존처럼 url이 있는 항목만 외부 링크(새 탭)로 노출.
   */
  onItemClick?: (index: number) => void
}

/** 링크 라벨용 호스트명 — 파싱 실패 시 일반 라벨로 폴백 */
function hostnameOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'LINK'
  }
}

/**
 * Works 프로젝트 텍스트 리스트 — YEAR/PROJECT/DEPT/STACK/LINK 테이블형 행.
 * `onItemClick` 유무로 두 가지 용도를 겸한다:
 *  - 없음(기본): "Other Projects" — url이 있는 항목만 외부 링크(새 탭)
 *  - 있음: "Selected Project" — 행 전체가 클릭 가능(내부 detail 모달 오픈),
 *    미묘한 배경 강조로 카드류와는 다르지만 "누를 수 있다"는 인상을 준다
 * 스타일: WorksSubList.module.scss
 */
function WorksSubList({ items, title = 'OTHER PROJECTS', onItemClick }: WorksSubListProps) {
  if (items.length === 0) return null

  const clickable = Boolean(onItemClick)

  return (
    <section className={styles['sub-list']}>
      <h3 className={styles['sub-list__title']}>◼︎ {title}</h3>
      <div
        className={styles['sub-list__head']}
        aria-hidden
      >
        <span>YEAR</span>
        <span>PROJECT</span>
        <span>DEPT</span>
        <span>STACK</span>
        <span>{clickable ? 'DETAIL' : 'LINK'}</span>
      </div>
      <ul className={styles['sub-list__rows']}>
        {items.map((item, i) => (
          <li
            key={`${item.title}-${i}`}
            className={`${styles['sub-list__row']}${clickable ? ` ${styles['sub-list__row--clickable']}` : ''}`}
            {...(clickable && {
              role: 'button',
              tabIndex: 0,
              onClick: () => onItemClick?.(i),
              onKeyDown: (e: React.KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onItemClick?.(i)
                }
              },
            })}
          >
            <span className={styles['sub-list__year']}>{item.date.slice(0, 4)}</span>
            <span className={styles['sub-list__project']}>
              <span className={styles['sub-list__name']}>{renderText(item.title)}</span>
              {item.intro && <span className={styles['sub-list__intro']}>{renderText(item.intro)}</span>}
            </span>
            <span className={styles['sub-list__dept']}>{item.dept}</span>
            <span className={styles['sub-list__stack']}>{item.stack}</span>
            <span className={styles['sub-list__link']}>
              {clickable ? (
                <span className={styles['sub-list__enter']}>[ OPEN ]</span>
              ) : (
                item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    [ LAUNCH ] ↗
                  </a>
                )
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default WorksSubList
