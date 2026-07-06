import type { LangType } from "../types";

// Single source of truth for URL ↔ view/lang mapping.
// URL scheme: /:lang(/:view)? — e.g. /en, /ko/works, /en/info

export type SectionView = "works" | "info";
export type StableView = "hero" | SectionView;
export type ViewType = StableView | "transitioning";

export const SUPPORTED_LANGS: readonly LangType[] = ["ko", "en"];
export const DEFAULT_LANG: LangType = "en";
const LANG_STORAGE_KEY = "preferredLang";

/** URL path segments for each section view (also used in the route config) */
export const VIEW_SEGMENTS: Record<SectionView, string> = {
  works: "works",
  info: "info",
};

export function isSupportedLang(
  value: string | undefined,
): value is LangType {
  return SUPPORTED_LANGS.includes(value as LangType);
}

/**
 * First-visit region detection — no network round-trip, decided before first
 * paint: Korean browser language OR Korea timezone → ko, everyone else → en.
 */
export function detectRegionLang(): LangType {
  try {
    const langs =
      navigator.languages && navigator.languages.length > 0
        ? navigator.languages
        : [navigator.language];
    if (langs.some((l) => l?.toLowerCase().startsWith("ko"))) return "ko";
    if (Intl.DateTimeFormat().resolvedOptions().timeZone === "Asia/Seoul") {
      return "ko";
    }
  } catch {
    // navigator/Intl unavailable — fall through to default
  }
  return DEFAULT_LANG;
}

/**
 * Language for URLs without a lang prefix:
 * saved user choice > detected region (ko for Korea) > en
 */
export function getPreferredLang(): LangType {
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (saved && isSupportedLang(saved)) return saved;
  } catch {
    // localStorage unavailable (privacy mode) — fall through to detection
  }
  return detectRegionLang();
}

export function savePreferredLang(lang: LangType): void {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // best-effort only
  }
}

function viewFromSegment(segment: string | undefined): StableView | null {
  if (!segment) return "hero";
  if (segment === VIEW_SEGMENTS.works) return "works";
  if (segment === VIEW_SEGMENTS.info) return "info";
  return null;
}

/**
 * Parse a pathname into its lang/view parts.
 * null fields mean the segment is missing or unknown:
 *   "/"          → { lang: null, view: "hero" }
 *   "/works"     → { lang: null, view: "works" }   (bare path, lang redirect needed)
 *   "/ko/info"   → { lang: "ko", view: "info" }
 *   "/jp/works"  → { lang: null, view: null }      (unknown lang)
 *   "/en/foo"    → { lang: "en", view: null }      (unknown view)
 */
export function parsePath(pathname: string): {
  lang: LangType | null;
  view: StableView | null;
} {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return { lang: null, view: "hero" };

  if (isSupportedLang(segments[0])) {
    if (segments.length > 2) return { lang: segments[0], view: null };
    return { lang: segments[0], view: viewFromSegment(segments[1]) };
  }

  if (segments.length === 1) {
    return { lang: null, view: viewFromSegment(segments[0]) };
  }
  return { lang: null, view: null };
}

/** Resolve a pathname to its view regardless of lang prefix. null = unknown. */
export function viewFromPath(pathname: string): StableView | null {
  return parsePath(pathname).view;
}

export function pathForView(view: StableView, lang: LangType): string {
  const base = `/${lang}`;
  return view === "hero" ? base : `${base}/${VIEW_SEGMENTS[view]}`;
}
