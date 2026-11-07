// Motion layer — anime.js (MIT, github.com/juliangarnier/anime).
// Tasteful micro-animation only: views settle in, feed items slide,
// queue items acknowledge the operator's tap. If anime.js fails to
// load, or the operator prefers reduced motion, everything simply
// appears — motion is garnish, never a dependency.

type AnimeModule = typeof import("animejs");

let animePromise: Promise<AnimeModule | null> | null = null;

function loadAnime(): Promise<AnimeModule | null> {
  if (!animePromise) {
    animePromise = import("animejs").catch(() => null);
  }
  return animePromise;
}

function reducedMotion(): boolean {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
  catch { return false; }
}

/** Settle a freshly-shown view in: rise 10px + fade, 240ms. */
export async function animateViewIn(el: HTMLElement | null): Promise<void> {
  if (!el || reducedMotion()) return;
  const anime = await loadAnime();
  if (!anime) return;
  try {
    anime.animate(el, {
      opacity: [0, 1],
      translateY: [10, 0],
      duration: 240,
      ease: "outQuad",
    });
  } catch { /* garnish only */ }
}

/** Slide + fade a list item in (feed entries, queue items). */
export async function animateItemIn(el: HTMLElement | null): Promise<void> {
  if (!el || reducedMotion()) return;
  const anime = await loadAnime();
  if (!anime) return;
  try {
    anime.animate(el, {
      opacity: [0, 1],
      translateX: [-8, 0],
      duration: 220,
      ease: "outQuad",
    });
  } catch { /* garnish only */ }
}

/** A short confirmation pulse — used when an approved item executes. */
export async function pulse(el: HTMLElement | null): Promise<void> {
  if (!el || reducedMotion()) return;
  const anime = await loadAnime();
  if (!anime) return;
  try {
    anime.animate(el, {
      scale: [1, 1.025, 1],
      duration: 320,
      ease: "inOutQuad",
    });
  } catch { /* garnish only */ }
}
