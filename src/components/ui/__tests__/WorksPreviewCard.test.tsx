import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import type { WorkType } from '../../../types'
import WorksPreviewCard from '../WorksPreviewCard'

const work: WorkType = {
  id: 1,
  category: 1,
  dept: '',
  game: 'Azure Promilia',
  title: 'Official Website & 1st Pre-registration',
  intro: '',
  date: '2025.11 - 2025.12',
  description: [],
  stack: 'Next.js',
  thumbnail: '/assets/images/az_thumb1.jpg',
  img: [],
  url: '',
}

describe('WorksPreviewCard', () => {
  it('프로젝트 데이터(게임/제목/스택)와 순번 인디케이터를 렌더한다', () => {
    const { container, getByText } = render(
      <WorksPreviewCard work={work} index={0} total={5} />,
    )
    expect(getByText('Azure Promilia')).toBeInTheDocument()
    expect(getByText(/Official Website/)).toBeInTheDocument()
    expect(getByText('Next.js')).toBeInTheDocument()
    // 001/005는 JSX 표현식 경계로 텍스트 노드가 쪼개져 있어 요소 단위로 검증
    expect(
      container.querySelector('.works-preview__index')?.textContent,
    ).toBe('001/005')
  })

  it('active prop이 노출 클래스를 토글한다 (모바일 상시 / PC는 Works가 DOM 제어)', () => {
    const { container, rerender } = render(
      <WorksPreviewCard work={work} index={0} total={5} />,
    )
    expect(container.querySelector('.works-preview')).not.toHaveClass('active')

    rerender(<WorksPreviewCard work={work} index={0} total={5} active />)
    expect(container.querySelector('.works-preview')).toHaveClass('active')
  })

  it('클릭 시 onClick이 호출된다', async () => {
    const user = userEvent.setup()
    const onClick = jest.fn()
    const { container } = render(
      <WorksPreviewCard work={work} index={0} total={5} active onClick={onClick} />,
    )

    await user.click(container.querySelector('.works-preview')!)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('ref로 카드 루트 DOM에 접근할 수 있다 (PC 호버 패널의 위치 제어용)', () => {
    const ref = createRef<HTMLDivElement>()
    render(<WorksPreviewCard work={work} index={0} total={5} ref={ref} />)
    expect(ref.current).toBeInstanceOf(HTMLDivElement)
    expect(ref.current).toHaveClass('works-preview')
  })
})
