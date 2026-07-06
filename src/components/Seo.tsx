import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router";
import {
  DEFAULT_LANG,
  parsePath,
  pathForView,
  SUPPORTED_LANGS,
  type StableView,
} from "../utils/routing";

/**
 * Route/language-aware meta tags.
 *
 * React 19 hoists <title>/<meta>/<link> rendered anywhere into <head> —
 * no helmet library needed. Strings live in translation.json ("meta" section)
 * so the v3.0 content overhaul can edit them without touching code.
 *
 * URLs use the runtime origin, so canonical/hreflang stay correct on any
 * deploy target (preview URLs, custom domain) without configuration.
 */
export default function Seo() {
  const { t } = useTranslation();
  const location = useLocation();

  // index.html carries static fallback tags for non-JS crawlers/unfurlers.
  // React 19 dedupes <title> but NOT <meta>, so remove the fallbacks once
  // the dynamic tags below take over — otherwise crawlers read the first
  // (static, English) copy of description/og:*.
  useEffect(() => {
    document.head
      .querySelectorAll("[data-seo-fallback]")
      .forEach((el) => el.remove());
  }, []);

  const { lang, view } = parsePath(location.pathname);
  // During a transition the URL already points at the target view,
  // so meta always describes where the user is heading
  const stableView: StableView = view ?? "hero";
  const currentLang = lang ?? DEFAULT_LANG;

  const title = t(`meta.${stableView}.title`);
  const description = t(`meta.${stableView}.description`);
  const origin = window.location.origin;
  const canonical = `${origin}${pathForView(stableView, currentLang)}`;

  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />

      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={t("meta.siteName")} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta
        property="og:locale"
        content={currentLang === "ko" ? "ko_KR" : "en_US"}
      />
      <meta name="twitter:card" content="summary" />

      <link rel="canonical" href={canonical} />
      {SUPPORTED_LANGS.map((l) => (
        <link
          key={l}
          rel="alternate"
          hrefLang={l}
          href={`${origin}${pathForView(stableView, l)}`}
        />
      ))}
      <link
        rel="alternate"
        hrefLang="x-default"
        href={`${origin}${pathForView(stableView, DEFAULT_LANG)}`}
      />
    </>
  );
}
