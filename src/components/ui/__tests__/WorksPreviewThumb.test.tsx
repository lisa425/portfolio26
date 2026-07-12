import { fireEvent, render } from '@testing-library/react'
import WorksPreviewThumb from '../WorksPreviewThumb'

describe('WorksPreviewThumb', () => {
  it('로드 전에는 스켈레톤이 보이고 이미지는 투명 상태다', () => {
    const { container } = render(<WorksPreviewThumb src="/thumb/a.jpg" alt="project a" />)
    expect(container.querySelector('.ui-skeleton')).not.toHaveClass('ui-skeleton--hidden')
    expect(container.querySelector('img')).not.toHaveClass('is-loaded')
  })

  it('로드되면 스켈레톤이 숨고 이미지가 페이드인한다', () => {
    const { container } = render(<WorksPreviewThumb src="/thumb/a.jpg" alt="project a" />)
    fireEvent.load(container.querySelector('img')!)
    expect(container.querySelector('.ui-skeleton')).toHaveClass('ui-skeleton--hidden')
    expect(container.querySelector('img')).toHaveClass('is-loaded')
  })

  it('src가 바뀌면 스켈레톤이 다시 나타난다', () => {
    const { container, rerender } = render(
      <WorksPreviewThumb src="/thumb/a.jpg" alt="project a" />,
    )
    fireEvent.load(container.querySelector('img')!)

    rerender(<WorksPreviewThumb src="/thumb/b.jpg" alt="project b" />)

    expect(container.querySelector('.ui-skeleton')).not.toHaveClass('ui-skeleton--hidden')
  })

  it('alt 텍스트가 이미지에 전달된다', () => {
    const { getByAltText } = render(<WorksPreviewThumb src="/thumb/a.jpg" alt="project a" />)
    expect(getByAltText('project a')).toBeInTheDocument()
  })
})
