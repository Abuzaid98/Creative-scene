"use strict";

/* ============================================================
   NORTHLIGHT — the whole scene is a pure function of local time.

     getCurrentTime()      -> hours in [0, 24)
     calculateSceneState() -> plain object of numbers (colours, light, positions)
     updateScene()         -> writes the CSS custom properties on <html>
     updateSpecialEvents() -> firefly + bird opacity from their time windows
     updateClock()         -> the on-screen clock + time-of-day label
     tick()                -> runs all of the above, once per second

   CSS reads those properties and does every bit of rendering and
   all the continuous idle motion. JS never rebuilds DOM per frame.
   ============================================================ */

/* ---------- Math helpers ---------- */

// Keeps a number inside a range.
// Takes a value, a low limit and a high limit (default 0..1).
// Returns the value, but never below `lo` or above `hi`.
const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

// Linear interpolation.
// Takes a start value `a`, an end value `b` and a progress `k` from 0 to 1.
// Returns the value that is `k` of the way from `a` to `b`. lerp(0,100,0.5) = 50.
const lerp = (a, b, k) => a + (b - a) * k;

// Smooth 0..1 ramp used to fade things in/out gently instead of a hard switch.
// Takes two edge values and an input `x`; returns 0 at edge `e0`, 1 at edge `e1`,
// eased in between. Also works when e0 > e1 ("fades out as x rises"), no `if` needed.
function smoothstep(e0, e1, x) {
  const k = clamp((x - e0) / (e1 - e0));
  return k * k * (3 - 2 * k);
}

// Blends two colours.
// Takes two [r,g,b] arrays and a mix amount `k` (0 = first colour, 1 = second).
// Returns a new [r,g,b] array.
const mixRGB = (c1, c2, k) => [
  Math.round(lerp(c1[0], c2[0], k)),
  Math.round(lerp(c1[1], c2[1], k)),
  Math.round(lerp(c1[2], c2[2], k)),
];

// Turns an [r,g,b] array into a CSS colour string, e.g. "rgb(20, 30, 40)".
const rgb = (c) =>
  `rgb(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])})`;

/* ---------- 1. Current local time ---------- */

// Developer preview: append ?t=6.5 to the URL to see 06:30. Absent in
// normal use, so production is always the real device clock.
const forcedHours = (() => {
  const raw = new URLSearchParams(location.search).get("t");
  const n = raw === null ? NaN : parseFloat(raw);
  return Number.isNaN(n) ? null : ((n % 24) + 24) % 24;
})();

// Gives the current local time as decimal hours (14.5 means 2:30 PM).
// Uses ?t= if it is set, otherwise the real device clock.
// This one number is the only input the whole scene is built from.
function getCurrentTime() {
  if (forcedHours !== null) return forcedHours;
  const d = new Date();
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
}

/* ---------- 2. Sun / moon geometry ---------- */

const SUNRISE = 6, SUNSET = 18.75;

// Takes the time as decimal hours.
// Returns a "solar phase" where sunrise is always 0.25 and sunset always 0.75,
// no matter how long the real day is. This lets the day be longer than the
// night while the sun still follows one simple sine curve. The value is
// continuous at sunrise, sunset and midnight, so nothing ever jumps.
function solarPhase(hours) {
  if (hours >= SUNRISE && hours < SUNSET) {
    return 0.25 + 0.5 * (hours - SUNRISE) / (SUNSET - SUNRISE);
  }
  const nightLen = 24 - (SUNSET - SUNRISE);
  const into = hours < SUNRISE ? hours + (24 - SUNSET) : hours - SUNSET;
  return (0.75 + 0.5 * (into / nightLen)) % 1;
}

// Takes the solar phase. Returns how high the sun is:
// -1 at deep night, 0 at sunrise/sunset, +1 at midday.
// Almost every colour and light value in the scene is derived from this.
const sunElevation = (phase) => Math.sin((phase - 0.25) * 2 * Math.PI);

// Takes the solar phase and an offset (0.25 for the sun, 0.75 for the moon).
// Returns the left-right screen position (%), so the body rises on the left
// and sets on the right.
const arcX = (phase, offset) => 50 - 46 * Math.cos((phase - offset) * 2 * Math.PI);

// Takes an elevation value. Returns the up-down screen position (%):
// near the top when high, near the horizon at sunrise/sunset,
// pushed off-screen once the body is well below the horizon.
const arcY = (elev) => clamp(66 - 58 * elev, 4, 128);

