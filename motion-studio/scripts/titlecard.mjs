// Generate an optimized SVG title card: Satori (JSX-like tree → SVG) then SVGO.
// Usage: node scripts/titlecard.mjs "Title" [out/titlecard.svg] [path/to/font.ttf]
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import satori from "satori";
import { optimize } from "svgo";

const [title = "Motion Studio", outPath = "out/titlecard.svg", fontPath = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"] =
  process.argv.slice(2);

const font = await readFile(fontPath);
const svg = await satori(
  {
    type: "div",
    props: {
      style: { width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0b1020" },
      children: { type: "div", props: { style: { color: "white", fontSize: 96 }, children: title } },
    },
  },
  { width: 1280, height: 720, fonts: [{ name: "Title", data: font, weight: 700, style: "normal" }] },
);

const { data } = optimize(svg, { multipass: true });
await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, data);
console.log(`${outPath}: ${svg.length} → ${data.length} bytes`);
