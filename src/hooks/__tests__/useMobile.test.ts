import { renderHook } from '@testing-library/react'
import { useMobile } from '../useMobile'

const DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

function setEnvironment({
  userAgent,
  maxTouchPoints,
  innerWidth,
}: {
  userAgent: string
  maxTouchPoints: number
  innerWidth: number
}) {
  Object.defineProperty(window.navigator, 'userAgent', {
    value: userAgent,
    configurable: true,
  })
  Object.defineProperty(window.navigator, 'maxTouchPoints', {
    value: maxTouchPoints,
    configurable: true,
  })
  Object.defineProperty(window, 'innerWidth', {
    value: innerWidth,
    configurable: true,
  })
  // jsdom에는 matchMedia가 없다 — 훅의 리스너 등록 경로용 최소 목
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: innerWidth <= 1023,
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  })) as unknown as typeof window.matchMedia
}

describe('useMobile', () => {
  it('데스크톱 UA + 넓은 뷰포트(1440px) → 모바일 아님', () => {
    setEnvironment({ userAgent: DESKTOP_UA, maxTouchPoints: 0, innerWidth: 1440 })
    const { result } = renderHook(() => useMobile())
    expect(result.current.isMobile).toBe(false)
    expect(result.current.isMobileDevice).toBe(false)
    expect(result.current.isNarrowViewport).toBe(false)
  })

  it('데스크톱 UA라도 좁은 뷰포트(800px)면 모바일 취급', () => {
    setEnvironment({ userAgent: DESKTOP_UA, maxTouchPoints: 0, innerWidth: 800 })
    const { result } = renderHook(() => useMobile())
    expect(result.current.isMobile).toBe(true)
    expect(result.current.isMobileDevice).toBe(false)
    expect(result.current.isNarrowViewport).toBe(true)
  })

  it('경계값: 1023px은 모바일, 1024px은 PC (SCSS $tablet과 동기)', () => {
    setEnvironment({ userAgent: DESKTOP_UA, maxTouchPoints: 0, innerWidth: 1023 })
    expect(renderHook(() => useMobile()).result.current.isMobile).toBe(true)

    setEnvironment({ userAgent: DESKTOP_UA, maxTouchPoints: 0, innerWidth: 1024 })
    expect(renderHook(() => useMobile()).result.current.isMobile).toBe(false)
  })

  it('iPhone UA는 뷰포트가 넓어도 모바일 기기다', () => {
    setEnvironment({ userAgent: IPHONE_UA, maxTouchPoints: 5, innerWidth: 1440 })
    const { result } = renderHook(() => useMobile())
    expect(result.current.isMobileDevice).toBe(true)
    expect(result.current.isMobile).toBe(true)
  })

  it('iPadOS 13+ (Macintosh UA + 멀티터치)를 모바일 기기로 잡는다', () => {
    setEnvironment({ userAgent: DESKTOP_UA, maxTouchPoints: 5, innerWidth: 1366 })
    const { result } = renderHook(() => useMobile())
    expect(result.current.isMobileDevice).toBe(true)
    expect(result.current.isMobile).toBe(true)
  })

  it('Macintosh UA + 터치 없음은 데스크톱이다', () => {
    setEnvironment({ userAgent: DESKTOP_UA, maxTouchPoints: 0, innerWidth: 1440 })
    const { result } = renderHook(() => useMobile())
    expect(result.current.isMobileDevice).toBe(false)
  })
})
