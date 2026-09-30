# Foldspace

A real-time 3D fractal explorer. Fly through recursive architecture, discover intricate surfaces, and render high-resolution images of your travels.

Foldspace runs entirely in your browser. The interface, shaders, and fractal formulas are contained in a single HTML file, with no external dependencies.

## Live Demo

[https://fractals.paintoshi.dev](https://fractals.paintoshi.dev)

## Getting started

Open **index.html** in a desktop browser with hardware-accelerated WebGL 2. No installation or internet connection is required.

To serve it locally, run:

```sh
python serve.py
```

Then open [localhost:8000](http://127.0.0.1:8000/).

The first launch can take tens of seconds while your browser compiles the rendering shaders for all five worlds.

## Worlds

- **Mandelbox** — folded architecture in burnt amber and charcoal, surrounded by sandstorm fog.
- **Menger sponge** — a recursive lattice of cyan corridors and cubic openings.
- **Mandelbulb** — organic formations in dark cyan and blue.
- **Blockworld** — a voxel-like landscape of grassy terraces and stepped canyons under a pale daytime sky. It is a Mandelbox that inverts space through a cube instead of a sphere, so every scale is built from square blocks. With repeating space enabled, it tiles horizontally into endless terrain.
- **Kleinian tunnels** — open passages in cobalt and crimson, fading into cyan mist.

## Controls

- **W A S D** — fly forward, left, backward, and right.
- **Q / E** — move straight down / up.
- **Left mouse drag** or **arrow keys** — look around.
- **Mouse wheel** or **+ / −** — adjust flight speed from 0.1× to 10×.
- **Shift** — temporary speed boost.
- **Alt** — precision movement.
- **R** — reset the view.
- **H** — show or hide the interface.
- **F** — enter or exit fullscreen.

On touch screens, drag to look around and use the on-screen movement buttons.

Flight slows as you approach a surface, making small details easier to explore. **Fractal depth** controls the amount of detail, from Light to Maximum. Higher settings require more GPU processing.

Enable **Endless repeating space** to explore repeating copies of a world, or turn it off to explore a single fractal.

## Render an image

Choose **Render image** to create a 4000px-wide PNG of your current view. The image preserves the window's aspect ratio and contains only the fractal scene.

Rendering holds the camera still while a progress bar tracks completion. You can cancel at any time. When finished, inspect the large preview and select **Download PNG** to save it.

Image rendering uses four samples per pixel, enhanced surface detail, and up to 480 ray-march steps. Padded tiles support high-resolution output with consistent bloom across tile boundaries.

## Saved preferences

Your world, camera position, flight speed, depth, render quality, repeating-space setting, and interface visibility are remembered in your browser. Opening Foldspace from a different address or browser uses separate saved preferences.

## Rendering technology

Foldspace is a **GPU-first** realtime renderer. Almost all of the heavy work runs in WebGL 2 fragment shaders; the CPU handles the interface, camera, and a small number of helper calculations.

### What runs on the GPU

Each frame, a **scene shader** draws a full-screen triangle. For every pixel it:

1. Casts a ray from the camera through that pixel.
2. **Ray-marches** along the ray, repeatedly evaluating a **signed distance field** for the active fractal (Mandelbox, Menger, Mandelbulb, Blockworld, or Kleinian). No meshes are built or uploaded—the surface is found purely by math.
3. On a hit, estimates **normals**, **ambient occlusion**, **soft shadows**, and **orbit-trap coloring**, then mixes in **fog** and sky.

The same distance formulas exist in JavaScript for flight helpers (see below), but **what you see on screen is entirely shader-driven**. High-resolution **Render image** export uses the same GPU path, tiled into padded chunks; the CPU only stitches those tiles into a PNG.

Before the full-resolution march, a **cone pre-pass** marches one ray per 8×8 pixel block and stores how far that block can safely skip ahead; each pixel then starts its own march from there. Additional GPU passes apply **bloom** (two separable blurs) and **FXAA** antialiasing. There is one compiled shader program per world, plus a heavier **deep-zoom** variant for Mandelbox, Mandelbulb, Blockworld, and Kleinian that uses paired-float arithmetic in the shader for extra precision near surfaces.

**Automatic** quality scales internal resolution toward ~30 fps. **Performance**, **High detail**, and **Ultra** fix that tradeoff manually. Frame rate depends on your GPU, the world, fractal depth, and how close you are to geometry. Rendering pauses while the page is hidden or the controls guide is open.

Reusable render targets keep GPU memory bounded. Repeating worlds periodically rebase the camera so coordinates stay stable over long flights.

### What runs on the CPU

The browser’s JavaScript thread does **not** paint the fractal pixel-by-pixel. It:

- Reads input, updates camera position and orientation, and saves settings.
- Runs a lightweight **`distance()`** mirror of each world’s formula in **64-bit float**—typically **once per frame at the camera position** (and a few related probes). That drives **flight slowdown near surfaces**, **adaptive iteration counts** passed into the shader as uniforms, and the **Surface distance** readout in the UI.
- Compiles and links shaders at startup (and loads deep-zoom variants in the background). Compilation uses the CPU and driver; execution of the formulas uses the GPU.

So: **visuals and export = GPU**; **controls, UI, and conservative flight math = CPU**.

### Deep exploration

The **Menger sponge** zooms roughly 600 levels deep (about 10⁻²⁸⁶ of its size) without losing precision. As you approach a surface, the camera steps into the next sub-cube and its coordinates are rescaled by 3, so the shader always works at a comfortable scale. The outer levels you have passed are remembered as exact integer offsets and are restored when you fly back out. The fractal depth grows by one iteration for each threefold zoom, and your exact position at any depth is saved between visits.

Near surfaces, Mandelbox, Mandelbulb, Blockworld, and Kleinian use paired-float arithmetic for greater coordinate precision. Camera coordinates are split into high and low components, and nearby ray positions are calculated relative to the camera. Mandelbulb evaluates its spherical power-8 map through algebraic angle doubling to preserve that precision.

Extended precision allows finer detail at the cost of additional GPU work. Outside the Menger sponge, magnification remains limited by numerical precision and finite fractal iterations; repeating space extends travel rather than providing unlimited unique detail. The surface-distance readout estimates your proximity to the geometry.

## Formula references

- [Tom Lowe: What is a Mandelbox](https://sites.google.com/site/mandelbox/what-is-a-mandelbox)
- [Daniel White: Mandelbulb](https://www.skytopia.com/project/fractal/mandelbulb.html)
- [Inigo Quilez: Menger sponge](https://iquilezles.org/articles/menger/)
- [Syntopia: Distance estimation](https://blog.hvidtfeldts.net/index.php/category/distance-estimation/)

## AI Info

A technical guide for AI assistants and future contributors: how the code is organised, how a frame is produced, which invariants must hold, and where the project could go next. Functions are referred to by name rather than by line number, because the file is dense and line numbers drift.

### Repository layout

- **`index.html`** — the whole application: CSS, markup, four GLSL shaders, and one JavaScript IIFE. There is no build step, bundler, or package manager, and no runtime dependencies. Keep it that way: the app must work when opened directly from disk and offline.
- **`tests/verify.mjs`** — a Node test (`node tests/verify.mjs`) that runs the real page script inside `vm` with a mocked DOM and a mocked WebGL context. It covers logic, not pixels.
- **`tests/gpu-precision.mjs`** — run with Node, then open the printed localhost URL in a WebGL 2 browser. Compiles the full precise Mandelbulb shader and compares GPU distances against spherical float64 references down to 1e-10, including camera-relative offsets, repeated cells, and polar axes. Reports pass/fail to the terminal.
- **`serve.py`** — a minimal local preview server with an explicit allow-list of files (it never lists directories).
- Icons, `site.webmanifest`, `CNAME` (GitHub Pages domain) — static assets.

### Code style

- The code is deliberately compact: long single-line functions, short names (`vs`, `b`, `v`), and no framework. Match this style when editing rather than reformatting the file.
- Comments only explain constraints the code cannot show (why a number is what it is, why an order matters). Do not remove existing comments unless they are wrong or belong to deleted code.
- `tests/verify.mjs` injects its test API by string-replacing the comment `// Expose read-only diagnostics` in the script. Keep that comment, or update the test at the same time.

### Script blocks in `index.html`

| Block | Role |
|---|---|
| `#vertex` | Full-screen triangle from `gl_VertexID`; no vertex buffers. |
| `#sceneShader` | Ray marcher: distance fields, lighting, fog. One source, compiled into many programs. |
| `#blurShader` | Separable 9-tap Gaussian; the first pass also extracts bright areas for bloom. |
| `#postShader` | FXAA, bloom composite, vignette and dither. |
| main `<script>` | Everything else: state, input, CPU distance mirrors, render loop, export, persistence. |

### Shader compilation model

- `sceneSource(i, precise)` prepends constants to the scene shader: `world`, `preciseMode`, `coneBlock`, `mengerSlots`. Because `world` is a compile-time constant, each program contains only one formula. One combined shader took over a minute to compile on D3D (ANGLE on Windows), so do not merge the branches back into runtime uniforms.
- `scenes` is a `Map` keyed `"<world>f"` (fast) or `"<world>p"` (precise). All fast programs compile at startup through `programAsync`, which uses `KHR_parallel_shader_compile` when available. `warmPreciseScenes` compiles the heavy precise variants one at a time in the background afterwards.
- `activeScene()` picks the precise program when `needsPrecise()` and it has finished compiling; otherwise it falls back to the fast one (softer, never blank).
- `?cold` in the URL appends a random comment to every shader to bypass the browser's shader cache, for testing first-visit load times.

### Frame lifecycle

1. **`tick(time)`** runs on `requestAnimationFrame` but paces itself to 30 fps. It calls `move(dt)`, then builds `viewKey()`. If the key is unchanged, nothing is drawn: the scene is static, so idle views cost almost nothing.
2. **`move(dt)`** handles look and flight keys. It evaluates the CPU distance at the camera (`surfaceDistance()`), which sets `nearest`, the adaptive `iterations`, and the flight speed (slower near surfaces, and a single step never exceeds 35% of the distance to the surface). For the Menger sponge it also calls `rescaleMenger()` and moves through `shiftMenger()` instead of changing `pos`.
3. **`draw()`** calls `resize()` (render-target allocation and resolution scaling), then `renderPass(targets, null, [w, h])`.
4. **`renderPass(buffers, output, fullSize, origin, highQuality)`** sets all uniforms and issues these draws:
   - Cone pre-pass into `buffers[3]` (if float targets are supported).
   - Full scene march into `buffers[0]`.
   - Bloom: extract plus horizontal blur into `buffers[1]` (quarter resolution), then vertical blur into `buffers[2]`.
   - Post (FXAA, bloom, vignette, dither) into `output`, or the canvas when `output` is `null`.
5. Every 1.8 s, **Automatic** quality nudges `scale` toward a 35–39 ms frame average (range 0.3–1; down to 0.18 while the precise shader is active).

`renderPass` is shared by live rendering and image export. Any new uniform or pass must work in both, including with a non-zero `tileOrigin`.

### Units and scales

- **World units** are the fractal's native coordinates, used by `pos` and the CPU `distance()`.
- **March units** are what the shader marches in. `viewScale()` converts: it is 1 for every world except the Menger sponge, where it is `3^level / 1.6` (frame units).
- `nearest` is always the surface distance in world units (the UI readout). The CPU value `near` is in march units.
- `lengthScale` converts world-unit shading lengths (shadow reach, fog distance, far plane, glow falloff) into march units; `invViewScale` maps march positions back for material noise. For the Menger sponge, `lengthScale = vs·min(1, 3000·nearest)`, so shading follows the camera's own scale when deep and stays continuous across frame changes.

### Worlds

| # | World | Formula | Iteration cap | Precise variant | `rate` |
|---|---|---|---|---|---|
| 0 | Mandelbox | Box fold, sphere fold, scale −1.8 | 64 | yes | 3 |
| 1 | Menger sponge | Inigo Quilez's cross subtraction, in zoom frames | 22 (fine levels only) | not needed | 1/log10 3 |
| 2 | Mandelbulb | Power 8, spherical coordinates | 64 | yes | 2.5 |
| 3 | Blockworld | Mandelbox with a max-norm (cube) inversion, scale −2.5; repeats in x and z only | 64 | yes | 2.5 |
| 4 | Kleinian tunnels | Box fold plus inversion, cylindrical distance | 48 | yes | 2.5 |

Each world entry in `worlds` holds its palette (`a`, `b`, `fog`, `glow`, `accent`), repetition `period`, start camera (`pos`, `target`), base iterations `it`, and `rate` (iterations added per tenfold zoom, matching how fast each formula's derivative grows near its surface). World-specific lighting lives in `main()` of the scene shader, keyed by `world`.

Every formula exists twice: in GLSL (`fastField` / `preciseField` / `mengerField`) and in JavaScript (`distance()`, `mengerField`). **When changing a formula, change both**, or flight slowdown, iteration counts, and the distance readout will disagree with what is drawn.

### Adaptive detail

- `iterations = base + floor(log10(topScale / surfaceDistance) · rate)`, clamped to the world's cap. `base` is `it` plus 3 per **Fractal depth** step above Standard.
- `epsilon` (hit threshold) shrinks with `nearest` and with Fractal depth. It is floored by `precisionFloor()`: 2e-12 for all precise worlds (including Mandelbulb), 0 for the Menger sponge.
- Steps per ray: 90 / 160 / 240 for Performance / default / Ultra, +20 per depth step, capped at 320. Export uses 480.
- `detailBias` widens the hit threshold with distance (`t·detailBias/resolution.y`), a cheap level of detail.

### Cone pre-pass

- `coarseTarget` allocates an `RG32F` texture at 1/`CONE_BLOCK` (8) resolution with `NEAREST` filtering. It requires `EXT_color_buffer_float`; without it `floatTargets` is false and the pass is skipped.
- In the coarse pass each fragment marches one ray through the centre of its block. It stops when `d < 2·cone·(t+d)`, where `cone` is slightly wider than the block's pixel footprint, so every ray in the block is still in empty space at that `t`. It writes `(t, glow)`.
- The main pass reads the value with `texelFetch(coarseDepth, ivec2(gl_FragCoord.xy)/coneBlock)` and starts marching from there.
- The coarse texture is unbound from texture unit 2 while it is the render target, to avoid a WebGL feedback-loop error. Keep that order in `renderPass`.
- Measured gain: about 12–25% less GPU time per frame, depending on the world.

### Paired-float precision (Mandelbox, Mandelbulb, Blockworld, Kleinian)

- `preciseField` represents each coordinate as a float pair (high + low), using error-free sums (`da`) and Dekker products (`dm`), plus division, square root, floor, and mod built from them.
- The camera is sent as `eye` + `eyeLow` (the part lost by `Math.fround`), and ray offsets are added relative to it. Repetition uses `period` + `periodLow` so Mandelbulb's non-integer period stays aligned with the CPU.
- Mandelbulb's `bulbPower8` squares the polar and azimuth complex pairs three times, reproducing the spherical power-8 formula without float32 trigonometry. Its float64 CPU mirror retains the equivalent trigonometric formula.
- `roundMask` is always all ones at runtime. Because it is a uniform, the driver cannot prove that `rounded(x) == x`, which stops it from algebraically simplifying the error-free sums away.
- `needsPrecise()` switches to it when `nearest < 0.003`. `checkPrecision()` (in the controls guide) compares the GPU's precise distances with CPU float64 at a deep Mandelbox point.
- Depth is still limited: roughly 1e-12 world units, and iteration caps limit detail before that.

### Menger zoom frames (infinite zoom)

The Menger sponge is exactly self-similar under 3× scaling, so its camera is not a single float position but a stack of nested cells:

- **State** (`menger`): `level`, `cell` (the level-0 cell, an integer vector), `digits` (one per level, each axis in {−1, 0, 1}, choosing one of 27 sub-cubes), and `local` (the position inside the innermost cube, in [−1, 1]³).
- **Position**: `u = 2·cell + Σ 2·dᵢ/3ⁱ + local/3^level`, and world `pos = 1.6·u`. `mengerWorld()` computes this (only for saving and display; it loses precision when deep).
- **Descending and ascending**: `rescaleMenger()` calls `mengerDescend()` when the frame-unit surface distance is below 0.03, and `mengerAscend()` when above 0.3. The gap prevents flip-flopping. Maximum level is `MENGER_MAX_LEVEL` (600).
- **Moving**: `shiftMenger(delta)` adds to `local`. When an axis leaves [−1, 1] it carries into the digits like an odometer, and into `cell` at level 0.
- **What the shader receives** (`mengerFrame`, cached in `mengerCache`):
  - Fine levels (at or below the frame) are evaluated by the usual loop on frame coordinates, `iterations` times.
  - Coarse levels (the ones already zoomed past) are passed as up to `MENGER_SLOTS` (16) `vec4`s: an integer offset from the camera to the level's cell centre, plus `h`, a third of that cell's size in frame units. The shader evaluates `e = ||w| − 2h| − h` per axis, adding the small camera-relative part last, so the integer part stays exact in float32.
  - Offsets are computed with BigInt. Levels with `h` larger than `MENGER_LIMIT` (3¹³) are replaced by `mengerCopy`, a smaller copy that matches exactly within `MENGER_REACH` (2e5) of the camera.
  - A coarse level is only kept when two axes have their middle third within reach (only then can it carve anything visible). Levels that are dropped still contribute to the orbit trap (`frameTrap`) for colouring. If more than 16 remain, the ones that carve most (by `cut`) are kept.
  - `frameBox` is the outer cube of the level-0 cell; `framePeriod` is the repetition period in frame units (only while it is still exactly representable).
- **Persistence**: `serializeMenger` stores each digit as one letter of `MENGER_ALPHABET`; `parseMenger` validates everything before accepting it.
- **Tests** compare `mengerField` with an exact BigInt rational reference up to level 90, check agreement across repetition boundaries, and simulate a dive and return.

### Repeating space and rebasing

- With **Endless repeating space** on, the shader wraps positions by `period` (`wrapPoint`), and `move()` wraps `pos` back into the central cell, so camera coordinates never grow. Blockworld does not wrap the vertical axis (`wraps(axis)`).
- With it off, the camera is kept within radius 100 of the origin.
- The Menger sponge handles both inside `shiftMenger` at level 0.

### Image export (`renderImage`)

- Output is 4000 px wide, keeping the window's aspect ratio. It uses 2×2 supersampling (`ss = 2`) and 256 px tiles, each padded by more than the blur and FXAA footprint so the bloom matches across tile edges.
- Each tile calls `renderPass` with `highQuality = true` (more iterations, 480 steps, finer epsilon), then `readPixels`. The CPU averages the 2×2 samples and flips rows into a 2D canvas, which is encoded to PNG.
- Export allocates its own targets (including a coarse target) and deletes them in `finally`. The test checks that the number of live GPU targets stays fixed.

### Persistence

- `localStorage["foldspace-settings-v1"]` holds the world, speed, depth, fog, quality, repeat, hidden UI, and camera. For the Menger sponge the camera also includes the serialized zoom frame.
- `worldRevision` (currently 10) invalidates saved Blockworld cameras when that world's geometry changes. Bump it if you change a formula so old camera positions would land inside geometry.
- Everything read back is validated (types, ranges, finite numbers) before use.

### Robustness

- WebGL context loss shows an error panel. On restore, `reinitializeAfterContextRestore` clears all GPU state (`resetGpuState`) and recompiles.
- `window.foldspaceDiagnostics()` returns read-only state (world, position, iterations, `nearest`, `zoomLevel`, resolution, fps, GL error, buffer count) for debugging and browser automation.

### Invariants and pitfalls

- Keep the GLSL and JavaScript formulas in sync (see Worlds).
- A new render target must be added to `resize()`, `renderImage()`, and `liveTargets` in the test.
- Never sample a texture that is bound as the current render target.
- Shader loops need compile-time bounds (`min(uniform, constant)`); WebGL 2 on ANGLE may reject or unroll unbounded loops badly.
- Uniform arrays are fixed-size (`mengerSlots`), so changing `MENGER_SLOTS` recompiles every program.
- Any distance used for shading must be scaled with `lengthScale`; otherwise effects disappear or jump when deep in the Menger sponge.
- Avoid heavy work in `tick` when the view is unchanged; the static-view skip keeps idle GPU use near zero.
- Iteration counts come from a probe at a fixed budget, so adaptive detail cannot feed back into itself.

### Possible future improvements

- **Kleinian infinite zoom.** Its folds and inversions are conformal, so a zoom-frame approach similar to the Menger sponge's looks possible. Unlike Menger there is no fixed 3× grid, so each renormalisation would need a matching group transformation, and distant geometry would show small errors. It is a larger project than Menger's was.
- **Mandelbox and Blockworld deeper zoom.** These are not exactly self-similar, so frames cannot be exact. Options include perturbation-style evaluation (a high-precision reference orbit on the CPU, with small per-ray deltas on the GPU) or more float components (float triples or quads).
- **Progressive refinement while still.** The view is static when the camera stops, so frames could accumulate jittered samples for anti-aliasing and soft shadows instead of redrawing nothing.
- **Temporal reprojection** while moving, reusing the previous frame's depth to start rays or to upscale a lower internal resolution.
- **Hierarchical cone passes** (for example 32 px, then 8 px blocks) to skip more empty space in open views, plus an `RGBA8`-packed fallback for devices without `EXT_color_buffer_float`.
- **Shareable links** that encode the camera (including the Menger digits) in the URL.
- **WebGPU.** It would not increase zoom depth (still 32-bit floats), but compute shaders could make tiled export, progressive accumulation, and the cone pass simpler and faster. Keep WebGL 2 as the fallback.
- **Maintainability.** If the file keeps growing, the shaders could move into separate files inlined by a tiny build step, as long as the shipped result stays one self-contained HTML file.
