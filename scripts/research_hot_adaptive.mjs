import fs from "node:fs";

function parseNumbers(raw) {
  if (Array.isArray(raw)) return raw.map(Number);
  if (typeof raw === "string") {
    return raw.split(",").map((part) => Number(part.trim())).filter(Number.isFinite);
  }
  return [];
}

function historyDataTms(entry, fallback = 0) {
  const value = entry?.DataTms ?? entry?.dataTms ?? entry?.tms ?? fallback;
  const tms = Number(value);
  return Number.isFinite(tms) ? tms : fallback;
}

const USER_LIVE_NUMBERS = `9,36,18,28,13,8,29,4,31,30,6,18,28,1,29,23,26,24,4,5,3,10,27,7,22,22,1,12,32,29,13,30,29,25,30,24,2,36,27,17,30,19,11,7,16,12,28,18,20,5,1,26,6,13,36,13,20,0,20,3,18,7,3,16,29,13,4,16,5,30,35,32,24,31,15,21,10,20,28,35,28,3,26,13,7,26,31,5,13,17,22,4,15,29,32,19,25,36,28,31,2,11,15,32,7,13,12,20,35,29,16,23,36,20,25,26,28,26,34,2,8,4,36,20,9,6,36,17,32,6,2,29,1,27,6,21,27,18,1,17,14,10,10,7,0,23,35,20,35,24,3,0,28,32,15,35,24,3,36,33,15,7,22,8,17,6,33,9,28,16,32,22,20,31,27,26,1,10,17,10,2,1,19,5,24,22,9,10,11,9,29,36,32,28,6,21,10,23,0,27,13,31,15,2,7,16,29,1,23,13,14,0,6,11,28,13,14,27,29,24,31,24,24,1,23,22,11,31,12,26,12,36,1,36,20,20,21,4,33,27,10,20,24,15,26,29,4,15,10,6,14,15,20,35,14,31,8,0,31,5,11,28,30,10,35,32,26,31,29,25,4,15,29,28,12,24,5,5,23,34,33,23,35,17,26,1,30,9,29,3,28,34,0,13,0,21,6,7,11,33,1,36,25,5,29,22,29,21,7,11,29,22,0,0,1,0,33,22,20,15,12,32,35,24,28,20,8,14,10,32,7,29,20,0,13,9,21,10,16,30,21,32,2,31,34,26,27,16,22,17,30,5,18,1,36,12,26,21,32,27,8,15,21,34,34,9,5,3,12,32,7,27,20,10,33,5,5,11,22,29,3,29,23,33,33,5,33,0,36,23,27,9,21,29,3,1,8,0,4,33,2,27,2,4,0,12,20,36,28,3,10,9,34,25,31,33,13,4,17,28,31,15,27,7,34,16,29,3,8,30,27,12,17,23,7,9,14,28,11,32,0,28,33,26,11,12,32,3,15,14,27,23,4,28,12,1,1,29,13,33,3,6,4,27,13,4,22,10,31,4,12,27,24,24,19,32,14,1,33,0,2,25,1,29,29,6,20,36,10,27,0,23,34,11,34,25,24,35,25,22,1,23,14,23,13,9,14,2,35,10,18,23,21,0,24,14,22,27`;

const sessions = JSON.parse(fs.readFileSync("history_data.json", "utf8"))
  .map((entry, index) => ({
    name: String(entry.Name ?? `session-${index}`),
    tms: historyDataTms(entry, index),
    numbers: parseNumbers(entry.Numbers),
  }))
  .filter((session) => session.numbers.length > 0)
  .sort((a, b) => a.tms - b.tms);

const userSession = {
  name: "USER-LIVE",
  tms: Number.MAX_SAFE_INTEGER,
  numbers: parseNumbers(USER_LIVE_NUMBERS),
};

function counts(numbers, start, end) {
  const out = Array(37).fill(0);
  for (let index = Math.max(0, start); index < Math.min(numbers.length, end); index += 1) {
    out[numbers[index]] += 1;
  }
  return out;
}

function distance(numbers, number) {
  let dist = 0;
  for (let index = numbers.length - 1; index >= 0; index -= 1) {
    if (numbers[index] === number) return dist;
    dist += 1;
  }
  return numbers.length;
}

