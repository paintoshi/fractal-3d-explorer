# Foldspace

A real-time 3D fractal explorer. Fly through recursive architecture, discover intricate surfaces, and render high-resolution images of your travels.

Foldspace runs entirely in your browser. The interface, shaders, and fractal formulas are contained in a single HTML file, with no external dependencies.

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

Foldspace uses WebGL 2 to evaluate fractal distance estimates directly on the GPU. Ray marching reveals the surfaces without storing or streaming meshes. Lighting combines tetrahedral normal estimation, ambient occlusion, atmospheric fog, bloom, and FXAA antialiasing.

**Automatic** quality adjusts resolution toward 30 fps. **Performance**, **High detail**, and **Ultra** let you choose the balance between speed and clarity. Frame rate depends on your GPU, the world, and how deeply you explore. Rendering pauses while the page is hidden or the controls guide is open.

Reusable rendering buffers keep graphics memory usage bounded during exploration. Repeating worlds also rebase the camera periodically to preserve coordinate precision over long flights.

### Deep exploration

Near surfaces, Mandelbox, Menger, Blockworld, and Kleinian use paired-float arithmetic for greater coordinate precision. Camera coordinates are split into high and low components, and nearby ray positions are calculated relative to the camera. Mandelbulb uses standard floating-point arithmetic.

Extended precision allows finer detail at the cost of additional GPU work. Magnification remains limited by numerical precision and finite fractal iterations; repeating space extends travel rather than providing unlimited unique detail. The surface-distance readout estimates your proximity to the geometry.

## Formula references

- [Tom Lowe: What is a Mandelbox](https://sites.google.com/site/mandelbox/what-is-a-mandelbox)
- [Daniel White: Mandelbulb](https://www.skytopia.com/project/fractal/mandelbulb.html)
- [Inigo Quilez: Menger sponge](https://iquilezles.org/articles/menger/)
- [Syntopia: Distance estimation](https://blog.hvidtfeldts.net/index.php/category/distance-estimation/)
