# NORTHLIGHT

A small landscape scene — a cabin on rolling hills — that looks different depending on what time it is on your device, right now, live. This README explains **how it actually works**, using the real function and variable names from the project, so you can study it and confidently explain it later.

---

## 1. What is this project?

**What we built:** a single-page visual scene (sky, sun, moon, hills, a cabin, trees, a few distant houses, clouds, birds, fireflies, stars, an occasional airplane and shooting star) that is drawn entirely with HTML, CSS and JavaScript — no images, no backend, no framework.

**What the user sees:** one continuous landscape. There are no separate "morning page" or "night page" — it's the *same* HTML and CSS the whole time. What changes is a set of *numbers* (colors, positions, opacity values) that get recalculated from the clock.

**How the scene changes with time:** JavaScript reads the visitor's device clock (`new Date()`), turns the current time into a set of numbers (how high the sun is, how bright it should be, what color the sky is, etc.), and writes those numbers into the page. CSS then paints the scene from those numbers. This repeats once every second, so the scene is always in sync with the real clock — open it at 2 AM and it's dark with a moon and stars; open it at noon and it's bright daylight.

**Why HTML + CSS + JavaScript, no React or library:**
- The whole "app" is really just *one state → one render*. There's no navigation, no user input, no data fetching — the only "input" is the current time. That doesn't need a framework's component tree or state management.
- CSS is very good at two things this project needs: smoothly transitioning values, and running animations (clouds drifting, birds flapping) without JavaScript having to touch anything every frame.
- Keeping it framework-free also makes the whole thing easy to read top-to-bottom in three small files — good for learning, and good for explaining in an interview.

---

## 2. Main Project Flow

```
Device Time → JavaScript → Time Calculation → Scene State → CSS Variables → CSS Rendering
```

Step by step, in plain language:

1. **Device Time** — JavaScript asks the browser for the current time using `new Date()`.
2. **JavaScript** — turns that `Date` into a single number: hours as a decimal, like `14.5` for 2:30 PM. This function is `getCurrentTime()`.
3. **Time Calculation** — that decimal-hours number is converted into "where the sun is" using `solarPhase()` and `sunElevation()`. This one number (elevation, from -1 to +1) is the master value almost everything else is built from.
4. **Scene State** — `calculateSceneState()` uses that elevation (plus the time of day) to work out *every* visual value the scene needs: sky colors, sun position, moon position, hill colors, cabin window brightness, cloud color, and more. It returns one plain JavaScript object full of numbers and color strings.
5. **CSS Variables** — `updateScene()` takes that object and writes each value onto the page as a **CSS custom property**, for example `--daylight: 0.583;`. This is the *only* way JavaScript touches the visuals — it never directly repaints or rebuilds anything.
6. **CSS Rendering** — the CSS file reads those variables with `var(--daylight)` (and similar) inside normal CSS rules — gradients, `opacity`, `fill`, positions — and the browser draws the scene.
7. **CSS animations** — anything that should move *by itself* (clouds drifting, birds flapping wings, stars twinkling, fireflies floating) is a plain CSS `@keyframes` animation. JavaScript never animates these frame-by-frame; it only sets how *visible* they should be (their opacity), and CSS keeps them moving on its own.

