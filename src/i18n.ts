import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import translationEN from './locales/en/translation.json'
import translationKO from './locales/ko/translation.json'
import { getPreferredLang, parsePath } from './utils/routing'

const resources = {
  en: {
    translation: translationEN,
  },
  ko: {
    translation: translationKO,
  },
}

i18n.use(initReactI18next).init({
  resources,
  // URL의 /:lang prefix가 최우선, 없으면 저장된 선호 언어 (기본 en) —
  // 딥링크(/ko/works) 첫 렌더부터 올바른 언어로 시작해 깜빡임 방지
  lng: parsePath(window.location.pathname).lang ?? getPreferredLang(),
  fallbackLng: 'ko',
  interpolation: {
    escapeValue: false,
  },
})

export default i18n
