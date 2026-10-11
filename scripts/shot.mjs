// Dev helper: screenshots the running dev server.
// usage: node scripts/shot.mjs <outdir> <w>x<h> <query>...
//   query "p=0.2&cam=side"  -> freeze the 3D at progress 0.2 with a debug camera
//   query "s=0.2"           -> load the page normally and scroll 20% through the 3D story
//   query "y=bottom"/"y=#id" -> scroll to the end of the page / an element
import puppeteer from "puppeteer-core";

const [, , out, size, ...queries] = process.argv;
const [w, h] = size.split("x").map(Number);
const base = `http://localhost:${process.env.PORT || 3001}/`;
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--no-sandbox"],
});
const page = await browser.newPage();
page.on("console", (m) => {
  const t = m.text();
  if (["error", "warn"].includes(m.type()) && !/Clock|PCFSoft/.test(t)) console.log("console:", m.type(), t.slice(0, 300));
});
page.on("pageerror", (e) => console.log("pageerror:", e.message.slice(0, 500)));
await page.setViewport({ width: w, height: h, isMobile: w < 768, hasTouch: w < 768 });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let loaded = false;
for (const q of queries) {
  const params = new URLSearchParams(q);
  const name = q.replace(/[^a-z0-9.=_-]+/gi, "_") || "root";
  if (params.has("s") || params.has("y")) {
    if (!loaded) {
      await page.goto(base, { waitUntil: "networkidle0", timeout: 120000 });
      await wait(Number(process.env.WAIT || 6000));
      loaded = true;
    }
    await page.evaluate(async (s, y) => {
      const sec = document.getElementById("top");
      let top;
      if (y === "bottom") top = document.documentElement.scrollHeight;
      else if (y) top = document.querySelector(y).getBoundingClientRect().top + window.scrollY;
      else top = sec.offsetTop + Number(s) * (sec.offsetHeight - window.innerHeight);
      // Step there so scrubbed timelines pass through every state.
      const from = window.scrollY;
      for (let i = 1; i <= 12; i++) {
        window.scrollTo(0, from + ((top - from) * i) / 12);
        await new Promise((r) => setTimeout(r, 40));
      }
    }, params.get("s"), params.get("y"));
    await wait(1800);
  } else {
    await page.goto(`${base}?${q}`, { waitUntil: "networkidle0", timeout: 120000 });
    await wait(Number(process.env.WAIT || 4000));
    loaded = false;
  }
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log("shot", name);
}
await browser.close();