/* ---------- 3. Sky palette keyframes (keyed by sun elevation) ----------
   Four vertical stops per frame: zenith, upper, lower, horizon.
   Because elevation is symmetric, dawn and dusk share a palette — the
   difference the eye reads is the sun/moon position and the warm afterglow. */
const SKY_KEYS = [
  { e: -1.00, c: [[6, 8, 16],    [10, 13, 26],   [17, 21, 42],   [24, 28, 52]]   }, // deep night
  { e: -0.30, c: [[10, 14, 30],  [17, 22, 46],   [30, 33, 66],   [50, 46, 88]]   }, // night → astro
  { e: -0.12, c: [[26, 33, 62],  [45, 47, 92],   [92, 74, 122],  [156, 100, 120]] }, // pre-dawn / twilight
  { e: -0.03, c: [[46, 66, 120], [96, 108, 152], [190, 132, 120], [255, 150, 96]]  }, // civil, horizon on fire
  { e:  0.06, c: [[70, 120, 178],[142, 152, 178],[226, 170, 148], [255, 182, 122]] }, // sunrise / sunset
  { e:  0.22, c: [[74, 140, 206],[122, 176, 216],[182, 208, 222], [238, 222, 198]] }, // golden → morning
  { e:  0.55, c: [[62, 140, 220],[108, 178, 230],[164, 206, 236], [212, 233, 241]] }, // morning / day
  { e:  1.00, c: [[46, 118, 214],[92, 166, 228], [150, 200, 236], [198, 226, 243]] }, // midday
];

// Takes the sun's elevation. Finds the two nearest palettes in SKY_KEYS and
// blends them. Returns four [r,g,b] colours for the sky gradient
// (top, upper, lower, horizon).
function skyStops(elev) {
  let a = SKY_KEYS[0];
  let b = SKY_KEYS[SKY_KEYS.length - 1];
  for (let i = 0; i < SKY_KEYS.length - 1; i++) {
    if (elev >= SKY_KEYS[i].e && elev <= SKY_KEYS[i + 1].e) {
      a = SKY_KEYS[i];
      b = SKY_KEYS[i + 1];
      break;
    }
  }
  const k = smoothstep(a.e, b.e, elev);
  return a.c.map((stop, i) => mixRGB(stop, b.c[i], k));
}

/* ---------- 4. Time-of-day label (text only, never a visual switch) ---------- */
const LABELS = [
  [5.0, "NIGHT"], [6.2, "PRE-DAWN"], [7.3, "SUNRISE"], [11.5, "MORNING"],
  [16.5, "DAYLIGHT"], [18.1, "GOLDEN HOUR"], [19.1, "SUNSET"], [20.6, "TWILIGHT"],
];

// Takes decimal hours. Returns the word to show in the HUD ("MORNING", etc).
// This is shown as text only — it never changes any visual value.
function timeOfDayLabel(hours) {
  const match = LABELS.find(([end]) => hours < end);
  return match ? match[1] : "NIGHT";
}

/* ---------- 5. Special-event time windows ---------- */

// Takes decimal hours. Returns how visible the fireflies should be (0..1):
// zero outside 18:45–19:42, and a smooth rise-and-fall inside that window.
function fireflyIntensity(hours) {
  const START = 18.75, END = 19.7;
  if (hours < START || hours > END) return 0;
  return Math.sin(((hours - START) / (END - START)) * Math.PI);
}

// Takes decimal hours. Returns how visible the morning birds should be (0..1):
// fades in after sunrise, holds, fades out by mid-morning.
function birdIntensity(hours) {
  return smoothstep(6.3, 6.95, hours) * (1 - smoothstep(8.0, 8.6, hours));
}

/* ---------- 6. Scene state ---------- */