function topByCount(countMap, limit, includeTies = false) {
  const rows = [];
  for (let number = 1; number <= 36; number += 1) rows.push({ number, count: countMap[number] ?? 0 });
  rows.sort((a, b) => b.count - a.count || a.number - b.number);
  if (!includeTies) return rows.slice(0, limit).map((row) => row.number);
  const cutoff = rows[Math.min(limit - 1, rows.length - 1)]?.count ?? 0;
  return rows.filter((row) => row.count >= cutoff).map((row) => row.number);
}

const SHORT = {
  name: "short",
  window: 37,
  warmup: 50,
  pool: 3,
  tie: true,
  multi: [37, 74, 111],
  multiPool: 3,
  multiTie: true,
  burstWindow: 20,
  maxRecentCount: 3,
  rankWindow: 37,
};

const LONG = {
  name: "long",
  window: 148,
  warmup: 148,
  pool: 10,
  tie: false,
  burstWindow: 20,
  maxRecentCount: 3,
  rankWindow: 74,
};

function isShortTrendUp(numbers, number) {
  const start = Math.max(0, numbers.length - 37);
  const middle = start + 18;
  return counts(numbers, middle, numbers.length)[number] > counts(numbers, start, middle)[number];
}

function isLongStrictAcceleration(numbers, number) {
  const start = numbers.length - 148;
  const segment = 49;
  let first = 0;
  let second = 0;
  let third = 0;
  for (let index = start; index < start + segment; index += 1) if (numbers[index] === number) first += 1;
  for (let index = start + segment; index < start + segment * 2; index += 1) if (numbers[index] === number) second += 1;
  for (let index = start + segment * 2; index < numbers.length; index += 1) if (numbers[index] === number) third += 1;
  return third > second && second > first;
}

function selectPick(numbers, rule) {
  if (numbers.length < rule.warmup) return null;
  const hotCounts = counts(numbers, Math.max(0, numbers.length - rule.window), numbers.length);
  let candidates = topByCount(hotCounts, rule.pool, rule.tie);

  if (rule.multi) {
    const sets = rule.multi.map((window) => new Set(
      topByCount(counts(numbers, Math.max(0, numbers.length - window), numbers.length), rule.multiPool, rule.multiTie),
    ));
    candidates = candidates.filter((number) => sets.every((set) => set.has(number)));
  }

  candidates = candidates.filter((number) => rule.name === "short"
    ? isShortTrendUp(numbers, number)
    : isLongStrictAcceleration(numbers, number));

  if (rule.maxRecentCount != null) {
    const recent = counts(numbers, Math.max(0, numbers.length - rule.burstWindow), numbers.length);
    candidates = candidates.filter((number) => recent[number] <= rule.maxRecentCount);
  }

  const rankCounts = counts(numbers, Math.max(0, numbers.length - rule.rankWindow), numbers.length);
  candidates.sort((a, b) => rankCounts[b] - rankCounts[a] || distance(numbers, a) - distance(numbers, b) || a - b);
  return candidates[0] ?? null;
}

function buildPaper(session) {
  const paper = {
    short: Array(session.numbers.length).fill(null),
    long: Array(session.numbers.length).fill(null),
  };
  for (let index = 0; index < session.numbers.length; index += 1) {
    const history = session.numbers.slice(0, index);
    const shortPick = selectPick(history, SHORT);
    const longPick = selectPick(history, LONG);
    if (shortPick != null) {
      const hit = shortPick === session.numbers[index];
      paper.short[index] = { signal: 1, hit: hit ? 1 : 0, net: hit ? 35 : -1, pick: shortPick };
    }
    if (longPick != null) {
      const hit = longPick === session.numbers[index];
      paper.long[index] = { signal: 1, hit: hit ? 1 : 0, net: hit ? 35 : -1, pick: longPick };
    }
  }
  return paper;
}

function windowStats(rows, index, lookback) {
  let signals = 0;
  let hits = 0;
  let net = 0;
  for (let cursor = Math.max(0, index - lookback); cursor < index; cursor += 1) {
    const row = rows[cursor];
    if (!row) continue;
    signals += 1;
    hits += row.hit;
    net += row.net;
  }
  return { signals, hits, net, roi: signals ? (net / signals) * 100 : 0 };
}

function summarize(events) {
  const bet = events.length;
  const win = events.filter((event) => event.hit).length * 36;
  let running = 0;
  let peak = 0;
  let drawdown = 0;
  for (const event of events) {
    running += event.net;
    peak = Math.max(peak, running);
    drawdown = Math.max(drawdown, peak - running);
  }
  return {
    signals: bet,
    hits: events.filter((event) => event.hit).length,
    net: win - bet,
    roi: bet ? ((win - bet) / bet) * 100 : 0,
    dd: drawdown,
  };
}

