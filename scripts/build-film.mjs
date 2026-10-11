#!/usr/bin/env node
/**
 * Turns the Grok clips in assets/video into scroll-scrubbed frame sequences.
 *
 *   1. ffmpeg: trim, remove the "Grok" watermark, (mirror), light denoise,
 *      Lanczos upscale to 1920x1080, mild sharpen  ->  assets/frames/<id>/frame_0000.png (masters)
 *   2. sharp:  PNG masters -> public/film/<id>/desktop/*.webp (1920x1080)
 *                          -> public/film/<id>/mobile/*.webp  (720x900 portrait crop around the athlete)
 *   3. writes src/config/film.json (frame counts, sizes, edge colours, cache version)
 *
 * Usage: npm run film            (all clips)
 *        npm run film -- squat   (one clip)
 */
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import ffmpegPath from "ffmpeg-static";

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VIDEO_DIR = path.join(ROOT, "assets", "video");
const MASTER_DIR = path.join(ROOT, "assets", "frames");
const OUT_DIR = path.join(ROOT, "public", "film");
const CONFIG = path.join(ROOT, "src", "config", "film.json");

/** Grok watermark box in the 1264x720 source. */
const WATERMARK = { x: 1130, y: 650, w: 120, h: 46 };

/**
 * start/end: seconds kept from the source.
 * focusX:    where the athlete sits horizontally in the final (possibly mirrored) frame, 0..1.
 */
const CLIPS = [
  { id: "curl", file: "grok-video-41dea9ae-c32a-4e57-8373-145c8b187aad.mp4", start: 0, end: 3.85, mirror: true, focusX: 0.56 },
  { id: "squat", file: "grok-video-fb7d9bbd-56f8-4637-9d9a-a5f47db1bd38.mp4", start: 1.2, end: 6.04, mirror: false, focusX: 0.5 },
  { id: "deadlift", file: "grok-video-a5e52f9c-0311-4aea-8526-2ee997dcc5d2.mp4", start: 0, end: 6.04, mirror: false, focusX: 0.5 },
];

const DESKTOP = { width: 1920, height: 1080, quality: 74 };
const MOBILE = { width: 720, height: 900, quality: 72 };
const PAD = 4;
const CONCURRENCY = Math.max(2, Math.min(8, os.cpus().length));
sharp.concurrency(1);

const only = process.argv.slice(2);

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

async function main() {
  let config = { clips: {} };
  try {
    config = JSON.parse(await fs.readFile(CONFIG, "utf8"));
  } catch {}

  for (const clip of CLIPS) {
    if (only.length && !only.includes(clip.id)) continue;
    console.log(`\n${clip.id}: ${clip.file} [${clip.start}s – ${clip.end}s]`);
    const masters = await extract(clip);
    const desktop = await convert(clip, masters, "desktop");
    const mobile = await convert(clip, masters, "mobile");
    const colors = await edgeColors(masters[0]);
    config.clips[clip.id] = {
      count: masters.length,
      fps: 24,
      focusX: clip.focusX,
      desktop: { folder: `/film/${clip.id}/desktop`, width: DESKTOP.width, height: DESKTOP.height, bytes: desktop },
      mobile: { folder: `/film/${clip.id}/mobile`, width: MOBILE.width, height: MOBILE.height, bytes: mobile },
      colors,
    };
    console.log(`  ${masters.length} frames | desktop ${mb(desktop)} MB | mobile ${mb(mobile)} MB | edge ${colors.border}`);
  }

  config.version = Date.now().toString(36);
  config.pad = PAD;
  config.pattern = "frame_{index}.webp";
  await fs.writeFile(CONFIG, JSON.stringify(config, null, 2) + "\n");
  console.log(`\nwrote ${path.relative(ROOT, CONFIG)}`);
}

async function extract(clip) {
  const dir = path.join(MASTER_DIR, clip.id);
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
  const filters = [
    clip.mirror && "hflip",
    "hqdn3d=1.2:1.2:4:4",
    `scale=${DESKTOP.width}:-2:flags=lanczos+accurate_rnd+full_chroma_int`,
    `crop=${DESKTOP.width}:${DESKTOP.height}`,
    "unsharp=5:5:0.55:3:3:0",
  ].filter(Boolean);
  await run(ffmpegPath, [
    "-hide_banner", "-loglevel", "error", "-y",
    "-ss", String(clip.start), "-to", String(clip.end),
    "-i", path.join(VIDEO_DIR, clip.file),
    "-vf", filters.join(","),
    "-start_number", "0",
    path.join(dir, `frame_%0${PAD}d.png`),
  ]);
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".png")).sort().map((f) => path.join(dir, f));
  await pool(files, CONCURRENCY, (file) => patchWatermark(file, clip.mirror));
  console.log(`  extracted ${files.length} PNG masters -> ${path.relative(ROOT, dir)}`);
  return files;
}