// The main brain. Takes decimal hours.
// Works out every colour, position and opacity the scene needs and returns
// them as one plain object. It only calculates — it never touches the page,
// so the same input always gives the same output (a pure function).
function calculateSceneState(hours) {
  const phase = solarPhase(hours);
  const elev = sunElevation(phase);

  const daylight = smoothstep(-0.15, 0.12, elev);            // master light level
  const golden = smoothstep(0.36, 0.0, Math.abs(elev));      // warm horizon light, both ends
  const starLight = smoothstep(0.0, -0.18, elev);            // 1 at night, 0 by day

  // Golden-hour warmth only reaches the land while the sun is actually up.
  const warmAmt = golden * smoothstep(-0.06, 0.16, elev);
  const warm = (c) => c.map((v, i) => v + warmAmt * [30, 10, -12][i]);

  const sky = skyStops(elev);
  const horizon = sky[3];

  return {
    elev, daylight, golden, starLight,

    sky,
    haze: rgb(mixRGB(horizon, [236, 240, 246], 0.35)),
    hazeOpacity: lerp(0.02, 0.28, daylight),

    sunX: arcX(phase, 0.25),
    sunY: arcY(elev),
    sunOpacity: smoothstep(-0.14, 0.03, elev),
    sunCore: rgb(mixRGB([255, 246, 226], [255, 136, 66], golden)),
    glowColor: rgb(mixRGB([255, 228, 186], [255, 138, 78], golden)),
    sunGlow: lerp(0.42, 1, golden),
    sunGlowScale: lerp(3.0, 5.0, golden),

    moonX: arcX(phase, 0.75),
    moonY: arcY(-elev),
    moonOpacity: smoothstep(-0.1, 0.06, -elev),

    hill1: rgb(warm(mixRGB([22, 30, 50], [126, 150, 164], daylight))),
    hill2: rgb(warm(mixRGB([16, 24, 40], [86, 124, 104], daylight))),
    hill3: rgb(warm(mixRGB([11, 17, 28], [58, 96, 66], daylight))),
    meadow: rgb(mixRGB([7, 12, 18], [40, 74, 42], daylight)),
    grass: rgb(mixRGB([4, 8, 12], [26, 52, 28], daylight)),
    bush: rgb(mixRGB([3, 7, 11], [20, 44, 24], daylight)),

    cabinWall: rgb(mixRGB([9, 11, 18], [40, 44, 52], daylight)),
    cabinRoof: rgb(mixRGB([6, 8, 14], [28, 32, 40], daylight)),
    cabinDoor: rgb(mixRGB([4, 5, 11], [22, 24, 32], daylight)),
    windowGlow: smoothstep(0.12, -0.05, elev),
    cabinShadow: lerp(0.16, 0.42, daylight),

    cloudColor: rgb(mixRGB([120, 130, 150], [248, 250, 253], daylight)),
    cloudOpacity: smoothstep(0.05, 0.5, daylight) * 0.9,   // gone by dusk, full by day

    birdColor: rgb(mixRGB([20, 24, 32], [38, 44, 56], daylight)),
  };
}

/* ---------- 7. Apply state to CSS ---------- */
const root = document.documentElement;

// Short helper: set one CSS custom property on <html>.
const S = (name, value) => root.style.setProperty(name, value);

// Takes the object from calculateSceneState() and writes every value into a
// CSS custom property on <html>. This is the only place JS hands values to CSS;
// CSS then repaints the scene from those variables.
function updateScene(s) {
  S("--sky-1", rgb(s.sky[0]));
  S("--sky-2", rgb(s.sky[1]));
  S("--sky-3", rgb(s.sky[2]));
  S("--sky-4", rgb(s.sky[3]));
  S("--haze-color", s.haze);
  S("--haze-opacity", s.hazeOpacity.toFixed(3));

  S("--sun-x", s.sunX.toFixed(2) + "%");
  S("--sun-y", s.sunY.toFixed(2) + "%");
  S("--sun-opacity", s.sunOpacity.toFixed(3));
  S("--sun-core", s.sunCore);
  S("--glow-color", s.glowColor);
  S("--sun-glow", s.sunGlow.toFixed(3));
  S("--sun-glow-scale", s.sunGlowScale.toFixed(2));

  S("--moon-x", s.moonX.toFixed(2) + "%");
  S("--moon-y", s.moonY.toFixed(2) + "%");
  S("--moon-opacity", s.moonOpacity.toFixed(3));

  S("--star-opacity", s.starLight.toFixed(3));
  S("--daylight", s.daylight.toFixed(3));
  S("--golden", s.golden.toFixed(3));

  S("--hill-1", s.hill1);
  S("--hill-2", s.hill2);
  S("--hill-3", s.hill3);
  S("--meadow", s.meadow);
  S("--grass", s.grass);
  S("--bush", s.bush);

  S("--cabin-wall", s.cabinWall);
  S("--cabin-roof", s.cabinRoof);
  S("--cabin-door", s.cabinDoor);
  S("--window-glow", s.windowGlow.toFixed(3));
  S("--cabin-shadow", s.cabinShadow.toFixed(3));

  S("--cloud-color", s.cloudColor);
  S("--cloud-opacity", s.cloudOpacity.toFixed(3));

  S("--bird-color", s.birdColor);
}

