// Tracks when displayed values last changed, for the fading highlight.
//
// Code and equations are re-rendered on every update, which recreates their
// elements. A changed value gets the class `hn-changed` (a CSS animation that
// fades out, see pencil.css) and a negative animation delay `--hn-age` equal
// to the time since it changed. A recreated element therefore continues its
// fade where the previous one was, instead of starting over or stopping.
// After the animation has run out, the class has no visible effect.
export function changeTracker() {
  const last = new Map(), since = new Map();
  return {
    // Record the current value of `key`; returns the time in ms since it
    // last changed, or null if it never changed.
    mark(key, value, now = performance.now()) {
      if (last.has(key) && last.get(key) !== value) since.set(key, now);
      last.set(key, value);
      return since.has(key) ? Math.round(now - since.get(key)) : null;
    },
  };
}
