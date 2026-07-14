import {
  DEFAULT_LANG,
  detectRegionLang,
  getPreferredLang,
  isSupportedLang,
  parsePath,
  pathForView,
  savePreferredLang,
  viewFromPath,
} from '../routing'

describe('isSupportedLang', () => {
  it.each(['ko', 'en'])('지원 언어 %s → true', (lang) => {
    expect(isSupportedLang(lang)).toBe(true)
  })

  it.each(['jp', 'KO', '', undefined])('미지원 값 %s → false', (value) => {
    expect(isSupportedLang(value as string | undefined)).toBe(false)
  })
})

describe('parsePath', () => {
  it('루트("/")는 언어 없이 hero를 가리킨다', () => {
    expect(parsePath('/')).toEqual({ lang: null, view: 'hero' })
  })

  it('언어 프리픽스만 있으면 해당 언어의 hero다', () => {
    expect(parsePath('/ko')).toEqual({ lang: 'ko', view: 'hero' })
    expect(parsePath('/en')).toEqual({ lang: 'en', view: 'hero' })
  })

  it('언어 + 뷰 세그먼트를 파싱한다', () => {
    expect(parsePath('/ko/works')).toEqual({ lang: 'ko', view: 'works' })
    expect(parsePath('/en/about')).toEqual({ lang: 'en', view: 'about' })
  })

  it('언어 프리픽스 없는 bare 뷰 경로는 lang: null로 뷰만 유지한다', () => {
    expect(parsePath('/works')).toEqual({ lang: null, view: 'works' })
    expect(parsePath('/about')).toEqual({ lang: null, view: 'about' })
  })

  it('지원하지 않는 언어 세그먼트는 lang/view 모두 null', () => {
    expect(parsePath('/jp/works')).toEqual({ lang: null, view: null })
  })

  it('유효한 언어 아래의 알 수 없는 뷰는 view: null', () => {
    expect(parsePath('/en/foo')).toEqual({ lang: 'en', view: null })
  })

  it('세그먼트가 3개 이상이면 view: null (유효 언어는 유지)', () => {
    expect(parsePath('/ko/works/extra')).toEqual({ lang: 'ko', view: null })
  })

  it('trailing slash와 중복 슬래시를 허용한다', () => {
    expect(parsePath('/ko/works/')).toEqual({ lang: 'ko', view: 'works' })
    expect(parsePath('//ko//about')).toEqual({ lang: 'ko', view: 'about' })
  })
})

describe('viewFromPath', () => {
  it('언어 프리픽스와 무관하게 뷰만 돌려준다', () => {
    expect(viewFromPath('/en/works')).toBe('works')
    expect(viewFromPath('/works')).toBe('works')
    expect(viewFromPath('/')).toBe('hero')
    expect(viewFromPath('/jp/works')).toBeNull()
  })
})

describe('pathForView', () => {
  it('hero는 언어 루트로, 섹션은 언어 하위 경로로 만든다', () => {
    expect(pathForView('hero', 'ko')).toBe('/ko')
    expect(pathForView('works', 'en')).toBe('/en/works')
    expect(pathForView('about', 'ko')).toBe('/ko/about')
  })

  it('parsePath와 왕복(round-trip)이 성립한다', () => {
    const views = ['hero', 'works', 'about'] as const
    const langs = ['ko', 'en'] as const
    for (const view of views) {
      for (const lang of langs) {
        expect(parsePath(pathForView(view, lang))).toEqual({ lang, view })
      }
    }
  })
})

describe('detectRegionLang', () => {
  const setLanguages = (langs: string[]) => {
    Object.defineProperty(window.navigator, 'languages', {
      value: langs,
      configurable: true,
    })
  }

  const setTimeZone = (timeZone: string) => {
    jest.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
      resolvedOptions: () => ({ timeZone }),
    } as unknown as Intl.DateTimeFormat)
  }

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('브라우저 언어에 ko가 포함되면 ko', () => {
    setLanguages(['ko-KR', 'en-US'])
    setTimeZone('America/New_York')
    expect(detectRegionLang()).toBe('ko')
  })

  it('언어에 ko가 없어도 Asia/Seoul 시간대면 ko', () => {
    setLanguages(['en-US'])
    setTimeZone('Asia/Seoul')
    expect(detectRegionLang()).toBe('ko')
  })

  it('둘 다 아니면 기본 언어(en)', () => {
    setLanguages(['en-US', 'fr-FR'])
    setTimeZone('Europe/Paris')
    expect(detectRegionLang()).toBe(DEFAULT_LANG)
  })
})

describe('getPreferredLang / savePreferredLang', () => {
  beforeEach(() => {
    window.localStorage.clear()
    Object.defineProperty(window.navigator, 'languages', {
      value: ['en-US'],
      configurable: true,
    })
    jest.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
      resolvedOptions: () => ({ timeZone: 'America/New_York' }),
    } as unknown as Intl.DateTimeFormat)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('저장된 선호 언어가 있으면 지역 감지보다 우선한다', () => {
    savePreferredLang('ko')
    expect(getPreferredLang()).toBe('ko')
  })

  it('저장값이 유효하지 않으면 무시하고 지역 감지로 폴백한다', () => {
    window.localStorage.setItem('preferredLang', 'jp')
    expect(getPreferredLang()).toBe('en')
  })

  it('저장값이 없으면 지역 감지 결과를 쓴다', () => {
    expect(getPreferredLang()).toBe('en')
  })
})
