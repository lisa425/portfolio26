import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, redirect, RouterProvider } from 'react-router'
import './index.scss'
import App from './App.tsx'
import './i18n';
import {
  getPreferredLang,
  isSupportedLang,
  parsePath,
  pathForView,
  VIEW_SEGMENTS,
} from './utils/routing'

// Bare paths (no language prefix) keep their view, gain the preferred language
const redirectWithLang = (pathname: string) => {
  const view = parsePath(pathname).view ?? 'hero'
  return redirect(pathForView(view, getPreferredLang()))
}

// App is the layout: the Three.js canvas stays mounted across all routes.
// Child routes render nothing — App reads the location itself and only
// decides which overlay section is shown above the canvas.
// Loaders run before render, so redirects never flash a wrong view.
const router = createBrowserRouter([
  { path: '/', loader: () => redirectWithLang('/') },
  { path: `/${VIEW_SEGMENTS.works}`, loader: () => redirectWithLang(`/${VIEW_SEGMENTS.works}`) },
  { path: `/${VIEW_SEGMENTS.info}`, loader: () => redirectWithLang(`/${VIEW_SEGMENTS.info}`) },
  {
    path: '/:lang',
    // Unknown language segment (/jp/...) → preferred-language hero
    loader: ({ params }) =>
      isSupportedLang(params.lang)
        ? null
        : redirect(pathForView('hero', getPreferredLang())),
    element: <App />,
    children: [
      { index: true, element: null },
      { path: VIEW_SEGMENTS.works, element: null },
      { path: VIEW_SEGMENTS.info, element: null },
      // Unknown view under a valid lang (/en/foo) → that language's hero
      {
        path: '*',
        loader: ({ params }) =>
          redirect(
            pathForView(
              'hero',
              isSupportedLang(params.lang) ? params.lang : getPreferredLang(),
            ),
          ),
      },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
