import fs from "node:fs";

const HISTORY_PATH = "history_data.json";
const BET_START = 200;
const PAYOUT = 36;

const wheelOrder = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
  5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

const wheelPos = Array(37).fill(-1);
for (let index = 0; index < wheelOrder.length; index += 1) {
  wheelPos[wheelOrder[index]] = index;
}

const sectorSetCache = new Map();
const sectorPrefixCache = new WeakMap();
const offsetPrefixCache = new WeakMap();
const bestSectorWindowCache = new WeakMap();
const offsetCandidateCache = new WeakMap();

function parseNumbers(text) {
  return String(text)
    .split(/[,，\s]+/)
    .map((item) => Number(item.trim()))
    .filter((value) => Number.isInteger(value) && value >= 0 && value <= 36);
}

function loadSessions() {
  const rows = JSON.parse(fs.readFileSync(HISTORY_PATH, "utf8"));
  return rows.map((row, index) => {
    const numbers = Array.isArray(row.Numbers) ? row.Numbers : parseNumbers(row.Numbers);
    return {
      index,
      name: row.Name ?? `session-${index + 1}`,
      saveTime: row.SaveTime ?? "",
      month: String(row.SaveTime ?? row.Name ?? "").slice(0, 7),
      casino: detectCasino(row.Name ?? ""),
      numbers,
    };
  });
}

function detectCasino(name) {
  if (name.includes("澳门永利")) return "澳门永利";
  if (name.includes("威尼斯人")) return "威尼斯人";
  if (name.includes("银河")) return "银河";
  if (name.includes("喜来登")) return "喜来登";
  if (name.includes("伦敦人")) return "伦敦人";
  if (name.includes("巴黎人")) return "巴黎人";
  return "";
}

function wheelDistance(a, b) {
  const distance = Math.abs(wheelPos[a] - wheelPos[b]);
  return Math.min(distance, 37 - distance);
}

function signedWheelDistance(a, b) {
  let diff = wheelPos[b] - wheelPos[a];
  if (diff > 18) diff -= 37;
  if (diff < -18) diff += 37;
  return diff;
}

function getSectorPrefix(numbers, radius) {
  let byRadius = sectorPrefixCache.get(numbers);
  if (!byRadius) {
    byRadius = new Map();
    sectorPrefixCache.set(numbers, byRadius);
  }
  if (byRadius.has(radius)) return byRadius.get(radius);

  const prefix = Array.from({ length: 37 }, () => Array(numbers.length + 1).fill(0));
  for (let centerIndex = 0; centerIndex < 37; centerIndex += 1) {
    const center = wheelOrder[centerIndex];
    const set = sectorSet(center, radius);
    for (let index = 0; index < numbers.length; index += 1) {
      prefix[centerIndex][index + 1] = prefix[centerIndex][index] + (set.has(numbers[index]) ? 1 : 0);
    }
  }

  byRadius.set(radius, prefix);
  return prefix;
}

function getOffsetPrefix(numbers) {
  let cached = offsetPrefixCache.get(numbers);
  if (cached) return cached;

  const prefix = Array.from({ length: 37 }, () => Array(numbers.length + 1).fill(0));
  for (let index = 1; index < numbers.length; index += 1) {
    for (let row = 0; row < 37; row += 1) {
      prefix[row][index + 1] = prefix[row][index];
    }
    const offset = signedWheelDistance(numbers[index - 1], numbers[index]);
    prefix[offset + 18][index + 1] += 1;
  }

  offsetPrefixCache.set(numbers, prefix);
  return prefix;
}

function sectorNumbers(center, radius) {
  const pos = wheelPos[center];
  const out = [];
  for (let offset = -radius; offset <= radius; offset += 1) {
    out.push(wheelOrder[(pos + offset + 37) % 37]);
  }
  return out;
}

function sectorSet(center, radius) {
  const key = `${center}:${radius}`;
  let cached = sectorSetCache.get(key);
  if (!cached) {
    cached = new Set(sectorNumbers(center, radius));
    sectorSetCache.set(key, cached);
  }
  return cached;
}

function countInSector(numbers, start, end, center, radius) {
  const prefix = getSectorPrefix(numbers, radius);
  const centerIndex = wheelPos[center];
  return prefix[centerIndex][end] - prefix[centerIndex][start];
}

