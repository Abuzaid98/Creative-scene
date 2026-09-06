# NORTHLIGHT

A small landscape scene — a cabin on rolling hills — that looks different depending on the time on your device, updating live. Open it at 2 AM and it's dark with a moon and stars; open it at noon and it's bright daylight. Built with plain **HTML + CSS + JavaScript**, no framework, no libraries, no images, no backend.

Live: **https://abuzaid-creative-scene.netlify.app**

---

## The idea

There are no separate "morning" and "night" pages. It is always the **same HTML and CSS**. JavaScript reads the clock, turns the time into a set of numbers (how high the sun is, how bright it is, what colour the sky is…), and writes those numbers into the page as **CSS variables**. CSS then paints the scene from those variables. This repeats once every second.

```
Device Time
  ↓  getCurrentTime()        → time as decimal hours (14.5 = 2:30 PM)
  ↓  solarPhase(hours)       → remaps time so sunrise = 0.25, sunset = 0.75
  ↓  sunElevation(phase)     → how high the sun is (-1 night … +1 midday)
  ↓  calculateSceneState()   → one object with every colour / position / opacity
  ↓  updateScene()           → writes all of it into CSS variables on <html>
  ↓  CSS variables
  ↓  CSS renders the scene   (and animates clouds, birds, etc. on its own)
```

---

## The three files

| File | Job |
|---|---|
| `index.html` | **Scene structure** — one `<main class="scene">` with each layer inside it (sky, sun, moon, clouds, hills, cabin, trees, birds, fireflies, HUD). No colours or time values live here. |
| `style.css` | **Visual design + continuous animation** — draws every layer from CSS variables, and runs all the self-moving animation (clouds drift, birds fly, stars twinkle, trees sway). |
| `script.js` | **Time logic** — reads the clock, calculates the scene numbers, writes them into CSS variables once per second. |

**CSS variables are the bridge.** JavaScript does `document.documentElement.style.setProperty("--daylight", "0.58")`; CSS does `opacity: var(--daylight)`. JavaScript never rebuilds or repaints the page — it only changes ~35 numbers, and CSS reacts. This is cheap (no layout work) and keeps design and logic fully separated.

---

## Key functions (in `script.js`)

`getCurrentTime()`
→ Gets the visitor's local time and returns it as decimal hours. Uses `?t=` if set, otherwise `new Date()`.

`solarPhase(hours)`
→ Takes the hours. Converts real time into the scene's "solar phase" (sunrise always `0.25`, sunset always `0.75`). This lets the day be longer than the night while still using one sine curve.

`sunElevation(phase)`
→ Takes the solar phase, runs `Math.sin(...)`, returns the sun's height: `-1` deep night, `0` sunrise/sunset, `+1` midday. Almost everything is derived from this.

`arcX(phase, offset)` / `arcY(elev)`
→ Return the sun/moon's screen position as a percentage. `arcX` uses `offset` `0.25` for the sun, `0.75` for the moon.

`lerp(a, b, k)`
→ Takes two values and a progress `k` (0–1). Returns the value between them. `lerp(0, 100, 0.5)` → `50`.

`smoothstep(e0, e1, x)`
→ Like `lerp` but with an eased S-curve, and it clamps to 0–1. Used to fade things in/out gently (stars, daylight, window glow) instead of a hard switch.

`mixRGB(c1, c2, k)` / `rgb(c)`
→ `mixRGB` blends two `[r,g,b]` colours; `rgb` turns an `[r,g,b]` array into a CSS `"rgb(...)"` string.

`skyStops(elev)`
→ Takes the sun's elevation. Blends the two nearest hand-picked palettes from `SKY_KEYS`. Returns 4 colours for the sky gradient.

`calculateSceneState(hours)`
→ The main brain. Takes the hours, returns one plain object with every colour, position and opacity. It only calculates — it never touches the page (a pure function).

`updateScene(state)`
→ Takes that object and writes every value into a CSS variable on `<html>`. The only place JS hands values to CSS.

`updateSpecialEvents(hours)`
→ Writes `--bird-opacity` and `--firefly-opacity` from their time windows (`birdIntensity`, `fireflyIntensity`).

`updateClock(hours)`
→ Updates the HUD clock digits and the time-of-day label text (`timeOfDayLabel`). The only part that writes text, not a CSS variable.

`tick()`
→ One full update: read the time, then run `updateScene` + `updateSpecialEvents` + `updateClock`. Runs once immediately, then every second via `setInterval(tick, 1000)`.

