import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";

const appUrl = "http://127.0.0.1:5173/londoner/";
const outputDir = "test-results/landscape-keypad";
const viewports = [
  { width: 844, height: 390, name: "iphone-15-landscape" },
  { width: 932, height: 430, name: "iphone-max-landscape" },
  { width: 740, height: 360, name: "compact-landscape" },
];

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ channel: "chrome" });
const failures = [];

try {
  for (const viewport of viewports) {
    const page = await browser.newPage({
      deviceScaleFactor: 2,
      hasTouch: true,
      isMobile: true,
      viewport: { width: viewport.width, height: viewport.height },
    });

    await page.goto(appUrl);
    await page.evaluate(() => {
      localStorage.clear();
      location.reload();
    });
    await page.waitForLoadState("networkidle");

    await page.screenshot({
      fullPage: false,
      path: `${outputDir}/${viewport.name}.png`,
    });

    const buttons = await page.locator(".input-dock .keypad-grid button, .input-dock .board-grid button").evaluateAll((items) =>
      items.map((button) => {
        const rect = button.getBoundingClientRect();
        return {
          bottom: rect.bottom,
          height: rect.height,
          text: button.textContent?.trim() ?? "",
          top: rect.top,
          width: rect.width,
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        };
      }),
    );

    const maxBottom = Math.max(...buttons.map((button) => button.bottom));
    if (maxBottom > viewport.height + 1) {
      failures.push({
        actual: maxBottom,
        expected: viewport.height,
        problem: "keyboard exceeds viewport",
        viewport: viewport.name,
      });
    }

    for (const button of buttons.filter((item) => /^\d+$/.test(item.text))) {
      await page.touchscreen.tap(button.x, button.y);
      await page.waitForTimeout(20);
      const latest = await page.locator(".queue-chip").first().textContent();
      if (latest?.trim() !== button.text) {
        failures.push({
          button: button.text,
          latest: latest?.trim() ?? "",
          problem: "wrong number after tap",
          viewport: viewport.name,
        });
      }
    }

    console.log(`${viewport.name}: ${buttons.length} buttons, max bottom ${maxBottom.toFixed(1)} / ${viewport.height}`);
    await page.close();
  }
} finally {
  await browser.close();
}

if (failures.length > 0) {
  console.table(failures);
  process.exit(1);
}

console.log(`Playwright landscape keypad check passed. Screenshots saved in ${outputDir}`);