// Takes decimal hours. Writes the bird and firefly visibility into their
// CSS variables (both are just opacity of a whole layer).
function updateSpecialEvents(hours) {
  S("--firefly-opacity", fireflyIntensity(hours).toFixed(3));
  S("--bird-opacity", birdIntensity(hours).toFixed(3));
}

/* ---------- 8. Clock ---------- */

// The HUD text elements, looked up once.
const els = {
  hm: document.querySelector(".hud__hm"),
  ap: document.querySelector(".hud__ap"),
  sec: document.querySelector(".hud__sec"),
  label: document.querySelector(".hud__label"),
};

// Takes decimal hours. Updates the on-screen clock digits (12-hour format)
// and the time-of-day label. This is the only part of the scene that writes
// plain text instead of a CSS variable.
function updateClock(hours) {
  const h24 = Math.floor(hours);
  const m = Math.floor((hours * 60) % 60);
  const sec = Math.floor((hours * 3600) % 60);
  const h12 = h24 % 12 || 12;

  els.hm.textContent = `${h12}:${String(m).padStart(2, "0")}`;
  els.ap.textContent = h24 < 12 ? "AM" : "PM";
  els.sec.textContent = String(sec).padStart(2, "0");
  els.label.textContent = timeOfDayLabel(hours);
}

/* ---------- 9. One frame ---------- */

// One full update: read the time, then refresh the scene, the events and the
// clock from it. Runs once now (before first paint) and then once per second.
function tick() {
  const hours = getCurrentTime();
  updateScene(calculateSceneState(hours));
  updateSpecialEvents(hours);
  updateClock(hours);
}

/* ---------- 10. Build the starfield once ---------- */

// Creates the star <span> elements once at startup, each with a random
// position, size and twinkle timing. After this, JS never touches them —
// only the .stars container's opacity changes over the day.
function buildStars() {
  const layer = document.querySelector(".stars");
  const frag = document.createDocumentFragment();
  for (let i = 0; i < 74; i++) {
    const bright = Math.random() < 0.12;
    const s = document.createElement("span");
    s.className = bright ? "star star--bright" : "star";
    s.style.left = Math.random() * 100 + "%";
    s.style.top = Math.random() * 64 + "%";
    const size = bright ? 2.6 : Math.random() < 0.8 ? 1.5 : 2.1;
    s.style.width = s.style.height = size.toFixed(1) + "px";
    s.style.setProperty("--tw-delay", (Math.random() * 6).toFixed(2) + "s");
    s.style.setProperty("--tw-dur", (3 + Math.random() * 4).toFixed(2) + "s");
    frag.appendChild(s);
  }
  layer.appendChild(frag);
}

/* ---------- 11. Build the fireflies once ---------- */

// Creates the firefly <span> elements once at startup, each with a random
// position (kept in the meadow), size and drift timing.
function buildFireflies() {
  const layer = document.querySelector(".fireflies");
  const frag = document.createDocumentFragment();
  for (let i = 0; i < 18; i++) {
    const f = document.createElement("span");
    f.className = "firefly";
    f.style.left = (8 + Math.random() * 84).toFixed(1) + "%";
    f.style.bottom = (2 + Math.random() * 17).toFixed(1) + "%";      // stays in the meadow
    f.style.setProperty("--f-scale", (0.7 + Math.random() * 0.9).toFixed(2));
    f.style.setProperty("--f-delay", (Math.random() * 6).toFixed(2) + "s");
    f.style.setProperty("--f-dur", (6 + Math.random() * 6).toFixed(2) + "s");
    f.style.setProperty("--f-x", (Math.random() * 36 - 18).toFixed(0) + "px");
    f.style.setProperty("--f-rise", (30 + Math.random() * 45).toFixed(0));
    frag.appendChild(f);
  }
  layer.appendChild(frag);
}

/* ---------- 12. Start ---------- */
buildStars();
buildFireflies();

// Synchronous first paint — the correct time of day, its events and the
// clock are all on screen immediately, with no warm-up.
tick();

// Enable CSS transitions only after that first frame has painted.
requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("booting")));

// Follow real time. 1 Hz is plenty: the sun moves < 0.01% of the screen and
// the sky < 0.15 of one RGB step per second, and CSS eases across each step.
setInterval(tick, 1000);

// Re-sync when the tab returns to the foreground (e.g. laptop woke from sleep).
document.addEventListener("visibilitychange", () => { if (!document.hidden) tick(); });
window.addEventListener("focus", tick);
