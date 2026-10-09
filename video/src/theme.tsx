import { useEffect, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";

/** MoneyMap brand tokens (from src/styles/index.css and docs/brand/BRAND.md in the app). */
export const C = {
  night: "#071226",
  night2: "#0b1b38",
  mint: "#2ee6a8",
  mint600: "#1fcc92",
  blue: "#2f6bff",
  blueSoft: "#7aa2ff",
  canvas: "#f3f6fa",
  surface: "#ffffff",
  surface2: "#f8fafc",
  line: "#e2e8f0",
  ink: "#0a1628",
  ink2: "#334159",
  ink3: "#56657c",
  green: "#047857",
  green50: "#e3f9f0",
  amber: "#f59e0b",
  red: "#e5483d",
};

export const SANS = "Geist, Inter, system-ui, sans-serif";
export const SERIF = '"Instrument Serif", Georgia, serif';
export const MONO = '"Geist Mono", ui-monospace, monospace';

export const MIDNIGHT_BG = `radial-gradient(60% 80% at 85% 0%, rgba(46,230,168,0.18), transparent 60%), radial-gradient(50% 70% at 0% 100%, rgba(47,107,255,0.22), transparent 60%), linear-gradient(160deg, #0b1b38 0%, #071226 55%, #050d1d 100%)`;

const EXT = "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1E00-1E9F,U+20A0-20AB,U+20AD-20C4";
const FACES: [string, string, string, string?][] = [
  ["Geist", "Geist.woff2", "normal"],
  ["Geist", "Geist-ext.woff2", "normal", EXT],
  ["Geist Mono", "GeistMono.woff2", "normal"],
  ["Geist Mono", "GeistMono-ext.woff2", "normal", EXT],
  ["Instrument Serif", "InstrumentSerif-Italic.woff2", "italic"],
  ["Instrument Serif", "InstrumentSerif-ext.woff2", "italic", EXT],
];

let loading: Promise<void> | null = null;
/** Loads the brand fonts from public/fonts before any frame renders. */
export function useBrandFonts() {
  const [handle] = useState(() => delayRender("brand fonts"));
  useEffect(() => {
    loading ??= Promise.all(
      FACES.map(([fam, file, style, range]) => {
        const f = new FontFace(fam, `url(${staticFile(`fonts/${file}`)}) format("woff2")`, { style, weight: "100 900", ...(range ? { unicodeRange: range } : {}) });
        return f.load().then((loaded) => { document.fonts.add(loaded); });
      }),
    ).then(() => undefined);
    loading.then(() => continueRender(handle)).catch((e) => { console.error(e); continueRender(handle); });
  }, [handle]);
}