function bestSector(numbers, start, end, radius) {
  let best = null;
  for (const center of wheelOrder) {
    const hits = countInSector(numbers, start, end, center, radius);
    if (!best || hits > best.hits) {
      best = { center, hits };
    }
  }
  return best;
}

function getBestSectorWindow(numbers, window, radius) {
  let byKey = bestSectorWindowCache.get(numbers);
  if (!byKey) {
    byKey = new Map();
    bestSectorWindowCache.set(numbers, byKey);
  }
  const key = `${window}:${radius}`;
  if (byKey.has(key)) return byKey.get(key);

  const rows = Array(numbers.length + 1).fill(null);
  for (let end = window; end <= numbers.length; end += 1) {
    rows[end] = bestSector(numbers, end - window, end, radius);
  }
  byKey.set(key, rows);
  return rows;
}

function getOffsetCandidatesWindow(numbers, window, maxAbsOffset) {
  let byKey = offsetCandidateCache.get(numbers);
  if (!byKey) {
    byKey = new Map();
    offsetCandidateCache.set(numbers, byKey);
  }
  const key = `${window}:${maxAbsOffset}`;
  if (byKey.has(key)) return byKey.get(key);

  const prefix = getOffsetPrefix(numbers);
  const rows = Array(numbers.length + 1).fill(null);
  for (let end = window + 1; end <= numbers.length; end += 1) {
    const start = end - window;
    const counts = [];
    for (let offset = -maxAbsOffset; offset <= maxAbsOffset; offset += 1) {
      const count = prefix[offset + 18][end] - prefix[offset + 18][start];
      if (count > 0) counts.push([offset, count]);
    }
    rows[end] = counts.sort((a, b) => b[1] - a[1] || Math.abs(a[0]) - Math.abs(b[0]));
  }
  byKey.set(key, rows);
  return rows;
}

function makeRoi() {
  return { signals: 0, bet: 0, hits: 0, win: 0, net: 0, roi: 0, maxDrawdown: 0 };
}

function addNet(roi, net, hit, bet) {
  roi.signals += 1;
  roi.bet += bet;
  if (hit) {
    roi.hits += 1;
    roi.win += PAYOUT;
  }
  roi.net += net;
  roi._peak = Math.max(roi._peak ?? 0, roi.net);
  roi.maxDrawdown = Math.max(roi.maxDrawdown, (roi._peak ?? 0) - roi.net);
}

function finalizeRoi(roi) {
  delete roi._peak;
  roi.roi = roi.bet > 0 ? (roi.net / roi.bet) * 100 : 0;
  return roi;
}

function mergeRoi(items) {
  const out = makeRoi();
  for (const item of items) {
    out.signals += item.signals;
    out.bet += item.bet;
    out.hits += item.hits;
    out.win += item.win;
    out.net += item.net;
    out.maxDrawdown = Math.max(out.maxDrawdown, item.maxDrawdown);
  }
  return finalizeRoi(out);
}

function evaluateHotSectorSession(numbers, cfg, startAt = 0) {
  const roi = makeRoi();
  const bestRows = getBestSectorWindow(numbers, cfg.window, cfg.radius);
  for (let index = Math.max(cfg.window, startAt); index < numbers.length; index += 1) {
    const best = bestRows[index];
    if (!best) continue;
    const expected = cfg.window * ((cfg.radius * 2 + 1) / 37);
    const variance = cfg.window * ((cfg.radius * 2 + 1) / 37) * (1 - ((cfg.radius * 2 + 1) / 37));
    const z = variance > 0 ? (best.hits - expected) / Math.sqrt(variance) : 0;
    if (best.hits < cfg.minHits || z < cfg.minZ) continue;

    if (cfg.requireLastInSector) {
      const set = sectorSet(best.center, cfg.radius);
      if (!set.has(numbers[index - 1])) continue;
    }

    if (cfg.requirePullback) {
      const set = sectorSet(best.center, cfg.radius);
      if (set.has(numbers[index - 1])) continue;
    }

    const set = sectorSet(best.center, cfg.radius);
    const hit = set.has(numbers[index]);
    addNet(roi, (hit ? PAYOUT : 0) - set.size, hit, set.size);
  }
  return finalizeRoi(roi);
}

