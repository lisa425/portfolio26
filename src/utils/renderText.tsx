import React from "react";

/**
 * Parses a translation string and renders it with device-aware line breaks.
 *
 * Tokens:
 *  - `\n`   → PC-only line break (`<br className="br-pc" />`)
 *             Hidden on mobile via CSS `.br-pc { display: none }` at ≤1000px
 *  - `\\m`, `[m]`, or `<m>` → Mobile-only line break (`<br className="br-mobile" />`)
 *             Hidden on desktop via CSS `.br-mobile { display: none }` at >1000px
 *
 * Usage in translation.json:
 *   "text": "PC에서만\n줄바꿈. 모바일에서만\\m줄바꿈."
 *
 * @param text - Raw string from i18n (may contain \n and \\m tokens)
 * @returns React node array with appropriate <br> elements inserted
 */
export const renderText = (text: string): React.ReactNode => {
  if (!text) return null;

  // Split on all recognized br tokens while preserving delimiters via capture group
  const parts = text.split(/(\n|\\m|\[m\]|<m>)/g);

  return parts.map((part, idx) => {
    if (part === "\n") {
      // PC-only break
      return <br key={idx} className="br-pc" />;
    }
    if (part === "\\m" || part === "[m]" || part === "<m>") {
      // Mobile-only break
      return <br key={idx} className="br-mobile" />;
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
};