`buildStars()` / `buildFireflies()`
→ Create the star / firefly elements **once** at startup with random positions and timing. After that JS never touches them.

### Constants worth knowing

- `SUNRISE = 6`, `SUNSET = 18.75` — change these to move the day/night timing.
- `SKY_KEYS` — the 8 hand-picked sky palettes (deep night → midday), each with 4 colours.
- `forcedHours` — read once from `?t=`; `null` in normal use.
- `LABELS` — the hour boundaries for the HUD text label.

---

## How time maps to the scene

| Time | Sun elevation | Result |
|---|---|---|
| 6:00 AM | `0` | Sunrise. Sun on the left horizon, warm glow at its peak, stars gone, daylight rising. |
| 12:22 PM | `+1` | Solar noon. Brightest blue sky, sun overhead, no stars, cabin window off. |
| 6:45 PM | `0` | Sunset. Sun on the right horizon, warm glow, cabin window warming up, fireflies about to start. |
| 9:00 PM | `-0.59` | Full night. Dark sky, stars and moon out, cabin + house windows warm. |

Same HTML every time — only the calculated numbers change.

---

## Special time-based events

| Event | When | How |
|---|---|---|
| Morning birds | ~06:18–08:36 | `birdIntensity()` → `--bird-opacity` on `.birds`. Flying is pure CSS (two independent flocks). |
| Fireflies | 18:45–19:42 | `fireflyIntensity()` → `--firefly-opacity` on `.fireflies`. A smooth rise-and-fall. |
| Clouds | fade out at night | `cloudOpacity` from `--daylight`. |
| Distant house lights | brighter at night | reuse the cabin's `--window-glow`, dimmed with `calc()`. |
| Airplane | Every 10 sec, daytime | Pure-CSS @keyframes planeCross (10s loop, visible during the second half). Gated by `--daylight`. |
| Shooting star | brief, ~every 95s, night | pure-CSS `@keyframes shoot`. Gated by `--star-opacity`. |

---

## Other things to know

- **`tick()` = the heartbeat.** Everything time-based updates once per second. That's plenty — the sun barely moves in a second — and far cheaper than animating from JS every frame.
- **`?t=` = testing.** Add `?t=7.25` to the URL to preview 7:15 AM (decimal hours). Absent in normal use → real device time. Examples: `?t=2`, `?t=6.5`, `?t=12`, `?t=18.5`, `?t=21`.
- **No flash on load.** `<html class="booting">` disables all CSS transitions for the first frame; `tick()` runs before the first paint so the correct scene is drawn immediately; then `.booting` is removed so later updates ease smoothly.
- **Reduced motion = accessibility.** `@media (prefers-reduced-motion: reduce)` stops every animation and transition. The scene still shows the correct time — it just doesn't move on its own.
- **`@property` and `color-mix()`** are used for polish (smooth sky-colour fades, blended tree/house colours) and degrade gracefully in older browsers.

---

## If I want to change…

| Change | Edit |
|---|---|
| Sky colours | `SKY_KEYS` in `script.js` |
| Sunrise time | `SUNRISE` in `script.js` |
| Sunset time | `SUNSET` in `script.js` |
| Sun / moon path | `arcX()` / `arcY()` in `script.js` |
| Cabin look | the `<div class="cabin">` SVG in `index.html` + `.cabin-*` rules in `style.css` |
| Animation speed | the `--dur` / `--delay` values (clouds) or the `@keyframes` durations in `style.css` |
| A new time-based event | add an `xIntensity(hours)` next to `birdIntensity()`, call it in `updateSpecialEvents()`, add a CSS variable + layer (copy the `.airplane-layer` pattern) |
| Mobile layout | the `@media (max-width: 640px)` and `@media (max-height: 460px)` blocks in `style.css` |
| Number of stars / fireflies | the loop counts in `buildStars()` / `buildFireflies()` |

---

## Live Demo

Deployed here: **https://abuzaid-creative-scene.netlify.app**

To see all 24 hours of the scene at once, in a single tab, open the browser console on any page and paste this. It uses the `?t=` developer time override to open 24 iframes — one per hour — inside one new tab, instead of opening 24 separate tabs:

```js
const urls = Array.from({ length: 24 }, (_, i) =>
  `https://abuzaid-creative-scene.netlify.app/?t=${i + 1}`
);

const w = window.open('about:blank', '_blank');

if (w) {
  urls.forEach(url => w.document.write(
    `<iframe src="${url}" style="width:100%;height:100vh;border:0"></iframe>`
  ));
}
// gives you one tab containing 24 pages, not 24 tabs.
```
