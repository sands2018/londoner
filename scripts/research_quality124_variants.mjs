import fs from "node:fs";
import path from "node:path";

const PROGRESSION = [1, 2, 4];

function parseNumbers(raw) {
  if (Array.isArray(raw)) return raw.map(Number);
  if (typeof raw === "string") return raw.split(",").map((part) => Number(part.trim())).filter((value) => Number.isFinite(value));
  return [];
}

function historyDataTms(entry, fallback = 0) {
  const value = entry?.DataTms ?? entry?.dataTms ?? entry?.tms ?? fallback;
  const tms = Number(value);
  return Number.isFinite(tms) ? tms : fallback;
}

function loadSessions() {
  const root = path.resolve(import.meta.dirname, "..");
  const raw = JSON.parse(fs.readFileSync(path.join(root, "history_data.json"), "utf8"));
  return raw
    .map((entry, index) => ({
      index,
      name: String(entry.Name ?? `session-${index}`),
      numbers: parseNumbers(entry.Numbers),
      tms: historyDataTms(entry, index),
    }))
    .filter((session) => session.numbers.length > 0)
    .sort((a, b) => (a.tms - b.tms) || (a.index - b.index));
}

function groupOf(value) {
  if (value === 0) return null;
  return Math.floor((value - 1) / 12);
}