function backtest(cachedSession, chooser, startIndex = 0) {
  const { session, paper } = cachedSession;
  const events = [];
  for (let index = 0; index < session.numbers.length; index += 1) {
    const modeChoice = chooser(session, paper, index);
    const modes = Array.isArray(modeChoice) ? modeChoice : [modeChoice];
    let mode = "none";
    let row = null;
    for (const candidateMode of modes) {
      const candidateRow = candidateMode === "short" ? paper.short[index] : candidateMode === "long" ? paper.long[index] : null;
      if (candidateRow) {
        mode = candidateMode;
        row = candidateRow;
        break;
      }
    }
    if (!row || index < startIndex) continue;
    events.push({
      session: session.name,
      index,
      mode,
      pick: row.pick,
      result: session.numbers[index],
      hit: Boolean(row.hit),
      net: row.net,
    });
  }
  return events;
}

function fixedChooser(mode) {
  return () => mode;
}

function adaptiveChooser(params) {
  return (_session, paper, index) => {
    const shortStats = windowStats(paper.short, index, params.lookback);
    const longStats = windowStats(paper.long, index, params.lookback);

    const shortOk = shortStats.signals >= params.minShortSignals
      && shortStats.roi >= params.minShortRoi
      && shortStats.roi >= longStats.roi + params.shortEdge;
    const longOk = longStats.signals >= params.minLongSignals
      && longStats.roi >= params.minLongRoi
      && longStats.roi >= shortStats.roi + params.longEdge;

    if (params.fallbackOther) {
      if (shortOk) return ["short", "long"];
      if (longOk) return ["long", "short"];
      return params.defaultMode === "short" ? ["short", "long"] : ["long", "short"];
    }

    if (params.allowEmpty) {
      if (shortOk) return "short";
      if (longOk) return "long";
      return "none";
    }

    if (shortOk) return "short";
    return "long";
  };
}

function guardedChooser(params) {
  return (_session, paper, index) => {
    const shortStats = windowStats(paper.short, index, params.lookback);
    const longStats = windowStats(paper.long, index, params.lookback);
    const longRecent = windowStats(paper.long, index, params.failLookback);
    const shortRecent = windowStats(paper.short, index, params.failLookback);

    const longFailing = longRecent.signals >= params.minLongFailSignals
      && longRecent.roi <= params.maxLongFailRoi;
    const shortHealthy = shortStats.signals >= params.minShortSignals
      && shortStats.roi >= params.minShortRoi
      && shortRecent.roi >= params.minShortRecentRoi;
    const shortBetter = shortStats.roi >= longStats.roi + params.shortEdge;

    if (longFailing && shortHealthy && shortBetter) return ["short", "long"];
    return ["long", "short"];
  };
}

function runAll(chooser, startIndex = 0) {
  return cachedSessions.flatMap((session) => backtest(session, chooser, startIndex));
}

function score(row) {
  return Math.min(row.all.roi, row.from201.roi, row.recent10.roi, row.user.roi) * 100
    + row.from201.roi
    - row.from201.dd / 10;
}

const allSessions = [...sessions, userSession];
const originalSessions = sessions.slice();
sessions.length = 0;
sessions.push(...allSessions);
const cachedSessions = allSessions.map((session) => ({ session, paper: buildPaper(session) }));

const r10Names = new Set(allSessions.slice(-11, -1).map((session) => session.name));
const userName = userSession.name;

function evaluate(label, chooser) {
  const events = runAll(chooser, 0);
  const from201 = runAll(chooser, 200);
  const recent10 = from201.filter((event) => r10Names.has(event.session));
  const user = from201.filter((event) => event.session === userName);
  return {
    label,
    all: summarize(events),
    from201: summarize(from201.filter((event) => event.session !== userName)),
    recent10: summarize(recent10),
    user: summarize(user),
    userModes: user.reduce((acc, event) => {
      acc[event.mode] = (acc[event.mode] ?? 0) + 1;
      return acc;
    }, {}),
  };
}

const baselineRows = [
  evaluate("fixed short", fixedChooser("short")),
  evaluate("fixed long", fixedChooser("long")),
];

