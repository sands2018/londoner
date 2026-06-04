import fs from "node:fs";
import path from "node:path";

const PROGRESSION_SINGLE = [1];
const PROGRESSION_12 = [1, 2];
const PROGRESSION_124 = [1, 2, 4];

function parseNumbers(raw) {
  if (Array.isArray(raw)) return raw.map(Number);
  if (typeof raw === "string") return raw.split(",").map((part) => Number(part.trim())).filter(Number.isFinite);
  return [];
}

function loadSessions() {
  const root = path.resolve(import.meta.dirname, "..");
  const raw = JSON.parse(fs.readFileSync(path.join(root, "history_data.json"), "utf8"));
  return raw
    .map((entry, index) => ({
      index,
      name: String(entry.Name ?? `session-${index}`),
      tms: Number(entry.tms ?? 0),
      numbers: parseNumbers(entry.Numbers),
    }))
    .filter((session) => session.numbers.length > 0)
    .sort((a, b) => (a.tms - b.tms) || (a.index - b.index));
}

function counts(nums, start, end) {
  const out = Array(37).fill(0);
  for (let i = Math.max(0, start); i < Math.min(nums.length, end); i += 1) out[nums[i]] += 1;
  return out;
}

function distance(nums, n, end = nums.length) {
  let dist = 0;
  for (let i = end - 1; i >= 0; i -= 1) {
    if (nums[i] === n) return dist;
    dist += 1;
  }
  return end;
}

function topByScore(scores, n, includeTies = false) {
  const entries = [];
  for (let num = 1; num <= 36; num += 1) entries.push({ num, score: scores[num] ?? 0 });
  entries.sort((a, b) => b.score - a.score || a.num - b.num);
  if (!includeTies) return entries.slice(0, n).map((item) => item.num);
  const cutoff = entries[Math.min(n - 1, entries.length - 1)]?.score ?? 0;
  return entries.filter((item) => item.score >= cutoff).map((item) => item.num);
}

function currentUiTrend(nums, n, window) {
  if (window <= 74) {
    const start = Math.max(0, nums.length - window);
    const mid = start + Math.floor(window / 2);
    const c = counts(nums, start, mid)[n];
    const r = counts(nums, mid, nums.length)[n];
    if (r - c >= 2) return "up";
    if (r - c <= -2) return "down";
    return "flat";
  }
  const start = Math.max(0, nums.length - window);
  const recentLen = Math.min(Math.floor(window / 3), 40);
  const recentStart = nums.length - recentLen;
  const recent = counts(nums, recentStart, nums.length)[n];
  const earlier = counts(nums, start, recentStart)[n];
  const recentRate = recent / recentLen;
  const earlierRate = earlier / Math.max(1, window - recentLen);
  const ratio = earlierRate > 0 ? recentRate / earlierRate : (recentRate > 0 ? 999 : 1);
  if (ratio >= 1.5 && recent >= 2) return "up";
  if (ratio <= 0.5 && earlier >= 2) return "down";
  return "flat";
}

const trendFns = {
  none: () => true,
  uiUp: (nums, n, window) => currentUiTrend(nums, n, window) === "up",
  halfUp1: (nums, n, window) => {
    const start = Math.max(0, nums.length - window);
    const mid = start + Math.floor(window / 2);
    return counts(nums, mid, nums.length)[n] > counts(nums, start, mid)[n];
  },
  zUp: (nums, n, window) => {
    const curr = counts(nums, Math.max(0, nums.length - window), nums.length)[n];
    const prev = counts(nums, Math.max(0, nums.length - 2 * window), Math.max(0, nums.length - window))[n];
    const expected = prev / Math.max(1, window) * window;
    const sigma = Math.sqrt(Math.max(0.25, expected * (1 - 1 / 37)));
    return (curr - expected) / sigma >= 0.75;
  },
  acceleration: (nums, n, window) => {
    const third = Math.floor(window / 3);
    const a = counts(nums, nums.length - window, nums.length - 2 * third)[n];
    const b = counts(nums, nums.length - 2 * third, nums.length - third)[n];
    const c = counts(nums, nums.length - third, nums.length)[n];
    return c >= b && b >= a && c > a && c >= 1;
  },
  freshHot: (nums, n, window) => distance(nums, n) <= Math.max(8, Math.floor(window / 4)),
};

