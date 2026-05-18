import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { get, request } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const debugPort = 9333;
const userDataDir = join(tmpdir(), `londoner-chrome-${Date.now()}`);
const appUrl = "http://127.0.0.1:5173/londoner/";
const viewports = [
  { width: 844, height: 390 },
  { width: 852, height: 393 },
  { width: 896, height: 414 },
  { width: 932, height: 430 },
  { width: 740, height: 360 },
];

const chrome = spawn(chromePath, [
  "--headless=new",
  "--disable-gpu",
  "--no-first-run",
  "--no-default-browser-check",
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${userDataDir}`,
  "about:blank",
], { stdio: "ignore" });

function requestJson(url) {
  return new Promise((resolve, reject) => {
    get(url, (response) => {
      let body = "";
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => resolve(JSON.parse(body)));
    }).on("error", reject);
  });
}

function putJson(url) {
  return new Promise((resolve, reject) => {
    const req = request(url, { method: "PUT" }, (response) => {
      let body = "";
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => resolve(JSON.parse(body)));
    });
    req.on("error", reject);
    req.end();
  });
}

async function waitForEndpoint() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      return await requestJson(`http://127.0.0.1:${debugPort}/json/version`);
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("Chrome debug endpoint did not start");
}

class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message));
        else resolve(message.result);
      }
    });
  }

  send(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }
}

async function main() {
  try {
    await waitForEndpoint();
    const target = await putJson(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent("about:blank")}`);
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", reject, { once: true });
    });
    const cdp = new Cdp(socket);

    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    const allFailures = [];
    for (const viewport of viewports) {
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        ...viewport,
        deviceScaleFactor: 2,
        mobile: true,
        screenOrientation: { type: "landscapePrimary", angle: 90 },
      });
      await cdp.send("Page.navigate", { url: appUrl });
      await new Promise((resolve) => setTimeout(resolve, 900));
      await cdp.send("Runtime.evaluate", {
        expression: "localStorage.clear(); location.reload();",
      });
      await new Promise((resolve) => setTimeout(resolve, 900));

      const layout = await cdp.send("Runtime.evaluate", {
        returnByValue: true,
        expression: `(() => {
          const visible = (el) => {
            const rect = el.getBoundingClientRect();
            const style = getComputedStyle(el);
            return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
          };
          return [...document.querySelectorAll(".input-dock .keypad-grid button")]
            .filter(visible)
            .map((button) => {
              const rect = button.getBoundingClientRect();
              return {
                text: button.textContent.trim(),
                className: button.className,
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2,
                width: rect.width,
                height: rect.height,
              };
            });
        })()`,
      });

      console.log(`visible landscape buttons at ${viewport.width}x${viewport.height}:`);
      console.table(layout.result.value.map(({ text, width, height }) => ({ text, width, height })));

      const failures = [];
      for (const button of layout.result.value.filter((item) => /^\d+$/.test(item.text))) {
        const hit = await cdp.send("Runtime.evaluate", {
          returnByValue: true,
          expression: `document.elementFromPoint(${button.x}, ${button.y})?.textContent.trim() ?? ""`,
        });
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ x: button.x, y: button.y }],
        });
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
        await new Promise((resolve) => setTimeout(resolve, 30));
        const latest = await cdp.send("Runtime.evaluate", {
          returnByValue: true,
          expression: `document.querySelector(".queue-chip")?.textContent.trim() ?? ""`,
        });
        if (latest.result.value !== button.text) {
          failures.push({
            viewport: `${viewport.width}x${viewport.height}`,
            button: button.text,
            hit: hit.result.value,
            latest: latest.result.value,
            x: button.x,
            y: button.y,
          });
        }
      }

      allFailures.push(...failures);
      console.log(
        failures.length === 0
          ? `All visible landscape number buttons touched correctly at ${viewport.width}x${viewport.height}.`
          : `Failures at ${viewport.width}x${viewport.height}.`,
      );
    }

    if (allFailures.length > 0) {
      console.table(allFailures);
      process.exitCode = 1;
    }

    const finalStatus = allFailures.length === 0 ? "passed" : "failed";
    console.log(`Landscape keypad touch check ${finalStatus}.`);

    socket.close();
  } finally {
    chrome.kill();
    await new Promise((resolve) => setTimeout(resolve, 500));
    await rm(userDataDir, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 200,
    });
  }
}

main().catch((error) => {
  chrome.kill();
  console.error(error);
  process.exit(1);
});
