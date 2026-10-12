# Motion Studio

A motion-design workspace kept apart from the dashboard, so these libraries never end up in its bundle.

Loop: brief → design → animate → build → sound → render → review → ship

## Layers

| Layer | Tools |
| --- | --- |
| Agent skills | `.claude/skills/remotion-*`, `gsap-*`, `motion` (repo root) |
| Video | Remotion (`remotion`, `@remotion/cli`, `@remotion/player`), Motion Canvas (`@motion-canvas/*`) |
| UI animation | Motion (`motion`), GSAP (`gsap`, `@gsap/react`), Anime.js (`animejs`) |
| Vector runtimes | Rive (`@rive-app/react-canvas`), dotLottie (`@lottiefiles/dotlottie-web`, `-react`) |
| 3D | `three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/rapier`, `@react-three/postprocessing` |
| Assets | SVGO (`svgo`), Satori (`satori`) |
| Sound | Howler.js (`howler`) |
| Export | Mediabunny (`mediabunny`, in-browser encoding), FFmpeg (system `ffmpeg`/`ffprobe`) |

## Commands

```sh
npm install
npm run studio                         # Remotion Studio preview
npm run render -- TitleCard out/a.mp4  # render a composition to MP4
npm run titlecard -- "Title"           # Satori → SVGO title card at out/titlecard.svg
ffprobe out/a.mp4                      # inspect an export
```

`remotion.config.ts` points Remotion at the Chromium preinstalled in the cloud container. On another machine, remove that line and Remotion downloads its own browser.

Motion Canvas only runs through its Vite plugin, which is why Vite is pinned to 5.x.