This whole cycle repeats **once every second** — see `tick()` in [section 5](#5-javascript--the-main-brain), further down.

---

## 3. HTML — What is inside the page?

`index.html` has one `<main class="scene">` that contains every visual layer, stacked in this order (later elements draw on top of earlier ones):

| Element | Purpose |
|---|---|
| `.afterglow` | a warm glow that pools near the horizon at sunrise/sunset |
| `.stars` | the starfield (built by JavaScript, see `buildStars()`) |
| `.birds` → `.flock--a`, `.flock--b` | two independent small groups of birds, morning only |
| `.celestial` → `.sun`, `.moon` | the sun and moon, each with a bright "core" and a soft "glow" |
| `.clouds` (`.cloud--1` … `.cloud--7`) | seven independently-drifting clouds |
| `.airplane-layer` | one rare, faint airplane that crosses the sky during the day |
| `.night-fx` | one rare, faint shooting star, night only |
| `.haze` | a soft horizon-hugging gradient for atmospheric depth |
| `.hills` (an `<svg>`) | four rolling hill layers, plus small trees and 3 tiny distant houses |
| `.cabin` (an `<svg>`) | the main cabin — the focal point of the whole scene |
| `.grass` (an `<svg>`) | the foreground rise, with two soft bushes |
| `.fireflies` | the evening special event, built by `buildFireflies()` |
| `.hud` | the only text on the page: the real clock and the time-of-day label |

**What HTML is responsible for:** just the *structure* — which shapes exist and in what order. HTML never contains a color or a position that depends on time; those all come from CSS reading variables. If you open `index.html` and search for a hex color or a time-based number, you basically won't find one — that's intentional.

**Which parts are SVG, and why:**
`.hills`, `.cabin`, and `.grass` are `<svg>` elements built from `<path>`, `<rect>`, `<polygon>` and `<ellipse>` shapes. SVG is used here because:
- Shapes stay crisp at any screen size (a phone or a huge monitor) — there's no blurring like a stretched image would have.
- A shape's fill color can be controlled from CSS, the same way as any other element: `fill: var(--hill-1);`
- It's tiny — a whole rolling hillside is a few hundred bytes of path coordinates, no image file needed.
- The trees are defined **once** as a reusable `<symbol id="pine">` and then stamped out several times with `<use href="#pine" ...>` at different positions and sizes — one shape, many trees, very little markup.

---

## 4. CSS — How do we create the visual design?

Here are the main CSS techniques this project leans on, and *why* each one is used.

### Gradients
The sky is one `linear-gradient` on `.scene`, using four color stops. The horizon haze and the sunrise/sunset glow are `radial-gradient`s. Gradients let a single element show a smooth blend of colors — exactly what a sky needs — without any image.

```css
.scene {
  background: linear-gradient(to bottom,
    var(--sky-1) 0%, var(--sky-2) 34%, var(--sky-3) 62%, var(--sky-4) 100%);
}
```

### CSS custom properties (`--name`) and `var()`
This is the single most important idea in the whole project. A **custom property** is a variable you can set in JavaScript and read in CSS. JavaScript calculates a value like "how bright is it right now" and stores it as `--daylight`. CSS then reads it anywhere with `var(--daylight)`:

```js
// JavaScript writes the number
document.documentElement.style.setProperty("--daylight", "0.583");
```
```css
/* CSS reads it, wherever it's needed */
.clouds { opacity: var(--cloud-opacity); }
```
This is the *entire bridge* between the JavaScript logic and the CSS visuals — see [section 7](#7-how-javascript-talks-to-css) for more on this.

### `calc()`
Used to build a new value out of an existing variable, without JavaScript needing to calculate yet another number. Example — the distant houses' windows reuse the exact same `--window-glow` value as the main cabin, just dimmed down in CSS:
```css
.hut-window { opacity: calc(var(--window-glow) * 0.55); }
```

### `color-mix()`
A modern CSS function that blends two colors together, right inside CSS. This project uses it so the trees and distant houses can be colored *from the existing hill/cabin colors* — no new JavaScript variables needed at all:
```css
.hut--far .hut-body {
  fill: color-mix(in srgb, var(--cabin-wall) 30%, var(--hill-1) 70%);
}
```
That line means: "mostly the hill's color, with a little of the cabin's color mixed in" — which is exactly what makes a distant house look like it belongs to its hill instead of competing with the real cabin.

### Opacity
Almost every "is this thing visible right now" question is answered with `opacity`, driven by a variable: `--star-opacity`, `--bird-opacity`, `--firefly-opacity`, `--daylight`, `--sun-opacity`, `--cloud-opacity`. Opacity is cheap for the browser to animate (see [section 14](#14-performance-decisions)) and it transitions smoothly, so "fading in" and "fading out" happen for free.

### Transforms
`transform` moves and rotates things without the browser having to recalculate the page layout. Used for: the sun/moon `translate(-50%, -50%)` centering trick, cloud/bird drifting (`translate`), the shooting star and airplane paths, tree/grass sway (`rotate`, `skewX`), and the mirrored bird flock (`scaleX(-1)`).

### Positioning
`.scene` is `position: fixed; inset: 0;` — it always fills the browser window. Every layer inside it is `position: absolute`, positioned with percentages (`left: 23%`) or CSS variables (`left: var(--sun-x)`), so everything scales together when the window resizes.

### SVG styling from CSS
Even though the hills/cabin/trees are SVG shapes, they're styled with ordinary CSS classes, not inline SVG attributes:
```css
.hill--1 { fill: var(--hill-1); }
```
The one exception worth knowing: colors set on a `<use>` element (used for the trees) are inherited *into* the shape it points to, the same way `color` normally inherits in CSS — that's why one `.tree { fill: ... }` rule can color every tree.

### CSS animations (`@keyframes`)
Anything that moves continuously and doesn't need to be time-accurate uses a plain CSS animation — clouds drifting (`@keyframes drift`), birds flapping (`@keyframes flap`), stars twinkling (`@keyframes twinkle`), fireflies floating (`@keyframes fireflyDrift`). These run entirely inside the browser's rendering engine; JavaScript is not involved once they start.

### Responsive media queries
Two `@media` blocks adjust a handful of sizes/positions for small or short screens (see [section 13](#13-responsive-design)).

### `@property`
A way to tell the browser "this custom property is actually a `<color>`", so it can smoothly animate between two colors:
```css
@property --sky-1 { syntax: "<color>"; inherits: true; initial-value: #06080f; }
```
Without this, the browser doesn't know `--sky-1` is a color and can't ease between values — it would just snap. Browsers that don't support `@property` simply skip the smoothing (the color still updates correctly, just in small steps once a second, which is invisible anyway).

### `prefers-reduced-motion`
A media query that detects when a visitor has asked their OS for less motion. This project turns off every `animation` and `transition` in that case, while the scene stays 100% time-accurate (JavaScript still updates every value) — it just stops moving on its own.

---

## 5. JavaScript — The Main Brain

The rule for the whole file: **JavaScript decides the numbers, CSS decides how those numbers look.** JavaScript never creates or moves an element for a visual effect — it only writes CSS variables (plus building the star/firefly DOM once, and updating a few clock text labels).

Below is every important function and constant, in the order they appear in `script.js`.

### Math helpers

#### `clamp(v, lo = 0, hi = 1)`
"What does it do?" Forces a number to stay between `lo` and `hi`. If `v` is smaller than `lo`, returns `lo`. If bigger than `hi`, returns `hi`. Otherwise returns `v` unchanged.
"Why do we need it?" Lots of calculations (like a 0–1 blend amount) must never go outside their valid range, or colors and positions would break.
"Parameters:"
- `v` — the number to clamp
- `lo` — the minimum allowed value (defaults to 0)
- `hi` — the maximum allowed value (defaults to 1)
"Returns:" the clamped number.
"Simple example:" `clamp(1.4)` → `1` (because the default max is 1).
Used inside `smoothstep()` and `arcY()`.

#### `lerp(a, b, k)`
"What does it do?" **L**inear int**erp**olation — finds the point `k` of the way from `a` to `b`.
"Why do we need it?" It's the basic building block for every smooth transition in the project (colors, opacity levels, sizes).
"Parameters:"
- `a` — the start value
- `b` — the end value
- `k` — how far along, from 0 (at `a`) to 1 (at `b`)
"Returns:" the interpolated number.
"Simple example:" `lerp(0, 100, 0.5)` → `50` (halfway between 0 and 100).
Used everywhere a value needs to blend smoothly between a "night" number and a "day" number, e.g. `lerp(0.16, 0.42, daylight)` for the cabin's shadow strength.

#### `smoothstep(e0, e1, x)`
"What does it do?" Turns `x` into a smooth 0→1 ramp between the edges `e0` and `e1`, using an S-curve (it eases in and out, instead of moving at a constant speed like `lerp`). Unlike a typical `smoothstep`, this one also works if `e0` is *bigger* than `e1` — which lets you write "fades out as `x` goes up" without an `if` statement.
"Why do we need it?" It's how the project avoids hard on/off switches. Instead of "stars are ON when it's night", it's "stars smoothly become visible as the sun drops below a certain point."
"Parameters:"
- `e0` — the edge where the result is 0
- `e1` — the edge where the result is 1
- `x` — the value to test
"Returns:" a number from 0 to 1.
"Simple example:" `smoothstep(0.0, -0.18, -0.09)` → `0.5` — halfway between "no stars" and "full stars".
Used constantly in `calculateSceneState()` for `daylight`, `golden`, `starLight`, `sunOpacity`, `moonOpacity`, `windowGlow`, `cloudOpacity`, and in `fireflyIntensity()`/`birdIntensity()`.

#### `mixRGB(c1, c2, k)`
"What does it do?" Blends two `[r, g, b]` color arrays together, channel by channel, using `lerp` on each of the three numbers.
"Why do we need it?" Sky colors, hill colors, cabin colors — everything colorful in this project — are blended this way between a "night" color and a "day" color (or between two sky keyframes).
"Parameters:"
- `c1` — the first color, as `[red, green, blue]`
- `c2` — the second color, as `[red, green, blue]`
- `k` — how far to blend from `c1` toward `c2` (0 to 1)
"Returns:" a new `[r, g, b]` array.
"Simple example:" `mixRGB([0, 0, 0], [100, 100, 100], 0.5)` → `[50, 50, 50]`.
Used inside `skyStops()` and throughout `calculateSceneState()`.

#### `rgb(c)`
"What does it do?" Converts an `[r, g, b]` array into a CSS color string.
"Why do we need it?" CSS custom properties need a real string like `"rgb(50, 50, 50)"`, not a JavaScript array.
"Parameters:"
- `c` — a `[r, g, b]` array (numbers can have decimals; they get rounded)
"Returns:" a string, e.g. `"rgb(50, 50, 50)"`.
"Simple example:" `rgb([12.4, 250, 6])` → `"rgb(12, 250, 6)"`.
Used at the very end of almost every color calculation, right before the value is handed to `updateScene()`.

### Time

#### `getCurrentTime()`
"What does it do?" Returns the current time as a single decimal number of hours, from 0 up to (but not including) 24.
"Why do we need it?" Every other calculation in the project starts from this one number.
"Parameters:" none.
"Returns:" a number like `14.5` for 2:30 PM.
"Simple example:"
```js
// If forcedHours is set (see the ?t= override below), that wins.
// Otherwise: real device time.
const d = new Date();
d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
```
Called once per tick, at the very start of `tick()`.

#### `forcedHours` (constant)
"What is it?" A value read once, when the page first loads, from the `?t=` URL parameter (see [section 10](#10-developer-time-override)). It's `null` if there's no `?t=` in the URL, otherwise it's the number after `t=` (wrapped into the 0–24 range).
"Why do we need it?" So `getCurrentTime()` can be forced to a specific test time during development, without changing the computer's clock.

### Sun / moon geometry

#### `SUNRISE`, `SUNSET` (constants)
`SUNRISE = 6` and `SUNSET = 18.75` (6:00 AM and 6:45 PM). These are the two numbers that define how long the "day" half of the cycle is. Change these two numbers and the whole sunrise/sunset timing of the scene moves with them.

#### `solarPhase(hours)`
"What does it do?" Converts real clock hours into a **phase** from 0 to 1 that always has sunrise at phase `0.25` and sunset at phase `0.75` — regardless of how long the day actually is. During the day, phase moves from 0.25 to 0.75; during the night, it continues from 0.75 up to 1.25 (wrapped back to 0–1).
"Why do we need it?" It lets the day be a *different length* than the night (12.75 hours of day, 11.25 hours of night here) while still reusing one simple `sin()` formula for the sun's height. The math is written so the phase value doesn't jump at sunrise, sunset, or midnight — it's continuous everywhere.
"Parameters:"
- `hours` — decimal hours, 0–24
"Returns:" a phase number, roughly 0 to 1 (can briefly reach just above 1 right before wrapping).
"Simple example:" `solarPhase(6)` → `0.25` (sunrise). `solarPhase(18.75)` → `0.75` (sunset).
Called at the top of `calculateSceneState()`; its result feeds `sunElevation()`, `arcX()` for both the sun and moon.

#### `sunElevation(phase)`
"What does it do?" Turns the phase into "how high the sun is": `-1` at the deepest point of night, `0` right at sunrise/sunset, `+1` at the highest point of the day.
"Why do we need it?" This single number — usually just called `elev` in the code — is the master input almost the entire scene is calculated from (sky color, daylight amount, star visibility, sun/moon opacity, cabin window glow…).
"Parameters:"
- `phase` — the 0–1 value from `solarPhase()`
"Returns:" a number from -1 to 1.
"Simple example:" `sunElevation(0.5)` → `1` (the middle of the day phase range is the highest point).
Called once per tick inside `calculateSceneState()`.

#### `arcX(phase, offset)`
"What does it do?" Calculates the **horizontal** position (as a percentage, 0–100) of the sun or moon, so they rise on the left and set on the right.
"Why do we need it?" It's what makes the sun/moon actually travel across the sky instead of just fading in place.
"Parameters:"
- `phase` — the current solar phase
- `offset` — `0.25` for the sun, `0.75` for the moon (12 hours / half a cycle apart). This is the phase where that body sits at its *leftmost* point (its rise).
"Returns:" a percentage from about 4% (far left / rising) to 96% (far right / setting).
"Simple example:" `arcX(0.25, 0.25)` → `4` — at sunrise (`phase = 0.25`), the sun's phase equals its own offset, which is exactly where the formula places it at its leftmost point. `arcX(0.5, 0.25)` → `50` — at solar noon, the sun is centered overhead. `arcX(0.75, 0.25)` → `96` — at sunset, the sun is far to the right. The moon uses the same formula with `offset = 0.75`, so *it* sits leftmost (rising) at sunset and centered at solar midnight — see the worked example in [section 6](#6-most-important-concept-time--scene).
Called twice per tick: once for the sun, once for the moon.

#### `arcY(elev)`
"What does it do?" Calculates the **vertical** position (percentage) of the sun or moon from its elevation: near the top of the sky when elevation is high, near the horizon when elevation is near 0, and pushed off-screen (below 100%) when elevation is very negative.
"Why do we need it?" So the sun/moon rises and sets in a curved arc instead of a flat line.
"Parameters:"
- `elev` — an elevation value, -1 to 1 (pass `-elev` for the moon, since it's opposite the sun)
"Returns:" a percentage from 4% (near the top) up to 128% (safely below the visible screen).
"Simple example:" `arcY(1)` → `8` (very near the top, at the sun's highest point).
Called for both the sun (`arcY(elev)`) and the moon (`arcY(-elev)`).

### Sky color

#### `SKY_KEYS` (constant)
"What is it?" An array of 8 "keyframes" — hand-picked sky colors for 8 different sun elevations, from `-1.00` (deep night) to `1.00` (midday). Each keyframe has 4 colors: the top of the sky, upper-middle, lower-middle, and the horizon.
"Why do we need it?" Instead of calculating a sky color with a formula, this project uses *designed* colors at key moments (a real designer chose these), and blends smoothly between the two nearest ones. This is the same idea as keyframes in a video-editing timeline or an animation tool.

#### `skyStops(elev)`
"What does it do?" Finds the two `SKY_KEYS` entries the current elevation sits between, and blends their 4 colors together using `smoothstep()` (for the blend amount) and `mixRGB()` (for each of the 4 colors).
"Why do we need it?" This is what turns 8 fixed "postcard" sky colors into an infinitely smooth gradient that changes with every second of the day.
"Parameters:"
- `elev` — the current sun elevation
"Returns:" an array of four `[r, g, b]` colors — `[top, upperMid, lowerMid, horizon]`.
"Simple example:" `skyStops(1.0)` returns exactly the midday keyframe's 4 colors (no blending needed, since `1.0` is already a keyframe). `skyStops(0.6)` returns a blend of the `0.55` and `1.00` keyframes.
Called once per tick, inside `calculateSceneState()`.

### The big one

#### `calculateSceneState(hours)`
"What does it do?" This is the function that turns "what time is it" into "what should the whole scene look like." It calls `solarPhase()` and `sunElevation()`, then uses those (plus `smoothstep`, `lerp`, `mixRGB`, `rgb`, and `skyStops`) to build one large object with every color, position and opacity the scene needs — sky, sun, moon, haze, hills, meadow, cabin, clouds, birds.
"Why do we need it?" It keeps *all* the visual decision-making in one place, as a **pure function** — same input always gives the same output, no side effects, nothing written to the page yet. That makes it easy to test (see the note in [section 18](#18-important-lessons-from-this-project)) and easy to reason about.
"Parameters:"
- `hours` — decimal hours, 0–24 (normally whatever `getCurrentTime()` returned)
"Returns:" a plain object, for example (shortened):
```js
// this is the real output of calculateSceneState(12) — verified, not approximated
{
  elev: 0.996, daylight: 1, golden: 0,
  sky: [[46,118,214], [92,166,228], [150,200,236], [198,226,243]],
  sunX: 45.76, sunY: 8.25, sunOpacity: 1, sunCore: "rgb(255,246,226)",
  hill1: "rgb(126,150,164)", meadow: "rgb(40,74,42)",
  windowGlow: 0, cloudOpacity: 0.9, ...
}
```
Called once per tick, and its result is handed straight to `updateScene()`.

### Applying the state

#### `updateScene(s)`
"What does it do?" Takes the object returned by `calculateSceneState()` and writes each value onto the page as a CSS custom property, using `root.style.setProperty(name, value)`.
"Why do we need it?" This is the one and only place JavaScript "touches" the visuals. Everything before this function only calculated *numbers*; this function is what actually hands them to CSS.
"Parameters:"
- `s` — the scene-state object from `calculateSceneState()`
"Returns:" nothing (it's an action, not a calculation).
"Simple example:" internally, it does things like:
```js
S("--daylight", s.daylight.toFixed(3));      // e.g. "--daylight: 1.000"
S("--hill-1", s.hill1);                       // e.g. "--hill-1: rgb(126,150,164)"
```
(`S` is a tiny local helper: `const S = (name, value) => root.style.setProperty(name, value);`)
Writes about 33 custom properties in total. Called once per tick, from `tick()`.

#### `updateSpecialEvents(hours)`
"What does it do?" Calculates and writes two more CSS variables: `--firefly-opacity` (using `fireflyIntensity(hours)`) and `--bird-opacity` (using `birdIntensity(hours)`).
"Why do we need it?" These two events (birds, fireflies) are kept separate from `calculateSceneState()`/`updateScene()` because they're not really about *lighting* — they're short, self-contained time windows layered on top.
"Parameters:"
- `hours` — decimal hours, 0–24
"Returns:" nothing.
"Simple example:" at `hours = 19.2` (7:12 PM), this sets `--firefly-opacity` to something close to `1` and `--bird-opacity` to `0`.
Called once per tick, from `tick()`.

*(Two small helper functions worth knowing, since `updateSpecialEvents()` depends on them:)*

- **`fireflyIntensity(hours)`** — returns 0 outside the window `18.75`–`19.7`, and inside it, a smooth 0→1→0 hump using `Math.sin(progress * Math.PI)`. This is what makes fireflies fade in, peak, and fade out instead of switching on and off.
- **`birdIntensity(hours)`** — returns `smoothstep(6.3, 6.95, hours) * (1 - smoothstep(8.0, 8.6, hours))`. This is two smoothsteps *multiplied together*: the first ramps up near sunrise, the second ramps back down mid-morning, and multiplying them makes a smooth "on, then off" plateau shape.

#### `updateClock(hours)`
"What does it do?" Updates the visible clock text (`7:12`, `PM`, seconds) and the time-of-day label (`"TWILIGHT"`, etc.) shown in the `.hud` element.
"Why do we need it?" This is the *only* part of the project that changes plain text instead of a CSS variable — because a clock has to display actual digits, which CSS variables can't format on their own.
"Parameters:"
- `hours` — decimal hours, 0–24
"Returns:" nothing.
"Simple example:" for `hours = 19.2`, it sets the DOM text to `"7:12"`, `"PM"`, `"00"`, and label `"TWILIGHT"`.
Uses a small helper, `timeOfDayLabel(hours)`, which just checks `hours` against a list of boundaries (`LABELS`) and returns a matching text label — this label is **only text**; it never controls any visual value, so there's no hard "snap" in the scene itself when the label changes.
Called once per tick, from `tick()`.

#### `tick()`
"What does it do?" Runs one full update: gets the current time, then calls `updateScene()`, `updateSpecialEvents()`, and `updateClock()` with it.
"Why do we need it?" It's the single entry point that ties the whole system together — "do one frame of updates, right now."
"Parameters:" none.
"Returns:" nothing.
"Simple example:"
```js
function tick() {
  const hours = getCurrentTime();
  updateScene(calculateSceneState(hours));
  updateSpecialEvents(hours);
  updateClock(hours);
}
```
Called once immediately when the page loads (for the correct first frame), then again every second by `setInterval(tick, 1000)`, and again whenever the tab becomes visible or the window is focused.

### DOM builders (run once)

#### `buildStars()` / `buildFireflies()`
These two functions create the star and firefly elements — 74 stars, 18 fireflies — **once**, when the page first loads, each with random position/size/timing set directly as inline styles. After that, JavaScript never creates or removes them again; only their *container's* opacity (`--star-opacity`, `--firefly-opacity`) changes over time.

---

## 6. Most Important Concept: Time → Scene

Let's trace exactly what happens for **12:00 PM**.

1. `getCurrentTime()` reads the device clock and returns `12` (or `12.0001` — seconds included).
2. `solarPhase(12)` remaps that into the 0–1 phase system: since 12 is between `SUNRISE` (6) and `SUNSET` (18.75), it lands at phase ≈ `0.485` (close to `0.5`, the middle of the day).
3. `sunElevation(0.485)` → `Math.sin((0.485 - 0.25) * 2π)` ≈ `0.996` — almost the highest possible value (1 is the peak, reached a little after noon, around 12:22, because the day is centered on the *middle* of the 6:00–18:45 window).
4. `skyStops(0.996)` finds this is essentially the `1.00` "midday" keyframe in `SKY_KEYS`, and returns that keyframe's 4 blue sky colors almost unchanged.
5. `calculateSceneState(12)` uses that elevation to also compute: `daylight ≈ 1` (full brightness), `golden ≈ 0` (no sunset warmth), `starLight = 0` (no stars), sun position near the top-center of the sky, hill colors at their brightest greens, cabin window **not** glowing.
6. `updateScene()` writes all of that as CSS variables: `--daylight: 1.000`, `--sky-1: rgb(46, 118, 214)`, `--sun-y: 8.25%`, etc.
7. CSS instantly repaints: the sky gradient shows deep blue, the sun sits high and bright, hills are green, no stars, no window glow.

Now compare a few other times, using the same 7 steps but different numbers:

| Time | Elevation (`elev`) | What you'd see |
|---|---|---|
| **6:00 AM** | `0` (exactly sunrise) | Sky mid-blend between night and day palettes, sun right at the eastern (left) horizon, `daylight ≈ 0.58` and rising, `golden = 1` (peak warm glow), stars already fully faded (their fade-out finishes just before sunrise) |
| **12:00 PM** | `≈ 0.996` | Full bright blue sky, sun near the top, `daylight = 1`, no stars, cabin window off |
| **6:45 PM** | `0` (exactly sunset, `SUNSET`) | Same elevation as sunrise but sun now setting on the western (right) horizon, `golden = 1` (same peak warm glow as sunrise), `daylight ≈ 0.58` and falling, cabin window starting to warm up, fireflies about to begin (their window starts exactly here, `18.75`) |
| **9:00 PM** | `≈ -0.588` | Fully dark sky, `daylight = 0`, `starLight = 1` (stars fully out), moon visible, cabin window fully warm, fireflies long finished, no birds |

The key idea: **the HTML never changes.** The same `<div class="sun">` and the same `<svg class="hills">` are on the page at 6 AM, noon, 6:45 PM and 9 PM. Only the *numbers* JavaScript calculated (and wrote as CSS variables) are different, and CSS reads those different numbers to paint a completely different-looking scene from identical markup.

---

## 7. How JavaScript Talks to CSS

This is the core trick of the whole project, so here it is in isolation.

JavaScript never says "make the sky blue" or "hide the stars." It only ever does this:
```js
document.documentElement.style.setProperty("--daylight", "0.583");
```
That line sets a custom property called `--daylight` to `0.583`, on the `<html>` element (`document.documentElement`, saved in the code as the `root` constant). Because `<html>` is the ancestor of the entire page, every single element can read that variable.

CSS then reacts to it, wherever it's relevant:
```css
.clouds { opacity: var(--cloud-opacity); }
.stars  { opacity: var(--star-opacity); }
```

**JavaScript does not redraw the page.** It never creates a new element, removes one, or changes a class for a visual effect. It changes a small set of *numbers*, and CSS — which was already sitting there, already knowing what to do with each variable — reacts automatically. This is exactly like changing a spreadsheet cell that other cells reference: you don't rebuild the spreadsheet, you just update one number and everything that depends on it recalculates.

**Why this is good for performance:** setting a CSS custom property is extremely cheap — no DOM nodes are created, measured, or removed. The browser only has to repaint (recolor pixels), not "reflow" (recalculate the entire page's layout).

**Why this is good for maintainability:** the visual design (CSS) and the time logic (JavaScript) are completely separated. You can redesign what "daylight" looks like — brighter greens, different sky colors — by only editing `style.css`, without touching a single line of `script.js`. That separation is also why the [enhancement pass that added trees, distant houses, an airplane, and a shooting star](#12-special-time-based-events) needed **zero changes to `script.js`** — they were built entirely by reusing variables that already existed.

---

## 8. Continuous Day/Night Transition

A simpler version of this project might have four fixed states — `"morning"`, `"day"`, `"evening"`, `"night"` — and switch between them with `if`/`else`. That would cause visible "jumps" the moment the clock crosses a boundary (imagine the sky instantly snapping from orange to black at 8:00:00 PM).

Instead, this project treats time as a **continuous number line** and always calculates in-between values:

- `lerp(a, b, k)` finds a point *between* two numbers. `lerp(0, 100, 0.5)` → `50`: visually, this means "a color exactly halfway between color A and color B," not "color A, then suddenly color B."
- `smoothstep(e0, e1, x)` is a smoother version of the same idea — it eases in and out instead of moving at a constant rate, so a transition (like stars fading in) doesn't start or stop abruptly.
- `skyStops()` blends between the *nearest two* of the 8 hand-picked `SKY_KEYS` colors, using the sun's exact elevation as the blend amount — so there are effectively infinite sky colors between any two keyframes, not just 8 fixed skies.
- The sun and moon don't jump between fixed spots — `arcX()`/`arcY()` calculate their exact position from the *continuous* elevation/phase value, so they glide along a smooth arc.

Because `getCurrentTime()` changes by a tiny amount every second, and every one of these functions responds smoothly to small input changes, the whole scene drifts gradually rather than jumping — there is no moment where anything visually "switches."

(The one exception is the time-of-day **label text**, like `"MORNING"` or `"TWILIGHT"` — that's just a word on screen, decided by `timeOfDayLabel()`, and it's fine for a *word* to change abruptly, since no visual property depends on it.)

---

## 9. Why There Is No Flash on Page Load

A common bug in "time of day" scenes is: the page loads showing a default (often daytime) look, and only a moment later does JavaScript run and correct it to the real time — so if you open the page at 2 AM, you'd briefly see a bright blue sky before it switches to night. This project avoids that entirely.

Here's how:

1. **The scene must know the correct time immediately.** `script.js` is loaded with a normal `<script src="script.js">` tag at the very end of `<body>` — not `defer`, not `async`. That means it runs, and finishes running, *before* the browser paints anything on screen.
2. **The first `tick()` runs synchronously**, right when the script loads:
   ```js
   buildStars();
   buildFireflies();
   tick();   // <-- correct scene state, calculated before the first paint
   ```
   By the time the browser is ready to paint the first frame, every CSS variable already holds the *correct*, real-time value.
3. **`.booting` disables every transition for that first frame.** `<html>` starts with `class="booting"` already in the HTML:
   ```html
   <html lang="en" class="booting">
   ```
   And in CSS:
   ```css
   .booting, .booting *, .booting *::before, .booting *::after {
     transition: none !important;
   }
   ```
   Without this, even though the *values* would be correct immediately, CSS `transition`s (like the sky's 1-second color fade) would still animate *from* the default `:root` values (which describe a plain night sky) *to* the real values — causing a brief, visible "wrong" flash before settling.
4. **`.booting` is removed right after the first frame paints:**
   ```js
   requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("booting")));
   ```
   Waiting two animation frames (not just one) guarantees the browser has actually painted the correct first frame *before* transitions are switched back on. From that point on, every future update (once per second) eases smoothly, because there's no longer a "wrong starting point" to transition away from.

The result: whatever time you open the page, the very first pixels drawn are already correct — night stays night, noon stays noon, with no warm-up period.

---

## 10. Developer Time Override

Testing "what does the page look like at 3 AM" is hard if you'd have to change your computer's clock. Instead, this project supports a URL parameter:

```
index.html?t=7.25
```

`?t=` takes **decimal hours** (not `HH:MM`), and `getCurrentTime()` uses it instead of the real clock, for the rest of that page load:

```js
const forcedHours = (() => {
  const raw = new URLSearchParams(location.search).get("t");
  const n = raw === null ? NaN : parseFloat(raw);
  return Number.isNaN(n) ? null : ((n % 24) + 24) % 24;
})();
```

Some example values:

| URL | Meaning |
|---|---|
| `?t=2` | 2:00 AM — deep night, moon and stars, no clouds |
| `?t=6.5` | 6:30 AM — just after sunrise, warm low sun, morning birds active |
| `?t=12` | 12:00 PM — near solar noon, brightest sky |
| `?t=17.75` | 5:45 PM — golden hour, warm low sun, long shadows |
| `?t=18.5` | 6:30 PM — sunset, warm horizon, cabin window starting to glow |
| `?t=21` | 9:00 PM — full night, stars, moon, warm cabin/house windows |

**In normal production use, `?t=` is simply absent from the URL.** When `forcedHours` is `null` (no `?t=` param, or an invalid one), `getCurrentTime()` falls straight back to `new Date()` — real device time, exactly as a real visitor would see it. Nothing about the override affects normal behavior; it's purely an opt-in testing tool.

---

## 11. Animation Architecture

**JavaScript's job:**
- Reads the current time (`getCurrentTime()`).
- Calculates what the scene *should* look like right now (`calculateSceneState()`, `fireflyIntensity()`, `birdIntensity()`, `timeOfDayLabel()`).
- Writes those results into CSS variables and a few text nodes (`updateScene()`, `updateSpecialEvents()`, `updateClock()`).
- Runs this whole cycle roughly **once per second** (`setInterval(tick, 1000)`), plus once immediately on load and again whenever the tab regains focus.

**CSS's job — everything that should move *by itself*, continuously, without needing to know the exact time:**
- Clouds drifting (`@keyframes drift`, `driftBob`)
- Birds flying and flapping their wings (`@keyframes flyAcross`, `flyAcrossB`, `flap`, `flapR`)
- Tree and grass swaying (`@keyframes treeSway`, `sway`)
- Fireflies floating and pulsing (`@keyframes fireflyDrift`, `fireflyPulse`)
- Stars twinkling (`@keyframes twinkle`)
- The rare airplane and shooting star paths (`@keyframes planeCross`, `shoot`)

**Why not update everything from JavaScript on every animation frame?** Two reasons:
1. **It's unnecessary.** The sun's position, the sky color — these change so slowly (the sun moves less than 0.01% of the screen per second) that updating them 60 times a second would be a total waste; once a second is already far smoother than the eye can tell apart from continuous motion.
2. **CSS animations are cheaper and smoother.** Once a `@keyframes` animation is running, the browser's own compositor handles it — JavaScript doesn't have to run at all for a cloud to keep drifting. That's both better for battery life and guarantees smooth motion even if the JavaScript thread is busy doing something else.

So: JavaScript occasionally updates *"how things should currently be"* (mostly opacity, color, and position values), and CSS continuously animates the *idle motion* on top of whatever JavaScript last set.

---

## 12. Special Time-Based Events

| Event | Time window | Driven by |
|---|---|---|
| **Birds** | ~06:18–08:36 (fades in/out) | `birdIntensity(hours)` → `--bird-opacity`, read by `.birds { opacity: var(--bird-opacity); }` |
| **Fireflies** | 18:45–19:42 | `fireflyIntensity(hours)` → `--firefly-opacity`, read by `.fireflies { opacity: var(--firefly-opacity); }` |
| **Airplane** | rare, daytime only | opacity tied directly to the existing `--daylight` variable — `.airplane-layer { opacity: var(--daylight); }` — combined with a long, mostly-invisible CSS animation cycle (`@keyframes planeCross`, 300 seconds, visible for only about 45 of them) |
| **Shooting star** | rare, night only | opacity tied directly to the existing `--star-opacity` variable, combined with a long CSS animation cycle (`@keyframes shoot`, 95 seconds, visible for about 1 of them) |
| **Clouds** | continuous, but fade out at night | `cloudOpacity: smoothstep(0.05, 0.5, daylight) * 0.9` in `calculateSceneState()` |
| **Distant house lights** | continuous, brighter at night | reuse the cabin's own `--window-glow` variable, just dimmed: `.hut-window { opacity: calc(var(--window-glow) * 0.55); }` |

Two things worth noticing:
- Birds and fireflies are calculated with dedicated JavaScript functions, because their timing (a specific hour window) needed to be precise and easy to tune.
- The airplane, shooting star, and distant house lights needed **no new JavaScript at all** — they simply read variables that `calculateSceneState()` was already producing for other reasons (`--daylight`, `--star-opacity`, `--window-glow`). This is a good example of designing a small set of "meaningful" variables that many different visual elements can plug into.

---

## 13. Responsive Design

The scene works on desktop, mobile portrait, and mobile landscape using a few techniques:

- **`.scene { position: fixed; inset: 0; }`** — always exactly fills the browser window, on any device, with `overflow: hidden` on `body` so there's never a scrollbar.
- **`clamp(min, preferred, max)`** — used for the sun, moon, cabin, birds, and clock text sizes, e.g. `width: clamp(40px, 6.2vmin, 66px)`. This means "never smaller than 40px, never bigger than 66px, but otherwise scale with the viewport" — so elements shrink gracefully on small screens without needing a separate breakpoint rule for size.
- **`preserveAspectRatio="none"` on the hill/grass SVGs** — lets those shapes stretch to fill the full width at any aspect ratio, which keeps the cabin's grounding position (a fixed percentage) reliable across screen shapes.
- **Two `@media` breakpoints** in `style.css`, section 15:
  - `@media (max-width: 640px)` — shrinks the hills, repositions the cabin, and adjusts the haze for narrow phone screens.
  - `@media (max-height: 460px)` — for short/landscape phone screens, gives the ground more vertical room and raises the cabin and bird flock so they aren't squeezed too close to the bottom edge.

---

## 14. Performance Decisions

- **No external libraries, no framework, no backend** — nothing to download, parse, or wait on besides the three files themselves.
- **No unnecessary DOM rebuilding** — stars and fireflies are created **once** (`buildStars()`, `buildFireflies()`); after that, JavaScript never adds or removes an element for a visual effect, ever.
- **CSS handles all continuous animation** — clouds, birds, trees, fireflies, stars all animate via `@keyframes`, entirely on the browser's compositor, without JavaScript running per-frame.
- **JavaScript updates about once per second**, not on every animation frame — `setInterval(tick, 1000)`, which is more than fast enough for values that change this slowly, and far cheaper than 60 updates a second.
- **SVG instead of images** — the hills, cabin, trees, and houses are small vector shapes (a few hundred bytes of coordinates each), not image files, so there's nothing to load, decode, or scale-blur.
- **CSS `transform`/`opacity` are preferred for animation** — both can be animated by the browser's compositor without recalculating page layout, which keeps everything smooth even on modest devices.

---

## 15. Folder/File Structure

```text
creative-ad/
├── index.html   — the page structure: one <main class="scene"> with every visual layer inside it
├── style.css    — all visual design: gradients, colors-from-variables, shapes, and every animation
├── script.js    — all time logic: reads the clock, calculates the scene, writes CSS variables
└── README.md    — this file
```

That's the entire project — three files, no build step, no dependencies. Opening `index.html` directly in a browser (or through something like VS Code's Live Server) runs the whole thing exactly as described above.

---

## 16. Complete Execution Flow

```
Browser loads index.html
        ↓
CSS applies immediately — :root custom properties give safe "night" defaults,
so even before JavaScript runs, nothing looks broken
        ↓
script.js runs (at the end of <body>, so this happens before the first paint)
        ↓
buildStars() and buildFireflies() create their DOM elements once
        ↓
tick() runs for the first time, synchronously:
        ↓
   getCurrentTime()        → decimal hours, e.g. 19.2
        ↓
   calculateSceneState()   → one object with every color/position/opacity value
        ↓
   updateScene()            → writes ~33 CSS custom properties onto <html>
   updateSpecialEvents()    → writes --firefly-opacity and --bird-opacity
   updateClock()            → updates the visible clock text and label
        ↓
CSS variables have now changed
        ↓
CSS renders the correct scene — the very first frame the visitor sees
        ↓
.booting is removed (after two requestAnimationFrame callbacks),
so future updates ease smoothly instead of snapping
        ↓
setInterval fires tick() again, once every second
        ↓
Scene continuously follows local time, forever, while the page stays open
```

---

## 17. If I Want to Modify Something Later

| I want to... | Edit this |
|---|---|
| Change the sky colors | the `SKY_KEYS` array in `script.js` (each entry is `{ e: elevation, c: [top, upperMid, lowerMid, horizon] }`) |
| Change sunrise time | the `SUNRISE` constant in `script.js` |
| Change sunset time | the `SUNSET` constant in `script.js` |
| Change the sun/moon's path across the sky | `arcX()` and `arcY()` in `script.js` |
| Change the cabin's appearance | the `<div class="cabin">` SVG shapes in `index.html`, and the `.cabin-wall` / `.cabin-roof` / `.cabin-door` / `.cabin-window` rules in `style.css` |
| Add another time-based event (like birds/fireflies) | write a new `xIntensity(hours)` function next to `fireflyIntensity()` / `birdIntensity()` in `script.js`, call it inside `updateSpecialEvents()`, add a matching CSS variable, and add the HTML/CSS layer for it (the `.airplane-layer` pattern is the simplest template — it needed zero new JavaScript, only a variable that already existed) |
| Change how fast something animates | the `--dur` / `--delay` values on each element in `style.css` (e.g. `.cloud--1 { --dur: 132s; }`), or the duration written directly in an `animation:` shorthand (e.g. `.flock--a { animation: flyAcross 72s ...; }`) |
| Change the mobile/small-screen layout | the `@media (max-width: 640px)` and `@media (max-height: 460px)` blocks in `style.css`, section 15 |
| Change how many stars/fireflies appear | the loop counts inside `buildStars()` (`i < 74`) and `buildFireflies()` (`i < 18`) in `script.js` |
| Change the on-screen clock/label text or wording | `updateClock()` and the `LABELS` array in `script.js` |

---

## 18. Important Lessons From This Project

1. **Separate logic from presentation.** JavaScript never touches the DOM for visuals — it only ever writes numbers (CSS variables). CSS owns every visual decision. This separation is what let a whole later pass (trees, houses, airplane, shooting star) get added with **zero changes to the JavaScript file**.
2. **Pure functions are easier to trust.** `calculateSceneState(hours)` always returns the same thing for the same input, with no side effects — that made it possible to test the whole scene's logic with plain numeric assertions, without a browser.
3. **Interpolation beats hard states.** `lerp()` and `smoothstep()`, applied to a continuously-changing input (the clock), are what make a "day/night cycle" feel alive instead of a slideshow of four fixed scenes.
4. **CSS custom properties are a real JS↔CSS API.** `element.style.setProperty("--x", value)` + `var(--x)` in CSS is a clean, fast, framework-free way to connect application state to visual output.
5. **Let the browser do what it's good at.** Idle motion (drifting, flapping, twinkling) belongs in CSS `@keyframes`, not a JavaScript animation loop — it's smoother and cheaper.
6. **SVG is a lightweight way to draw shapes.** No image files, crisp at any size, and stylable with ordinary CSS classes and variables just like any other element.
7. **Design for the first frame, not just the "normal" state.** The `.booting` class exists purely to solve a problem that only happens once, for a fraction of a second, on page load — but it's the difference between a polished result and a visible glitch.
8. **A small number of well-chosen variables goes a long way.** `--daylight`, `--star-opacity`, and `--window-glow` were originally built for the sky/cabin, but later reused as-is to drive the airplane, shooting star, and distant houses — good state design pays off when you extend a project.
9. **Progressive enhancement is free with the right approach.** `@property` and `color-mix()` add polish (smooth color transitions, blended tree/house colors) but degrade gracefully if a browser doesn't support them — the scene never breaks, it just loses a little smoothing.
10. **Respect `prefers-reduced-motion`.** Accessibility doesn't have to mean "turn off the feature" — the scene stays fully time-accurate under reduced motion, it just stops the idle animations.
11. **Developer-only test hooks (`?t=`) should be truly opt-in.** The override only activates if the URL parameter is present and valid; with it absent, behavior is 100% unchanged from a normal visitor's experience.
12. **A one-second update loop is often enough.** Not everything needs `requestAnimationFrame` — matching your update rate to how fast the underlying value actually changes avoids wasted work.

---

## Live Demo

Deployed here: **https://abuzaid-creative-scene.netlify.app**

To see all 24 hours of the scene at once, in a single tab, open the browser console on any page and paste this. It uses the `?t=` [developer time override](#10-developer-time-override) to open 24 iframes — one per hour — inside one new tab, instead of opening 24 separate tabs:

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
