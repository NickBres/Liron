# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A single-page interactive birthday card in Hebrew (RTL), authored as a **Claude Design canvas** (`Liron.dc.html`). It is a tap-driven narrative: particles morph through shapes and Hebrew text, two video "clues" gate a riddle, solving both unlocks a glass-object sequence and a closing letter.

No build step and no framework source — everything is plain static files served over HTTP.

## Commands

```bash
npm install
npm run dev      # Vite static dev server, opens /Liron.dc.html
```

There are no tests and no build output. `file://` does **not** work — `clouds/*.json` is fetched and `three` is a dynamic ESM import, so it must be served over HTTP.

## Architecture

Three independent layers, wired only through the DOM:

**1. `support.js` — the DC runtime (generated, do not edit).**
Header says: regenerate with `cd dc-runtime && bun run build` (that source tree is not in this repo). It parses `<x-dc>`, self-loads React 18 + Babel from unpkg at runtime, and implements the custom template tags:
- `{{ expr }}` bindings resolve against the object returned by `renderVals()`
- `<sc-if value="{{ … }}">` conditional block
- `<x-import component-from-global-scope="…" from="./file.js">` loads a script and mounts the custom element it defines
- `<script type="text/x-dc" data-dc-script>` must define `class Component extends DCLogic`; its `data-props` attribute is the HTML-escaped JSON prop schema (editor type, default, section) that drives the canvas properties panel

**2. `particle-stage.js` — `<particle-stage>` custom element.**
One persistent Three.js GPU particle system (5.2k–7.6k points) that morphs between forms. Loads `three@0.163.0` from jsDelivr via dynamic import; deliberately no addons — glow is an additive sprite + halo pass, not UnrealBloom.

Public API used by the card:
- `morphTo(spec, durationMs)` where `spec` is one of `{shape}` (procedural: `cloud`, `envelope`, `heart`, `gift`, `vase`, `plate`, `ornament`), `{cloud}` (pre-sampled point cloud by key), or `{lines: [...], fit}` (rendered Hebrew text); plus optional `scale`, `spin`, `tiltX`
- `loadCloud(key, url)`, `burst(amp)`, `setGlow(v)`, `setPalette(h, h2)`, `ready` (promise)
- emits a bubbling `stagetap` event with `{x, y}`; the card listens on `document`

Pointer drag orbits and wheel zooms the stage, so `advance()` in the card **only accepts taps in the bottom 20% of the viewport** to avoid fighting the orbit gesture.

**3. `fireworks.es.js` — vendored fireworks-js 2.10.8** (identical to `uploads/index.es.js`), dynamically imported on mount and driven by `startFireworks()` / `stopFireworks()`.

### Card state machine (`Liron.dc.html`)

`state.step` 0→9 with `state.sub` for within-step pages. `scene(step, sub)` is the single place that maps a step to particle geometry and animation duration; `advance(y)` is the single place that decides the next step on tap. Steps are gated by `busy` (set true during a morph, cleared after `dur + 500ms`), which also drives when the "tap to continue" hint appears.

Step 6 is the riddle gate: `sub === 0` asks the place, `sub === 1` the activity. Answers are matched with regexes `PLACE_RE` / `ACT_RE` (accepting Hebrew and transliterated forms). Both solved → step 7. The clue "videos" are currently a 6.5s fake progress bar, not real media.

Every timeout goes through `later()`, which pushes onto `this._t` so `restart()` and `componentWillUnmount()` can clear them all. Keep new timers on that path.

### Props (canvas properties panel)

`wishesMode` (`letter` | `cards`), `showHints`, `glow` (0.3–2.2), `accent` (color). `accent` is converted to a hue via `hueOf()` and feeds both the particle palette and the fireworks hue range; `componentDidUpdate` re-applies `glow`/`accent` live.

## Content conventions

- All user-facing copy is Hebrew, inline in the markup, `dir="rtl"`. Fonts: Heebo (UI) and Frank Ruhl Libre (prose), loaded from Google Fonts in the `<helmet>` block.
- The long letter, the "why glass" text, and the two clue videos are still `placeholder` — marked with a literal `— placeholder —` line.

## Assets

- `clouds/*.json` — `{n, ext:{x,y,z}, p:[…]}` pre-sampled surface point clouds, normalized so the max dimension is 1. This is what the runtime actually loads.
- `uploads/*.glb` — the source meshes the clouds were baked from, plus fireworks-js dist and its `.d.ts` files. Nothing at runtime references `uploads/`; it is provenance, and it is ~32 MB.
- `.thumbnail` — WebP canvas preview, generated.
