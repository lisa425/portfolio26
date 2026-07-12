import { fireEvent, render } from '@testing-library/react'
import WorkDetailImage, { PANEL_IMG_PLACEHOLDER_H } from '../WorkDetailImage'

// jsdom은 이미지를 실제로 로드하지 않으므로 load/error 이벤트를 직접 발생시킨다
describe('WorkDetailImage', () => {
  it('로드 전: 240px 플레이스홀더 높이 + 스켈레톤 + aria-busy', () => {
    const { container } = render(<WorkDetailImage src="/img/a.jpg" index={0} />)
    const wrapper = container.querySelector<HTMLElement>('.image-wrapper')!

    expect(wrapper.style.height).toBe(`${PANEL_IMG_PLACEHOLDER_H}px`)
    expect(wrapper).toHaveAttribute('aria-busy', 'true')
    expect(container.querySelector('.ui-skeleton')).not.toHaveClass('ui-skeleton--hidden')
    expect(container.querySelector('img')).not.toHaveClass('is-loaded')
  })

  it('로드 후: is-loaded + 스켈레톤 숨김 + aria-busy 해제', () => {
    const { container } = render(<WorkDetailImage src="/img/a.jpg" index={0} />)
    const img = container.querySelector('img')!

    fireEvent.load(img)

    expect(img).toHaveClass('is-loaded')
    expect(container.querySelector('.ui-skeleton')).toHaveClass('ui-skeleton--hidden')
    expect(container.querySelector('.image-wrapper')).toHaveAttribute('aria-busy', 'false')
  })

  it('로드 실패: 플레이스홀더 높이를 유지한 채 스켈레톤만 정리한다', () => {
    const { container } = render(<WorkDetailImage src="/img/broken.jpg" index={0} />)
    const img = container.querySelector('img')!

    fireEvent.error(img)

    const wrapper = container.querySelector<HTMLElement>('.image-wrapper')!
    expect(wrapper.style.height).toBe(`${PANEL_IMG_PLACEHOLDER_H}px`)
    expect(container.querySelector('.ui-skeleton')).toHaveClass('ui-skeleton--hidden')
  })

  it('src가 바뀌면 로딩 상태(스켈레톤/aria-busy)로 되돌아간다', () => {
    const { container, rerender } = render(<WorkDetailImage src="/img/a.jpg" index={0} />)
    fireEvent.load(container.querySelector('img')!)
    expect(container.querySelector('.ui-skeleton')).toHaveClass('ui-skeleton--hidden')

    rerender(<WorkDetailImage src="/img/b.jpg" index={0} />)

    expect(container.querySelector('.ui-skeleton')).not.toHaveClass('ui-skeleton--hidden')
    expect(container.querySelector('.image-wrapper')).toHaveAttribute('aria-busy', 'true')
  })

  it('앞쪽 2장은 eager, 그 뒤는 lazy 로딩이다', () => {
    const eager = render(<WorkDetailImage src="/img/a.jpg" index={1} />)
    const lazy = render(<WorkDetailImage src="/img/b.jpg" index={2} />)
    expect(eager.container.querySelector('img')).toHaveAttribute('loading', 'eager')
    expect(lazy.container.querySelector('img')).toHaveAttribute('loading', 'lazy')
  })
})