function selectHot(nums, opts) {
  if (nums.length < opts.warmup) return [];
  const hotCounts = counts(nums, Math.max(0, nums.length - opts.window), nums.length);
  let candidates = topByScore(hotCounts, opts.pool, opts.tie);
  if (opts.multi) {
    const sets = opts.multi.map((w) => new Set(topByScore(counts(nums, Math.max(0, nums.length - w), nums.length), opts.pool, false)));
    candidates = candidates.filter((n) => sets.filter((set) => set.has(n)).length >= opts.multiNeed);
  }
  if (opts.trend && opts.trend !== "none") candidates = candidates.filter((n) => trendFns[opts.trend](nums, n, opts.window));
  if (opts.minCount) candidates = candidates.filter((n) => hotCounts[n] >= opts.minCount);
  if (opts.maxRecentCount) {
    const burst = counts(nums, Math.max(0, nums.length - opts.burstWindow), nums.length);
    candidates = candidates.filter((n) => burst[n] <= opts.maxRecentCount);
  }
  candidates.sort((a, b) => hotCounts[b] - hotCounts[a] || distance(nums, a) - distance(nums, b) || a - b);
  return candidates.slice(0, opts.maxNumbers);
}

function backtestSession(session, opts) {
  let bet = 0;
  let win = 0;
  let signals = 0;
  let hits = 0;
  const events = [];
  const active = [];
  for (let i = 0; i < session.numbers.length; i += 1) {
    const value = session.numbers[i];
    for (let j = active.length - 1; j >= 0; j -= 1) {
      const chase = active[j];
      const amount = chase.progression[chase.round];
      bet += amount * chase.numbers.length;
      const hit = chase.numbers.includes(value);
      if (hit) {
        win += amount * 36;
        hits += 1;
        events.push({ session: session.name, year: session.name.slice(0, 4), spin: i, net: amount * 36 - amount * chase.numbers.length, bet: amount * chase.numbers.length, win: amount * 36, hit: true });
        active.splice(j, 1);
      } else {
        chase.round += 1;
        if (chase.round >= chase.progression.length) {
          events.push({ session: session.name, year: session.name.slice(0, 4), spin: i, net: -chase.progression.reduce((sum, amt) => sum + amt * chase.numbers.length, 0), bet: chase.progression.reduce((sum, amt) => sum + amt * chase.numbers.length, 0), win: 0, hit: false });
          active.splice(j, 1);
        }
      }
    }
    if (active.length && !opts.allowOverlap) continue;
    const picks = selectHot(session.numbers.slice(0, i), opts);
    if (!picks.length) continue;
    signals += 1;
    active.push({ numbers: picks, progression: opts.progression, round: 0 });
  }
  return { bet, win, signals, hits, events };
}

function summarize(events) {
  const bet = events.reduce((s, e) => s + e.bet, 0);
  const win = events.reduce((s, e) => s + e.win, 0);
  let cur = 0;
  let peak = 0;
  let dd = 0;
  for (const event of events) {
    cur += event.net;
    peak = Math.max(peak, cur);
    dd = Math.max(dd, peak - cur);
  }
  return { signals: events.length, bet, win, net: win - bet, roi: bet ? (win - bet) / bet * 100 : 0, hits: events.filter((e) => e.hit).length, wr: events.length ? events.filter((e) => e.hit).length / events.length * 100 : 0, dd };
}

function groupBy(items, keyFn) {
  const out = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!out.has(key)) out.set(key, []);
    out.get(key).push(item);
  }
  return out;
}

function fmt(s) {
  return `sig=${String(s.signals).padStart(5)} bet=${String(s.bet).padStart(6)} net=${String(s.net).padStart(6)} ROI=${s.roi.toFixed(2).padStart(7)}% DD=${String(s.dd).padStart(5)} WR=${s.wr.toFixed(1).padStart(5)}%`;
}

function runAll(sessions, opts) {
  const events = sessions.flatMap((session) => backtestSession(session, opts).events);
  const from201 = events.filter((e) => e.spin >= 200);
  const r3 = new Set(sessions.slice(-3).map((s) => s.name));
  const r10 = new Set(sessions.slice(-10).map((s) => s.name));
  return {
    all: summarize(events),
    from201: summarize(from201),
    recent3: summarize(events.filter((e) => r3.has(e.session))),
    recent10: summarize(events.filter((e) => r10.has(e.session))),
    events,
  };
}

const sessions = loadSessions();
console.log(`Loaded ${sessions.length} sessions, ${sessions.reduce((s, x) => s + x.numbers.length, 0)} spins`);

const candidates = [];
for (const window of [37, 74, 111, 148, 185, 222]) {
  for (const pool of [3, 5, 8, 10]) {
    for (const maxNumbers of [1, 2, 3, 5]) {
      if (maxNumbers > pool) continue;
      for (const trend of ["none", "uiUp", "halfUp1", "zUp", "acceleration", "freshHot"]) {
        for (const prog of [PROGRESSION_SINGLE, PROGRESSION_12, PROGRESSION_124]) {
          const opts = { window, pool, maxNumbers, trend, progression: prog, warmup: Math.max(74, window), tie: false, allowOverlap: false };
          const r = runAll(sessions, opts);
          if (r.all.signals < 80) continue;
          candidates.push({ opts, r });
        }
      }
    }
  }
}

