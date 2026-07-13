import { fireEvent, render } from '@testing-library/react'
import type { ReactNode } from 'react'
import WorkDetailImage from '../WorkDetailImage'

// 실제 Swiper 엔진(ResizeObserver 등 jsdom 미지원 API 의존)은 우리 책임 범위
// 밖이라 목으로 대체 — 이 테스트는 "우리 컴포넌트가 배열을 슬라이드로 매핑하고
// 로딩 상태를 관리하는지"만 검증한다. slidePrev/slideNext는 mock 함수로 감시.
const mockSlidePrev = jest.fn()
const mockSlideNext = jest.fn()

jest.mock('swiper/react', () => ({
  Swiper: ({
    children,
    onSwiper,
  }: {
    children: ReactNode
    onSwiper?: (s: { slidePrev: jest.Mock; slideNext: jest.Mock }) => void
  }) => {
    onSwiper?.({ slidePrev: mockSlidePrev, slideNext: mockSlideNext })
    return <div data-testid="swiper-mock">{children}</div>
  },
  SwiperSlide: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}))

describe('WorkDetailImage', () => {
  afterEach(() => {
    mockSlidePrev.mockClear()
    mockSlideNext.mockClear()
  })

  it('src 배열 길이만큼 슬라이드(이미지)를 렌더한다', () => {
    const { container } = render(
      <WorkDetailImage src={['/img/a.jpg', '/img/b.jpg', '/img/c.jpg']} />,
    )
    expect(container.querySelectorAll('img')).toHaveLength(3)
  })

  it('로드 전: 각 슬라이드에 스켈레톤이 보인다', () => {
    const { container } = render(<WorkDetailImage src={['/img/a.jpg', '/img/b.jpg']} />)
    const skeletons = container.querySelectorAll('[class*="ui-skeleton"]')
    expect(skeletons).toHaveLength(2)
    skeletons.forEach((el) => expect(el.className).not.toMatch(/hidden/))
  })

  it('개별 이미지가 로드되면 그 슬라이드의 스켈레톤만 사라진다', () => {
    const { container } = render(<WorkDetailImage src={['/img/a.jpg', '/img/b.jpg']} />)
    const imgs = container.querySelectorAll('img')

    fireEvent.load(imgs[0])

    expect(imgs[0]).toHaveClass('is-loaded')
    expect(imgs[1]).not.toHaveClass('is-loaded')
    const skeletons = container.querySelectorAll('[class*="ui-skeleton"]')
    expect(skeletons[0].className).toMatch(/hidden/)
    expect(skeletons[1].className).not.toMatch(/hidden/)
  })

  it('로드 실패한 슬라이드도 스켈레톤이 정리된다', () => {
    const { container } = render(<WorkDetailImage src={['/img/broken.jpg']} />)
    fireEvent.error(container.querySelector('img')!)
    expect(container.querySelector('[class*="ui-skeleton"]')!.className).toMatch(/hidden/)
  })

  it('첫 이미지는 eager, 나머지는 lazy 로딩이다', () => {
    const { container } = render(
      <WorkDetailImage src={['/img/a.jpg', '/img/b.jpg', '/img/c.jpg']} />,
    )
    const imgs = container.querySelectorAll('img')
    expect(imgs[0]).toHaveAttribute('loading', 'eager')
    expect(imgs[1]).toHaveAttribute('loading', 'lazy')
    expect(imgs[2]).toHaveAttribute('loading', 'lazy')
  })

  it('이미지가 2장 이상이면 이전/다음 컨트롤과 카운터를 렌더한다', () => {
    const { getByLabelText, getByText } = render(
      <WorkDetailImage src={['/img/a.jpg', '/img/b.jpg']} />,
    )
    expect(getByLabelText('previous image')).toBeInTheDocument()
    expect(getByLabelText('next image')).toBeInTheDocument()
    expect(getByText('01/02')).toBeInTheDocument()
  })

  it('이미지가 1장뿐이면 컨트롤을 렌더하지 않는다', () => {
    const { queryByLabelText } = render(<WorkDetailImage src={['/img/a.jpg']} />)
    expect(queryByLabelText('previous image')).not.toBeInTheDocument()
    expect(queryByLabelText('next image')).not.toBeInTheDocument()
  })

  it('다음/이전 버튼 클릭 시 swiper 인스턴스의 이동 메서드를 호출한다', () => {
    const { getByLabelText } = render(
      <WorkDetailImage src={['/img/a.jpg', '/img/b.jpg']} />,
    )
    fireEvent.click(getByLabelText('next image'))
    expect(mockSlideNext).toHaveBeenCalledTimes(1)

    fireEvent.click(getByLabelText('previous image'))
    expect(mockSlidePrev).toHaveBeenCalledTimes(1)
  })
})