function evaluateDistanceOffsetSession(numbers, cfg, startAt = 0) {
  const roi = makeRoi();
  const candidateRows = getOffsetCandidatesWindow(numbers, cfg.window, cfg.maxAbsOffset);
  for (let index = Math.max(cfg.window + 1, startAt); index < numbers.length; index += 1) {
    const candidates = (candidateRows[index] ?? []).slice(0, cfg.offsetCount);
    if (candidates.length === 0) continue;

    const totalHits = candidates.reduce((sum, [, count]) => sum + count, 0);
    if (totalHits < cfg.minHits) continue;

    const picks = new Set();
    const fromPos = wheelPos[numbers[index - 1]];
    for (const [offset] of candidates) {
      const center = wheelOrder[(fromPos + offset + 37) % 37];
      for (const n of sectorNumbers(center, cfg.radius)) picks.add(n);
    }

    const hit = picks.has(numbers[index]);
    addNet(roi, (hit ? PAYOUT : 0) - picks.size, hit, picks.size);
  }
  return finalizeRoi(roi);
}

function evaluateStaticContextSectorSession(numbers, cfg, startAt = BET_START) {
  if (numbers.length <= startAt) return finalizeRoi(makeRoi());
  const contextEnd = Math.min(cfg.context, numbers.length);
  if (contextEnd < cfg.minContext) return finalizeRoi(makeRoi());
  const best = bestSector(numbers, 0, contextEnd, cfg.radius);
  const expected = contextEnd * ((cfg.radius * 2 + 1) / 37);
  const variance = contextEnd * ((cfg.radius * 2 + 1) / 37) * (1 - ((cfg.radius * 2 + 1) / 37));
  const z = variance > 0 ? (best.hits - expected) / Math.sqrt(variance) : 0;
  if (best.hits < cfg.minHits || z < cfg.minZ) return finalizeRoi(makeRoi());

  const set = sectorSet(best.center, cfg.radius);
  const roi = makeRoi();
  for (let index = startAt; index < numbers.length; index += 1) {
    const hit = set.has(numbers[index]);
    addNet(roi, (hit ? PAYOUT : 0) - set.size, hit, set.size);
  }
  return finalizeRoi(roi);
}

function groupedSessions(sessions) {
  const groups = new Map();
  for (const session of sessions) {
    const key = session.month;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(session);
  }
  return [...groups.entries()].sort(([a], [b]) => b.localeCompare(a));
}

function describeSpatial(sessions) {
  console.log("=== Session spatial summary ===");
  for (const session of sessions) {
    const numbers = session.numbers;
    const top9 = bestSector(numbers, 0, numbers.length, 4);
    const near = countTransitionDistances(numbers, 0, 4);
    const far = countTransitionDistances(numbers, 13, 18);
    const expectedTop9 = numbers.length * 9 / 37;
    const varianceTop9 = numbers.length * 9 / 37 * (1 - 9 / 37);
    const z9 = varianceTop9 > 0 ? (top9.hits - expectedTop9) / Math.sqrt(varianceTop9) : 0;
    console.log(
      [
        session.name.padEnd(24),
        String(numbers.length).padStart(4),
        `top9=${String(top9.center).padStart(2)}:${String(top9.hits).padStart(3)} z=${z9.toFixed(2).padStart(5)}`,
        `near<=4=${pct(near / Math.max(1, numbers.length - 1))}`,
        `far>=13=${pct(far / Math.max(1, numbers.length - 1))}`,
      ].join("  "),
    );
  }

  console.log("\n=== Month spatial summary ===");
  for (const [month, rows] of groupedSessions(sessions)) {
    const numbers = rows.flatMap((row) => row.numbers);
    const top9 = bestSector(numbers, 0, numbers.length, 4);
    const top13 = bestSector(numbers, 0, numbers.length, 6);
    const near = countTransitionDistances(numbers, 0, 4);
    const far = countTransitionDistances(numbers, 13, 18);
    console.log(
      [
        month,
        `sessions=${rows.length}`,
        `spins=${numbers.length}`,
        `top9 center=${top9.center} hits=${top9.hits} share=${pct(top9.hits / numbers.length)}`,
        `top13 center=${top13.center} hits=${top13.hits} share=${pct(top13.hits / numbers.length)}`,
        `near<=4=${pct(near / Math.max(1, numbers.length - 1))}`,
        `far>=13=${pct(far / Math.max(1, numbers.length - 1))}`,
      ].join("  "),
    );
  }

  console.log("\n=== Month max-sector random baseline, deterministic Monte Carlo ===");
  for (const [month, rows] of groupedSessions(sessions)) {
    const numbers = rows.flatMap((row) => row.numbers);
    const observedTop9 = bestSector(numbers, 0, numbers.length, 4).hits / numbers.length;
    const observedTop13 = bestSector(numbers, 0, numbers.length, 6).hits / numbers.length;
    const baseline9 = monteCarloMaxSector(numbers.length, 4, 600, `${month}:r4`);
    const baseline13 = monteCarloMaxSector(numbers.length, 6, 600, `${month}:r6`);
    console.log(
      [
        month,
        `top9 obs=${pct(observedTop9)} rndAvg=${pct(baseline9.avg)} p>=obs=${baseline9.pFor(observedTop9).toFixed(3)}`,
        `top13 obs=${pct(observedTop13)} rndAvg=${pct(baseline13.avg)} p>=obs=${baseline13.pFor(observedTop13).toFixed(3)}`,
      ].join("  "),
    );
  }
}