for (const multiNeed of [2, 3]) {
  for (const pool of [5, 8, 10]) {
    for (const maxNumbers of [1, 2, 3, 5]) {
      if (maxNumbers > pool) continue;
      for (const trend of ["none", "uiUp", "halfUp1", "zUp", "acceleration", "freshHot"]) {
        const opts = { window: 37, pool, maxNumbers, trend, progression: PROGRESSION_SINGLE, warmup: 222, tie: false, allowOverlap: false, multi: [37, 74, 111], multiNeed };
        const r = runAll(sessions, opts);
        if (r.all.signals < 80) continue;
        candidates.push({ opts, r });
      }
    }
  }
}

function score(item) {
  return Math.min(item.r.all.roi, item.r.from201.roi, item.r.recent10.roi, item.r.recent3.roi) * 1000 + item.r.all.roi - item.r.all.dd / 100;
}

const viable = candidates
  .filter((x) => x.r.all.roi > 0 && x.r.from201.roi > 0 && x.r.recent10.roi > 0 && x.r.recent3.roi > 0)
  .sort((a, b) => score(b) - score(a));

console.log("\n=== Best viable hot-number strategies ===");
for (const item of viable.slice(0, 25)) {
  const o = item.opts;
  console.log(`${fmt(item.r.all)} | 201 ${item.r.from201.roi.toFixed(2).padStart(6)}% R3 ${item.r.recent3.roi.toFixed(2).padStart(6)}% R10 ${item.r.recent10.roi.toFixed(2).padStart(6)}% | w=${o.window} pool=${o.pool} betN=${o.maxNumbers} trend=${o.trend} prog=${o.progression.join("-")} multi=${o.multi ? `${o.multiNeed}/3` : "-"}`);
}

console.log("\n=== Detail for top 5 viable strategies ===");
for (const item of viable.slice(0, 5)) {
  const o = item.opts;
  console.log(`\n--- w=${o.window} pool=${o.pool} betN=${o.maxNumbers} trend=${o.trend} prog=${o.progression.join("-")} multi=${o.multi ? `${o.multiNeed}/3` : "-"} ---`);
  const byYear = new Map();
  for (const event of item.r.events) {
    if (!byYear.has(event.year)) byYear.set(event.year, []);
    byYear.get(event.year).push(event);
  }
  console.log("years:");
  for (const [year, events] of [...byYear.entries()].sort()) console.log(`${year} ${fmt(summarize(events))}`);
  console.log("recent sessions:");
  for (const session of sessions.slice(-12)) {
    const events = item.r.events.filter((event) => event.session === session.name);
    console.log(`${session.name.padEnd(28)} ${fmt(summarize(events))}`);
  }
  const bySession = [...groupBy(item.r.events, (event) => event.session).entries()]
    .map(([session, events]) => ({ session, s: summarize(events) }))
    .sort((a, b) => b.s.net - a.s.net);
  const positive = bySession.filter((row) => row.s.net > 0).reduce((sum, row) => sum + row.s.net, 0);
  const top3 = bySession.slice(0, 3).reduce((sum, row) => sum + Math.max(0, row.s.net), 0);
  console.log(`top3 positive share=${positive ? (top3 / positive * 100).toFixed(1) : "0.0"}%`);
  console.log("top winners:");
  for (const row of bySession.slice(0, 5)) console.log(`${row.session.padEnd(28)} ${fmt(row.s)}`);
  console.log("top losers:");
  for (const row of bySession.slice(-5)) console.log(`${row.session.padEnd(28)} ${fmt(row.s)}`);
}

console.log("\n=== Current UI trend baselines ===");
for (const window of [37, 74, 111, 185, 222]) {
  for (const maxNumbers of [1, 3, 5]) {
    const opts = { window, pool: 5, maxNumbers, trend: "uiUp", progression: PROGRESSION_SINGLE, warmup: Math.max(74, window), tie: false, allowOverlap: false };
    const r = runAll(sessions, opts);
    console.log(`${fmt(r.all)} | 201 ${r.from201.roi.toFixed(2).padStart(6)}% R3 ${r.recent3.roi.toFixed(2).padStart(6)}% R10 ${r.recent10.roi.toFixed(2).padStart(6)}% | UI trend w=${window} betN=${maxNumbers}`);
  }
}