/**
 * Covers the watermark with the neighbouring strip of floor, feathered at the edges.
 * Floor reflections run horizontally, so the patch reads as continuous floor.
 */
async function patchWatermark(file, mirrored) {
  const s = DESKTOP.width / 1264;
  const cropY = (Math.round((720 * s) / 2) * 2 - DESKTOP.height) / 2;
  const M = 22; // feather margin
  const w = Math.round(WATERMARK.w * s) + 16 + 2 * M;
  const h = Math.round(WATERMARK.h * s) + 16 + 2 * M;
  let x = Math.round(WATERMARK.x * s) - 8 - M;
  const y = Math.round(WATERMARK.y * s - cropY) - 8 - M;
  x = Math.min(x, DESKTOP.width - w);
  if (mirrored) x = DESKTOP.width - x - w;
  const srcX = mirrored ? x + w : x - w;

  const alpha = Buffer.alloc(w * h);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const d = Math.min(i, j, w - 1 - i, h - 1 - j);
      const t = Math.min(1, d / M);
      alpha[j * w + i] = Math.round(255 * t * t * (3 - 2 * t));
    }
  const patch = await sharp(file)
    .extract({ left: srcX, top: y, width: w, height: h })

    .removeAlpha()
    .joinChannel(alpha, { raw: { width: w, height: h, channels: 1 } })
    .png()
    .toBuffer();
  const out = await sharp(file).composite([{ input: patch, left: x, top: y }]).png({ compressionLevel: 6 }).toBuffer();
  await fs.writeFile(file, out);
}

async function convert(clip, masters, kind) {
  const dir = path.join(OUT_DIR, clip.id, kind);
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
  // Portrait crop for phones: full height, 4:5 window centred on the athlete.
  const cropW = Math.round((DESKTOP.height * MOBILE.width) / MOBILE.height);
  const left = Math.round(Math.min(DESKTOP.width - cropW, Math.max(0, clip.focusX * DESKTOP.width - cropW / 2)));
  let bytes = 0;
  await pool(masters, CONCURRENCY, async (file, i) => {
    const out = path.join(dir, `frame_${String(i).padStart(PAD, "0")}.webp`);
    let img = sharp(file);
    if (kind === "mobile") img = img.extract({ left, top: 0, width: cropW, height: DESKTOP.height }).resize(MOBILE.width, MOBILE.height, { kernel: "lanczos3" });
    const info = await img.webp({ quality: kind === "mobile" ? MOBILE.quality : DESKTOP.quality, effort: 5, smartSubsample: true }).toFile(out);
    bytes += info.size;
  });
  return bytes;
}

/** Median colour of the frame border, so the page around the video can match it exactly. */
async function edgeColors(file) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const S = 6;
  const left = [], right = [], top = [], bottom = [];
  for (let yy = 0; yy < h; yy += 2) {
    for (let xx = 0; xx < w; xx += 2) {
      const inL = xx < S, inR = xx >= w - S, inT = yy < S, inB = yy >= h - S;
      if (!(inL || inR || inT || inB)) continue;
      const o = (yy * w + xx) * 3;
      const p = [data[o], data[o + 1], data[o + 2]];
      if (inL) left.push(p);
      if (inR) right.push(p);
      if (inT) top.push(p);
      if (inB) bottom.push(p);
    }
  }
  return {
    border: hex(median([...left, ...right, ...top])),
    left: hex(median(left)),
    right: hex(median(right)),
    top: hex(median(top)),
    bottom: hex(median(bottom)),
  };
}

function median(px) {
  return [0, 1, 2].map((c) => {
    const v = px.map((p) => p[c]).sort((a, b) => a - b);
    return v[Math.floor(v.length / 2)] ?? 0;
  });
}
const hex = (rgb) => "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join("");
const mb = (b) => (b / 1024 / 1024).toFixed(1);

async function pool(items, limit, fn) {
  let i = 0;
  const out = new Array(items.length);
  const worker = async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}