function monteCarloMaxSector(length, radius, trials, seedText) {
  const rng = makeRng(seedText);
  let sum = 0;
  let ge = 0;
  const observedImpossible = -1;
  const values = [];
  for (let trial = 0; trial < trials; trial += 1) {
    const counts = Array(37).fill(0);
    for (let index = 0; index < length; index += 1) {
      const number = Math.floor(rng() * 37);
      for (let offset = -radius; offset <= radius; offset += 1) {
        counts[(number + offset + 37) % 37] += 1;
      }
    }
    const maxShare = Math.max(...counts) / length;
    values.push(maxShare);
    sum += maxShare;
    if (maxShare >= observedImpossible) ge += 1;
  }
  values.sort((a, b) => a - b);
  return {
    avg: sum / trials,
    pFor(observed) {
      return values.filter((value) => value >= observed).length / trials;
    },
  };
}

function makeRng(seedText) {
  let seed = 2166136261;
  for (const ch of seedText) {
    seed ^= ch.charCodeAt(0);
    seed = Math.imul(seed, 16777619);
  }
  return () => {
    seed += 0x6D2B79F5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function countTransitionDistances(numbers, minDistance, maxDistance) {
  let count = 0;
  for (let index = 1; index < numbers.length; index += 1) {
    const distance = wheelDistance(numbers[index - 1], numbers[index]);
    if (distance >= minDistance && distance <= maxDistance) count += 1;
  }
  return count;
}

function pct(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function scanStrategies(sessions) {
  const strategyResults = [];

  for (const radius of [1, 2, 3, 4, 5, 6]) {
    for (const window of [37, 55, 74, 111, 148, 200]) {
      for (const minZ of [0.5, 1, 1.5, 2, 2.5]) {
        const expected = window * ((radius * 2 + 1) / 37);
        for (const over of [1, 2, 3, 4, 5, 6, 8]) {
          const cfg = { radius, window, minZ, minHits: Math.ceil(expected + over) };
          pushStrategy(strategyResults, "hot-sector", cfg, sessions, evaluateHotSectorSession);
          pushStrategy(strategyResults, "hot-sector-last-in", { ...cfg, requireLastInSector: true }, sessions, evaluateHotSectorSession);
          pushStrategy(strategyResults, "hot-sector-pullback", { ...cfg, requirePullback: true }, sessions, evaluateHotSectorSession);
        }
      }
    }
  }

  for (const radius of [0, 1, 2]) {
    for (const window of [37, 55, 74, 111, 148]) {
      for (const offsetCount of [1, 2, 3]) {
        for (const maxAbsOffset of [3, 5, 8, 12, 18]) {
          const expected = window * (offsetCount / 37);
          for (const over of [1, 2, 3, 4, 5]) {
            const cfg = { radius, window, offsetCount, maxAbsOffset, minHits: Math.ceil(expected + over) };
            pushStrategy(strategyResults, "distance-offset", cfg, sessions, evaluateDistanceOffsetSession);
          }
        }
      }
    }
  }

  for (const radius of [2, 3, 4, 5, 6]) {
    for (const context of [100, 148, 200]) {
      for (const minZ of [0.5, 1, 1.5, 2]) {
        const expected = context * ((radius * 2 + 1) / 37);
        for (const over of [2, 4, 6, 8, 10]) {
          const cfg = { radius, context, minContext: Math.min(100, context), minZ, minHits: Math.ceil(expected + over) };
          pushStrategy(strategyResults, "static-context-sector", cfg, sessions, evaluateStaticContextSectorSession);
        }
      }
    }
  }

  strategyResults.sort((a, b) => {
    if (b.from201.roi !== a.from201.roi) return b.from201.roi - a.from201.roi;
    return b.from201.signals - a.from201.signals;
  });

  console.log("\n=== Top strategies by 押注区 ROI ===");
  for (const row of strategyResults.slice(0, 40)) {
    printStrategy(row);
  }

  const balanced = strategyResults
    .filter((row) => row.from201.signals >= 500 && row.positiveSessions >= 20)
    .sort((a, b) => b.score - a.score);

  console.log("\n=== Balanced candidates (signals>=500, positive sessions>=20) ===");
  for (const row of balanced.slice(0, 30)) {
    printStrategy(row);
  }

  const aprJun = sessions.filter((session) => ["2026-04", "2026-05", "2026-06"].includes(session.month));
  console.log("\n=== 2026-04/05/06 best of balanced candidates ===");
  for (const row of balanced.slice(0, 15)) {
    const per = evaluateStrategy(row.kind, row.cfg, aprJun);
    console.log(`${formatStrategy(row.kind, row.cfg)}  Apr-Jun all ROI=${fmt(per.all.roi)} sig=${per.all.signals}  from201 ROI=${fmt(per.from201.roi)} sig=${per.from201.signals}`);
  }

  describeSelectedStrategies(sessions);
}

function describeSelectedStrategies(sessions) {
  const selected = [
    ["offset-short-active", "distance-offset", { radius: 0, window: 37, offsetCount: 1, maxAbsOffset: 5, minHits: 3 }],
    ["offset-mid-active", "distance-offset", { radius: 0, window: 74, offsetCount: 1, maxAbsOffset: 5, minHits: 4 }],
    ["offset-strict", "distance-offset", { radius: 0, window: 55, offsetCount: 1, maxAbsOffset: 8, minHits: 6 }],
    ["hot-pullback", "hot-sector-pullback", { radius: 2, window: 74, minZ: 0.5, minHits: 18, requirePullback: true }],
    ["hot-last-in-wide", "hot-sector-last-in", { radius: 5, window: 111, minZ: 2.5, minHits: 34, requireLastInSector: true }],
  ];

  console.log("\n=== Selected strategy month split ===");
  for (const [label, kind, cfg] of selected) {
    console.log(`\n${label}: ${formatStrategy(kind, cfg)}`);
    for (const [month, rows] of groupedSessions(sessions)) {
      const result = evaluateStrategy(kind, cfg, rows);
      if (result.from201.signals === 0 && result.all.signals === 0) continue;
      console.log(
        `${month}  all sig=${result.all.signals} ROI=${fmt(result.all.roi)} net=${result.all.net}  201 sig=${result.from201.signals} ROI=${fmt(result.from201.roi)} net=${result.from201.net}`,
      );
    }
  }

  console.log("\n=== Selected strategy Apr-Jun session split ===");
  const aprJun = sessions.filter((session) => ["2026-04", "2026-05", "2026-06"].includes(session.month));
  for (const [label, kind, cfg] of selected) {
    console.log(`\n${label}: ${formatStrategy(kind, cfg)}`);
    const evaluator = {
      "hot-sector": evaluateHotSectorSession,
      "hot-sector-last-in": evaluateHotSectorSession,
      "hot-sector-pullback": evaluateHotSectorSession,
      "distance-offset": evaluateDistanceOffsetSession,
      "static-context-sector": evaluateStaticContextSectorSession,
    }[kind];
    for (const session of aprJun) {
      const result = evaluator(session.numbers, cfg, BET_START);
      if (result.signals === 0) continue;
      console.log(`${session.name.padEnd(24)} sig=${String(result.signals).padStart(4)} ROI=${fmt(result.roi).padStart(8)} net=${String(result.net).padStart(5)} dd=${result.maxDrawdown}`);
    }
  }

  console.log("\n=== Random baseline for selected spatial candidates ===");
  for (const [label, kind, cfg] of selected.filter(([label]) => ["offset-mid-active", "hot-pullback"].includes(label))) {
    const observed = evaluateStrategy(kind, cfg, sessions);
    const baseline = monteCarloStrategy(sessions, kind, cfg, 160, `strategy:${label}`);
    console.log(
      `${label}: observed201=${fmt(observed.from201.roi)} sig=${observed.from201.signals} randomAvg=${fmt(baseline.avgRoi)} p>=obs=${baseline.p.toFixed(3)} randomAvgSig=${baseline.avgSignals.toFixed(0)}`,
    );
  }
}

function monteCarloStrategy(sessions, kind, cfg, trials, seedText) {
  const rng = makeRng(seedText);
  const rois = [];
  let signalSum = 0;
  for (let trial = 0; trial < trials; trial += 1) {
    const randomSessions = sessions.map((session) => ({
      ...session,
      numbers: Array.from({ length: session.numbers.length }, () => Math.floor(rng() * 37)),
    }));
    const result = evaluateStrategy(kind, cfg, randomSessions).from201;
    rois.push(result.roi);
    signalSum += result.signals;
  }
  rois.sort((a, b) => a - b);
  const observed = evaluateStrategy(kind, cfg, sessions).from201.roi;
  return {
    avgRoi: rois.reduce((sum, value) => sum + value, 0) / rois.length,
    avgSignals: signalSum / trials,
    p: rois.filter((value) => value >= observed).length / trials,
  };
}

function pushStrategy(out, kind, cfg, sessions, evaluator) {
  const allItems = [];
  const from201Items = [];
  let positiveSessions = 0;
  let activeSessions = 0;
  for (const session of sessions) {
    const all = evaluator(session.numbers, cfg, 0);
    const from201 = evaluator(session.numbers, cfg, BET_START);
    allItems.push(all);
    from201Items.push(from201);
    if (from201.signals > 0) {
      activeSessions += 1;
      if (from201.net > 0) positiveSessions += 1;
    }
  }
  const all = mergeRoi(allItems);
  const from201 = mergeRoi(from201Items);
  const score = from201.roi + Math.min(15, from201.signals / 200) + positiveSessions * 0.4 - from201.maxDrawdown * 0.02;
  out.push({ kind, cfg, all, from201, activeSessions, positiveSessions, score });
}

function evaluateStrategy(kind, cfg, sessions) {
  const evaluator = {
    "hot-sector": evaluateHotSectorSession,
    "hot-sector-last-in": evaluateHotSectorSession,
    "hot-sector-pullback": evaluateHotSectorSession,
    "distance-offset": evaluateDistanceOffsetSession,
    "static-context-sector": evaluateStaticContextSectorSession,
  }[kind];
  const allItems = [];
  const from201Items = [];
  for (const session of sessions) {
    allItems.push(evaluator(session.numbers, cfg, 0));
    from201Items.push(evaluator(session.numbers, cfg, BET_START));
  }
  return { all: mergeRoi(allItems), from201: mergeRoi(from201Items) };
}

function printStrategy(row) {
  console.log(
    [
      formatStrategy(row.kind, row.cfg),
      `all sig=${row.all.signals} ROI=${fmt(row.all.roi)} net=${row.all.net}`,
      `201 sig=${row.from201.signals} ROI=${fmt(row.from201.roi)} net=${row.from201.net} dd=${row.from201.maxDrawdown}`,
      `sessions +${row.positiveSessions}/${row.activeSessions}`,
    ].join("  "),
  );
}

function formatStrategy(kind, cfg) {
  const entries = Object.entries(cfg)
    .filter(([, value]) => value !== undefined && value !== false)
    .map(([key, value]) => `${key}=${value}`)
    .join(",");
  return `${kind}(${entries})`;
}

function fmt(value) {
  return `${value.toFixed(2)}%`;
}

const sessions = loadSessions();
console.log(`Loaded sessions=${sessions.length}, spins=${sessions.reduce((sum, row) => sum + row.numbers.length, 0)}`);
describeSpatial(sessions);
scanStrategies(sessions);
