/**
 * Builds the logo assets from assets/brand/logo-source.png:
 *  public/brand/logo.png (transparent), public/brand/mark.png (the "P" only), src/app/icon.png
 *
 * Re-run with `npm run assets` after replacing a source file.
 */
import sharp from "sharp";

const LOGO_IN = "assets/brand/logo-source.png";

/** White/red artwork on pure black: use brightness as alpha, un-premultiply the colour. */
async function keyOutBlack(input) {
  const { data, info } = await input.removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(info.width * info.height * 4);
  for (let p = 0, q = 0; p < data.length; p += 3, q += 4) {
    const r = data[p], g = data[p + 1], b = data[p + 2];
    const m = Math.max(r, g, b);
    const a = m < 18 ? 0 : Math.min(255, Math.round(((m - 18) / (200 - 18)) * 255));
    const k = a ? 255 / Math.max(m, 1) : 0;
    out[q] = Math.min(255, Math.round(r * (a >= 255 ? 1 : k)));
    out[q + 1] = Math.min(255, Math.round(g * (a >= 255 ? 1 : k)));
    out[q + 2] = Math.min(255, Math.round(b * (a >= 255 ? 1 : k)));
    out[q + 3] = a;
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } });
}

async function logo() {
  // Full lockup spans rows 155-295 of the 447px source; the "P" mark is rows 155-234.
  const up = (box) => sharp(LOGO_IN).extract(box).resize({ width: box.width * 3, kernel: "lanczos3" });
  const full = await keyOutBlack(up({ left: 40, top: 150, width: 380, height: 150 }));
  await full.png().toFile("public/brand/logo.png");
  const mark = await keyOutBlack(up({ left: 160, top: 150, width: 150, height: 90 }));
  await (await mark.png().toBuffer().then((b) => sharp(b).trim({ threshold: 1 }))).png().toFile("public/brand/mark.png");
  await sharp(LOGO_IN).extract({ left: 160, top: 140, width: 150, height: 110 }).resize(512, 512, { fit: "contain", background: "#000" }).png().toFile("src/app/icon.png");
  console.log("logo -> public/brand/logo.png, mark.png, src/app/icon.png");
}

await logo();
