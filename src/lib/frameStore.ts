/**
 * Image-sequence store built to stay within mobile memory limits.
 *
 * - Every frame is downloaded once and kept as a *compressed* Blob (~30–60 KB each).
 * - Only a small sliding window of frames around the playhead is *decoded*
 *   (ImageBitmap where supported). Decoded frames outside the window are closed.
 *
 * Decoding all frames up front would hold ~2 MB (mobile) to ~8 MB (desktop) of raw pixels
 * per frame, i.e. hundreds of MB to GBs, which makes phones kill the tab.
 *
 * Download order: the first `priority` frames, then progressive passes (every 8th,
 * 4th, 2nd, then the rest), so a nearby frame is always available even if the user
 * scrolls ahead of the download.
 */
export type Frame = ImageBitmap | HTMLImageElement;

type Options = {
  urls: string[];
  priority: number;
  chunkSize: number;
  concurrency: number;
  /** Max decoded frames kept in memory at once. */
  maxDecoded: number;
  onPriorityProgress?: (loaded: number, total: number) => void;
  onPriorityDone?: () => void;
};

const supportsBitmap = typeof window !== "undefined" && "createImageBitmap" in window;
const MAX_PARALLEL_DECODES = 2;

export class FrameStore {
  readonly count: number;
  private blobs: (Blob | undefined)[];
  private decoded = new Map<number, Frame>();
  private decoding = new Set<number>();
  private abort = new AbortController();
  private disposed = false;
  private center = 0;
  private direction = 1;

  constructor(private opts: Options) {
    this.count = opts.urls.length;
    this.blobs = new Array(this.count);
  }

  async start() {
    const { priority, chunkSize, concurrency } = this.opts;
    const first = Array.from({ length: Math.min(priority, this.count) }, (_, i) => i);
    let done = 0;
    await this.fetchAll(first, concurrency, () => {
      done++;
      this.opts.onPriorityProgress?.(done, first.length);
    });
    if (this.disposed) return;
    // Make sure the first frame is decoded before the preloader lets go.
    await this.decode(0).catch(() => {});
    if (this.disposed) return;
    this.opts.onPriorityDone?.();

    const rest = progressiveOrder(this.count).filter((i) => !this.blobs[i]);
    for (let i = 0; i < rest.length && !this.disposed; i += chunkSize) {
      await idle();
      await this.fetchAll(rest.slice(i, i + chunkSize), concurrency);
    }
  }

  /**
   * Tell the store where the playhead is. Decodes the frames around it (more ahead
   * in the direction of travel) and frees the ones furthest away.
   */
  focus(index: number) {
    const i = this.clamp(Math.round(index));
    if (i !== this.center) this.direction = i > this.center ? 1 : -1;
    this.center = i;
    this.pump();
  }

  /** The requested frame if decoded, otherwise the closest decoded one. */
  nearest(index: number): Frame | undefined {
    const i = this.clamp(Math.round(index));
    const exact = this.decoded.get(i);
    if (exact) return exact;
    let best: Frame | undefined;
    let bestDist = Infinity;
    for (const [k, f] of this.decoded) {
      const d = Math.abs(k - i);
      if (d < bestDist) {
        bestDist = d;
        best = f;
      }
    }
    return best;
  }

  dispose() {
    this.disposed = true;
    this.abort.abort();
    for (const f of this.decoded.values()) release(f);
    this.decoded.clear();
    this.blobs = [];
  }

  // --- Decoding window -------------------------------------------------------

  private pump() {
    if (this.disposed) return;
    const wanted = this.windowIndices();
    for (const i of wanted) {
      if (this.decoding.size >= MAX_PARALLEL_DECODES) break;
      if (this.decoded.has(i) || this.decoding.has(i)) continue;
      this.decode(i).catch(() => {});
    }
    this.evict(new Set(wanted));
  }

  /** Frames to keep decoded, closest-first, biased ahead of the direction of travel. */
  private windowIndices(): number[] {
    const max = this.opts.maxDecoded;
    const ahead = Math.ceil(max * 0.7);
    const behind = max - ahead;
    const out: number[] = [];
    const push = (i: number) => {
      if (i < 0 || i >= this.count) return;
      // If this exact frame hasn't downloaded yet, use the nearest downloaded one.
      const j = this.blobs[i] ? i : this.nearestBlob(i);
      if (j !== -1 && !out.includes(j)) out.push(j);
    };
    push(this.center);
    for (let d = 1; d <= Math.max(ahead, behind); d++) {
      if (d <= ahead) push(this.center + d * this.direction);
      if (d <= behind) push(this.center - d * this.direction);
    }
    return out.slice(0, max);
  }

  private evict(keep: Set<number>) {
    if (this.decoded.size <= this.opts.maxDecoded) return;
    const candidates = [...this.decoded.keys()]
      .filter((k) => !keep.has(k))
      .sort((a, b) => Math.abs(b - this.center) - Math.abs(a - this.center));
    for (const k of candidates) {
      if (this.decoded.size <= this.opts.maxDecoded) break;
      release(this.decoded.get(k)!);
      this.decoded.delete(k);
    }
  }

  private async decode(i: number) {
    const blob = this.blobs[i];
    if (!blob || this.decoded.has(i) || this.decoding.has(i)) return;
    this.decoding.add(i);
    try {
      const frame = await decodeBlob(blob);
      if (this.disposed) {
        release(frame);
        return;
      }
      this.decoded.set(i, frame);
    } finally {
      this.decoding.delete(i);
    }
    this.pump();
  }

  private nearestBlob(i: number): number {
    for (let d = 1; d < this.count; d++) {
      if (this.blobs[i - d]) return i - d;
      if (this.blobs[i + d]) return i + d;
    }
    return -1;
  }

  // --- Downloading -----------------------------------------------------------

  private async fetchAll(indices: number[], limit: number, onEach?: () => void) {
    let next = 0;
    const worker = async () => {
      while (next < indices.length && !this.disposed) {
        const idx = indices[next++];
        try {
          const res = await fetch(this.opts.urls[idx], { signal: this.abort.signal });
          if (!res.ok) throw new Error(`${res.status} ${this.opts.urls[idx]}`);
          const blob = await res.blob();
          if (this.disposed) return;
          this.blobs[idx] = blob;
        } catch (err) {
          if ((err as Error).name !== "AbortError") console.warn(`Frame ${idx} failed to load`, err);
        }
        onEach?.();
      }
    };
    await Promise.all(Array.from({ length: Math.min(limit, indices.length) }, worker));
    this.pump();
  }

  private clamp(i: number) {
    return Math.max(0, Math.min(this.count - 1, i));
  }
}

async function decodeBlob(blob: Blob): Promise<Frame> {
  if (supportsBitmap) return createImageBitmap(blob);
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function release(frame: Frame) {
  if ("close" in frame) frame.close();
  else frame.src = "";
}

/** 0, 8, 16… then 4, 12… then 2, 6… then odd indices. */
function progressiveOrder(count: number): number[] {
  const order: number[] = [];
  const seen = new Set<number>();
  for (let step = 8; step >= 1; step /= 2) {
    for (let i = 0; i < count; i += step) {
      if (!seen.has(i)) {
        seen.add(i);
        order.push(i);
      }
    }
  }
  return order;
}

function idle(): Promise<void> {
  return new Promise((resolve) => {
    if ("requestIdleCallback" in window) window.requestIdleCallback(() => resolve(), { timeout: 200 });
    else setTimeout(resolve, 16);
  });
}