const candidates = [];
for (const lookback of []) {
  for (const minShortSignals of [5, 8, 12]) {
    for (const minLongSignals of [5]) {
      for (const minShortRoi of [0, 10, 20]) {
        for (const minLongRoi of [-10]) {
          for (const shortEdge of [0, 10, 20]) {
            for (const longEdge of [0]) {
              for (const allowEmpty of [false]) {
                for (const fallbackOther of [true]) {
                  for (const defaultMode of ["long"]) {
                    const params = { lookback, minShortSignals, minLongSignals, minShortRoi, minLongRoi, shortEdge, longEdge, allowEmpty, fallbackOther, defaultMode };
                const row = evaluate(`adaptive ${JSON.stringify(params)}`, adaptiveChooser(params));
                if (row.user.roi <= 0) continue;
                if (row.from201.signals < 800) continue;
                candidates.push({ params, ...row, score: score(row) });
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}

candidates.sort((a, b) => b.score - a.score);

console.log("Dataset", {
  historySessions: originalSessions.length,
  historySpins: originalSessions.reduce((sum, session) => sum + session.numbers.length, 0),
  userSpins: userSession.numbers.length,
});
console.log("\nBaselines");
for (const row of baselineRows) console.log(row.label, row.from201, "recent10", row.recent10, "user", row.user, row.userModes);

console.log("\nTop adaptive candidates");
for (const row of candidates.slice(0, 5)) {
  console.log(row.params, "score", row.score.toFixed(2), "from201", row.from201, "recent10", row.recent10, "user", row.user, row.userModes);
}

console.log("\nBalanced candidates: history from201 >= 15%, user > 0");
for (const row of candidates
  .filter((item) => item.from201.roi >= 15 && item.user.roi > 0)
  .sort((a, b) => b.user.roi - a.user.roi || b.from201.roi - a.from201.roi)
  .slice(0, 5)) {
  console.log(row.params, "from201", row.from201, "recent10", row.recent10, "user", row.user, row.userModes);
}

console.log("\nNo-signal-loss candidates: history signals >= fixed long, history from201 > 0%, user > 0");
const fixedLongSignals = baselineRows.find((row) => row.label === "fixed long").from201.signals;
for (const row of candidates
  .filter((item) => item.from201.signals >= fixedLongSignals && item.from201.roi > 0 && item.user.roi > 0)
  .sort((a, b) => b.from201.roi - a.from201.roi || b.user.roi - a.user.roi)
  .slice(0, 5)) {
  console.log(row.params, "from201", row.from201, "recent10", row.recent10, "user", row.user, row.userModes);
}

const guardedCandidates = [];
for (const lookback of [111]) {
  for (const failLookback of [37, 55]) {
    for (const minLongFailSignals of [5, 8]) {
      for (const maxLongFailRoi of [-20, -10, 0]) {
        for (const minShortSignals of [5]) {
          for (const minShortRoi of [-20, -10, 0]) {
            for (const minShortRecentRoi of [-100, -40, -20]) {
              for (const shortEdge of [-20, -10, 0]) {
                const params = {
                  lookback,
                  failLookback,
                  minLongFailSignals,
                  maxLongFailRoi,
                  minShortSignals,
                  minShortRoi,
                  minShortRecentRoi,
                  shortEdge,
                };
                const row = evaluate(`guarded ${JSON.stringify(params)}`, guardedChooser(params));
                if (row.user.roi <= 0) continue;
                if (row.from201.signals < fixedLongSignals) continue;
                guardedCandidates.push({ params, ...row, score: score(row) });
              }
            }
          }
        }
      }
    }
  }
}

console.log("\nGuarded switch candidates: long-failure triggers short, no signal loss");
for (const row of guardedCandidates
  .sort((a, b) => b.from201.roi - a.from201.roi || b.user.roi - a.user.roi)
  .slice(0, 10)) {
  console.log(row.params, "from201", row.from201, "recent10", row.recent10, "user", row.user, row.userModes);
}

console.log("\nGuarded balanced: history from201 >= 15%, user > 0, no signal loss");
for (const row of guardedCandidates
  .filter((item) => item.from201.roi >= 15)
  .sort((a, b) => b.user.roi - a.user.roi || b.from201.roi - a.from201.roi)
  .slice(0, 10)) {
  console.log(row.params, "from201", row.from201, "recent10", row.recent10, "user", row.user, row.userModes);
}
