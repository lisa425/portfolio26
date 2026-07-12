import { render } from '@testing-library/react'
import Skeleton from '../Skeleton'

describe('Skeleton', () => {
  it('기본은 셔머가 보이는 상태다', () => {
    const { container } = render(<Skeleton />)
    const el = container.querySelector('.ui-skeleton')
    expect(el).toBeInTheDocument()
    expect(el).not.toHaveClass('ui-skeleton--hidden')
  })

  it('hidden이면 --hidden 클래스로 페이드아웃한다', () => {
    const { container } = render(<Skeleton hidden />)
    expect(container.querySelector('.ui-skeleton')).toHaveClass('ui-skeleton--hidden')
  })

  it('장식 요소라 스크린리더에서 숨긴다 (aria-hidden)', () => {
    const { container } = render(<Skeleton />)
    expect(container.querySelector('.ui-skeleton')).toHaveAttribute('aria-hidden')
  })
})