function avg(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function clamp(value) {
  return Math.max(0, Math.min(1, value));
}

function variance(values) {
  if (values.length < 2) return 0;
  const mean = avg(values);
  return values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
}

function zoneRate(gaps, entryAfter, window = 18) {
  const recent = gaps.slice(-window);
  if (!recent.length) return 0;
  const hi = entryAfter + PROGRESSION.length - 1;
  return recent.filter((gap) => gap >= entryAfter && gap <= hi).length / recent.length;
}

function concentration(gaps, window = 18, entryAfter = 0, closestMode = false) {
  const recent = gaps.slice(-window);
  if (!recent.length) return 0;
  const counts = new Map();
  for (const gap of recent) counts.set(gap, (counts.get(gap) ?? 0) + 1);
  let mode = 0;
  let modeCount = -1;
  for (const [gap, count] of counts) {
    const betterCount = count > modeCount;
    const betterTie = closestMode
      ? count === modeCount && Math.abs(gap - entryAfter) < Math.abs(mode - entryAfter)
      : count === modeCount && gap < mode;
    if (betterCount || betterTie) {
      mode = gap;
      modeCount = count;
    }
  }
  return recent.filter((gap) => Math.abs(gap - mode) <= 1).length / recent.length;
}

function tempoBand(gaps, varDivisor = 6) {
  if (gaps.length < 6) return "unknown";
  const recent6 = gaps.slice(-6);
  const recent12 = gaps.slice(-12);
  const previous6 = gaps.slice(-12, -6);
  const mean6 = avg(recent6);
  const mean12 = avg(recent12);
  const prior6 = avg(previous6);
  const delta6 = avg(recent6.slice(1).map((value, index) => Math.abs(value - recent6[index])));
  const var6 = variance(recent6);
  const score =
    0.42 * clamp((3.2 - mean6) / 2.7) +
    0.26 * clamp(delta6 / 2.8) +
    0.22 * (previous6.length ? clamp((prior6 - mean6) / 2.5) : 0) +
    0.10 * clamp(var6 / varDivisor);
  if (score >= 0.68) return "fast";
  if (score >= 0.48) return "medium_fast";
  if (score <= 0.24 || mean12 >= 3.4) return "slow";
  return "medium";
}

function selectTier(state, entryAfter, options) {
  if (state.ci !== 1 && state.ci !== 2) return null;
  if (state.gaps.length < 18) return null;
  const z = zoneRate(state.gaps, entryAfter);
  const c = concentration(state.gaps, 18, entryAfter, options.closestMode);
  const band = tempoBand(state.gaps, options.varDivisor);
  const notFast = band !== "fast" && band !== "unknown";

  if (state.ci === 1 && entryAfter === 4 && z >= 0.25 && c >= 0.45) return { tier: "low", z, c, band };
  if (state.ci === 2 && (entryAfter === 3 || entryAfter === 4) && z >= 0.25 && c >= 0.45 && notFast) return { tier: "medium", z, c, band };
  if ((entryAfter === 3 || entryAfter === 4) && z >= 0.25 && c >= 0.45 && notFast) return { tier: "high", z, c, band };
  if (entryAfter === 3 && z >= 0.20 && c >= 0.45 && notFast) return { tier: "ultra", z, c, band };
  return null;
}

function runSession(session, options) {
  const states = [0, 1, 2].map((ci) => ({ ci, missCount: 0, seen: false, gaps: [], active: new Map() }));
  const events = [];

  for (let index = 0; index < session.numbers.length; index += 1) {
    const group = groupOf(session.numbers[index]);

    for (const state of states) {
      const hit = group === state.ci;
      for (const [entryAfter, active] of [...state.active.entries()]) {
        const amount = PROGRESSION[active.roundIndex];
        active.bet += amount;
        if (hit) {
          events.push({ ...active, hit: true, bet: active.bet, win: amount * 3, net: amount * 3 - active.bet, hitRound: active.roundIndex + 1 });
          state.active.delete(entryAfter);
        } else {
          active.roundIndex += 1;
          if (active.roundIndex >= PROGRESSION.length) {
            events.push({ ...active, hit: false, bet: active.bet, win: 0, net: -active.bet, hitRound: -1 });
            state.active.delete(entryAfter);
          }
        }
      }
    }

    for (const state of states) {
      const hit = group === state.ci;
      if (hit) {
        if (state.seen) state.gaps.push(state.missCount);
        state.missCount = 0;
        state.seen = true;
      } else if (state.seen) {
        state.missCount += 1;
      }
    }

    for (const state of states) {
      if (!state.seen) continue;
      const entryAfter = state.missCount;
      if (entryAfter < 3 || entryAfter > 4 || state.active.has(entryAfter)) continue;
      const selected = selectTier(state, entryAfter, options);
      if (!selected) continue;
      state.active.set(entryAfter, {
        session: session.name,
        year: session.name.slice(0, 4),
        entrySpin: index + 1,
        ci: state.ci,
        tier: selected.tier,
        entryAfter,
        roundIndex: 0,
        bet: 0,
        band: selected.band,
      });
    }
  }
  return events;
}

function summarize(events) {
  const bet = events.reduce((sum, event) => sum + event.bet, 0);
  const win = events.reduce((sum, event) => sum + event.win, 0);
  let peak = 0;
  let cur = 0;
  let dd = 0;
  for (const event of events) {
    cur += event.net;
    peak = Math.max(peak, cur);
    dd = Math.max(dd, peak - cur);
  }
  return {
    signals: events.length,
    bet,
    win,
    net: win - bet,
    roi: bet ? ((win - bet) / bet) * 100 : 0,
    hits: events.filter((event) => event.hit).length,
    wr: events.length ? events.filter((event) => event.hit).length / events.length * 100 : 0,
    dd,
  };
}

function fmt(summary) {
  return `sig=${String(summary.signals).padStart(4)} bet=${String(summary.bet).padStart(5)} net=${String(summary.net).padStart(5)} ROI=${summary.roi.toFixed(2).padStart(7)}% DD=${String(summary.dd).padStart(4)} WR=${summary.wr.toFixed(1).padStart(5)}%`;
}

function groupBy(events, keyFn) {
  const out = new Map();
  for (const event of events) {
    const key = keyFn(event);
    if (!out.has(key)) out.set(key, []);
    out.get(key).push(event);
  }
  return out;
}

const variants = [
  ["A-current", { closestMode: false, varDivisor: 6 }],
  ["B-closest-mode", { closestMode: true, varDivisor: 6 }],
  ["C-var12", { closestMode: false, varDivisor: 12 }],
  ["D-both", { closestMode: true, varDivisor: 12 }],
];

const sessions = loadSessions();
console.log(`Loaded ${sessions.length} sessions, ${sessions.reduce((sum, s) => sum + s.numbers.length, 0)} spins`);

for (const [name, options] of variants) {
  const events = sessions.flatMap((session) => runSession(session, options));
  const from201 = events.filter((event) => event.entrySpin >= 200);
  const recent3 = new Set(sessions.slice(-3).map((session) => session.name));
  const recent10 = new Set(sessions.slice(-10).map((session) => session.name));

  console.log(`\n=== ${name} ===`);
  console.log(`all     ${fmt(summarize(events))}`);
  console.log(`from201 ${fmt(summarize(from201))}`);
  console.log(`recent3 ${fmt(summarize(events.filter((event) => recent3.has(event.session))))}`);
  console.log(`recent10 ${fmt(summarize(events.filter((event) => recent10.has(event.session))))}`);

  console.log("-- tiers");
  for (const tier of ["low", "medium", "high", "ultra"]) {
    console.log(`${tier.padEnd(6)} ${fmt(summarize(events.filter((event) => event.tier === tier)))}`);
  }

  console.log("-- years");
  for (const [year, items] of [...groupBy(events, (event) => event.year).entries()].sort()) {
    console.log(`${year} ${fmt(summarize(items))}`);
  }

  console.log("-- recent sessions");
  for (const session of sessions.slice(-10)) {
    const items = events.filter((event) => event.session === session.name);
    console.log(`${session.name.padEnd(28)} ${fmt(summarize(items))}`);
  }
}
