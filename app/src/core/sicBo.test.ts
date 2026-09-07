import { describe, expect, it } from "vitest";
import { MersenneTwister19937 } from "random-js";
import { belowSicBoMinimum, clearSicBoBets, defaultSicBoSettings, dieValues, doubleSicBoBets, emptySicBoDistribution, freshSicBo, getSicBoBetMap, getSicBoBets, getSicBoChips, nextSicBoRound, placeSicBoBet, readSicBoState, recordSicBoDice, repeatSicBoBets, resetSicBoStats, rollSicBo, selectedSicBoChip, settleSicBo, sicBoBetById, sicBoBets, sicBoCategories, sicBoMinimumFor, sicBoPayout, undoSicBoBet, wagerTotal, type Dice } from "./sicBo";
import { fitSicBoViewport } from "../ui/sands/sicBoLayout";
const payout = (id: string, roll: Dice) => sicBoPayout(sicBoBetById.get(id)!, roll);
const allRolls = dieValues.flatMap(a => dieValues.flatMap(b => dieValues.map(c => [a,b,c] as Dice)));

describe("Sic Bo table", () => {
  it("offers matching chip sets for each minimum and restores large denominations", () => {
    expect(getSicBoChips(20)).toEqual([10,20,30,50,100,500,1000]);
    for (const minimum of [300,500] as const) {
      expect(getSicBoChips(minimum)).toEqual([100,500,1000,5000,10000]);
      for (const selected of [10,20,30,50]) expect(selectedSicBoChip(selected,minimum)).toBe(100);
      for (const selected of getSicBoChips(minimum)) expect(selectedSicBoChip(selected,minimum)).toBe(selected);
    }
    for (const selected of [5000,10000]) {
      expect(selectedSicBoChip(selected,20)).toBe(1000);
      const s=placeSicBoBet({...freshSicBo(),balance:100000,selected},"big");
      expect(s.bets.big).toBe(selected);
      expect(readSicBoState(s)).toEqual(s);
      const settled=settleSicBo(s,[6,5,4],{rule:"macau",minimum:500});
      expect(settled.balance).toBe(100000+selected);
      expect(readSicBoState(settled)).toEqual(settled);
    }
  });
  it("offers exactly 52 distinct bets, with six triples and a central any-triple", () => {
    expect(sicBoBets).toHaveLength(52);
    expect(sicBoBetById.size).toBe(52);
    expect(sicBoBets.filter(b => b.kind === "triple")).toHaveLength(6);
    expect(sicBoBets.filter(b => b.kind === "pair")).toHaveLength(15);
  });
  it("enumerates all 216 outcomes against the analytical winning counts", () => {
    for (const b of [...getSicBoBets("macau"), ...getSicBoBets("australia")]) {
      const wins = allRolls.filter(r => sicBoPayout(b, r) >= 0).length;
      const expected = b.kind === "total" ? [3,6,10,15,21,25,27,27,25,21,15,10,6,3][b.total! - 4]
        : {small:105,big:105,odd:105,even:105,triple:1,"any-triple":6,double:16,pair:30,single:91}[b.kind];
      expect(wins, b.id).toBe(expected);
    }
  });
  it("settles triples, doubles and singles independently with the specified pay table", () => {
    const r: Dice = [3,3,3];
    for (const id of ["big", "small", "odd", "even"]) expect(payout(id,r)).toBe(-1);
    expect(payout("triple-3",r)).toBe(150);
    expect(payout("any-triple",r)).toBe(24);
    expect(payout("double-3",r)).toBe(8);
    expect(payout("single-3",r)).toBe(3);
    expect(payout("total-9",r)).toBe(6);
    expect(payout("pair-2-3",r)).toBe(-1);
    expect(payout("single-3",[1,3,5])).toBe(1);
    expect(payout("single-3",[1,3,3])).toBe(2);
  });
  it("pays pairs once even if a face is repeated and includes stake in returns", () => {
    expect(payout("pair-2-5",[2,5,5])).toBe(5);
    let s = placeSicBoBet(freshSicBo(), "pair-2-5");
    s = settleSicBo(s,[2,5,5]);
    expect(s.balance).toBe(10050);
    expect(s.history[0]).toMatchObject({rule:"macau",wagered:10,returned:60,profit:50});
    expect(s.stats).toEqual({rounds:1,wagered:10,returned:60,profit:50});
  });
  it("undoes placements, doubling, clearing and repeating as complete actions", () => {
    const one = placeSicBoBet({...freshSicBo(),selected:20},"small");
    const two = placeSicBoBet(one,"single-1");
    expect(undoSicBoBet(two).bets).toEqual(one.bets);
    expect(undoSicBoBet(doubleSicBoBets(two)).bets).toEqual(two.bets);
    expect(undoSicBoBet(clearSicBoBets(two)).bets).toEqual(two.bets);
    const settled = settleSicBo(two,[1,2,3]);
    expect(settled.bets).toEqual({}); expect(settled.undo).toEqual([]);
    const placed = placeSicBoBet(nextSicBoRound(settled),"big");
    expect(repeatSicBoBets(placed).bets).toEqual(two.bets);
    expect(undoSicBoBet(repeatSicBoBets(placed)).bets).toEqual(placed.bets);
  });
  it("enforces available funds and limits without partial updates", () => {
    const s = {...freshSicBo(), balance:10};
    const bet = placeSicBoBet(s,"big");
    expect(placeSicBoBet(bet,"big")).toBe(bet);
    expect(doubleSicBoBets(bet)).toBe(bet);
    expect(placeSicBoBet(s,"not-a-bet")).toBe(s);
    const max = {...freshSicBo(),balance:200000,bets:{big:100000}};
    expect(placeSicBoBet(max,"big")).toBe(max);
    expect(doubleSicBoBets(max)).toBe(max);
    expect(settleSicBo(freshSicBo(),[1,2,3]).stats.rounds).toBe(0);
  });
  it("uses the library's reproducible unbiased dice distribution, not a finite deck", () => {
    const a = MersenneTwister19937.seed(471), b = MersenneTwister19937.seed(471);
    for (let i=0;i<50;i++) {
      const s=placeSicBoBet({...freshSicBo(),selected:20},"small");
      const first=rollSicBo(s,a), second=rollSicBo(s,b);
      expect(first.lastDice).toEqual(second.lastDice);
      expect(first.lastDice!.every(n=>n>=1&&n<=6)).toBe(true);
    }
  });
  it("round-trips state, bounds history, and resets statistics without changing bets or bankroll", () => {
    let s=freshSicBo();
    for (let i=0;i<210;i++) s=settleSicBo(placeSicBoBet({...nextSicBoRound(s),selected:20},"small"),[1,2,3]);
    s=placeSicBoBet(nextSicBoRound(s),"big");
    expect(s.history).toHaveLength(200);
    expect(readSicBoState(JSON.parse(JSON.stringify(s)))).toEqual(s);
    const reset=resetSicBoStats(s);
    expect(reset.balance).toBe(s.balance); expect(reset.bets).toEqual(s.bets); expect(reset.lastDice).toEqual(s.lastDice);
    expect(reset.stats).toEqual(freshSicBo().stats); expect(reset.history).toEqual([]);
    expect(readSicBoState(reset)).toEqual(reset);
  });
  it("rejects corrupt persistence and invalid monetary values", () => {
    const s=settleSicBo(placeSicBoBet({...freshSicBo(),selected:20},"small"),[1,2,3]);
    for (const bad of [null,{}, {...s,balance:-1},{...s,selected:7},{...s,lastDice:[0,1,2]}, {...s,bets:{unknown:10}}, {...s,bets:{small:1}}, {...s,bets:{small:Infinity}}, {...s,stats:{...s.stats,profit:123}}, {...s,history:[{...s.history[0],returned:500}]}]) expect(readSicBoState(bad)).toBeNull();
    expect(wagerTotal(s.bets)).toBe(0);
  });
  it("uses the low Macau pay table by default and retains Queensland as a separate choice", () => {
    expect(defaultSicBoSettings).toEqual({rule:"macau",minimum:20});
    expect(sicBoBets.filter(b=>b.kind==="total").map(b=>b.odds)).toEqual([50,18,14,12,8,6,6,6,6,8,12,14,18,50]);
    const au = getSicBoBetMap("australia");
    for (const [id, odds] of [["triple-3",180],["any-triple",31],["double-3",11],["single-3",12],["total-9",7]] as const) expect(sicBoPayout(au.get(id)!,[3,3,3])).toBe(odds);
    expect(sicBoPayout(au.get("pair-1-2")!,[1,2,3])).toBe(6);
  });
  it("enforces every minimum tier on aggregate bets at settlement, including repeats", () => {
    for (const minimum of [20,300,500] as const) {
      for (const bet of sicBoBets) {
        const min = ["big","small","odd","even"].includes(bet.kind) ? minimum : minimum===20 ? 10 : 100;
        expect(sicBoMinimumFor(bet,minimum)).toBe(min);
        const s={...freshSicBo(),bets:{[bet.id]:min-10 || 1}};
        expect(settleSicBo(s,[1,2,3],{rule:"macau",minimum})).toBe(s);
        expect(settleSicBo({...s,bets:{[bet.id]:min}},[1,2,3],{rule:"macau",minimum}).roundId).toBe(1);
      }
    }
    const small=settleSicBo({...freshSicBo(),bets:{small:20}},[1,2,3]);
    const repeated=repeatSicBoBets(nextSicBoRound(small));
    expect(belowSicBoMinimum(repeated.bets,500)).toEqual(["small"]);
    expect(rollSicBo(repeated,MersenneTwister19937.seed(1),{rule:"macau",minimum:500})).toBe(repeated);
    expect(settleSicBo(doubleSicBoBets(repeated),[1,2,3],{rule:"macau",minimum:500}).roundId).toBe(1);
    const pending=placeSicBoBet(freshSicBo(),"small");
    expect(settleSicBo(pending,[1,2,3])).toBe(pending);
    expect(settleSicBo(placeSicBoBet(pending,"small"),[1,2,3]).roundId).toBe(1);
  });
  it("holds a settled board across reload until next round and never settles it twice", () => {
    const s=settleSicBo({...freshSicBo(),bets:{small:20,"single-1":10}},[1,2,3]);
    expect(s.settled).toEqual(s.history[0]);
    expect(readSicBoState(JSON.parse(JSON.stringify(s)))).toEqual(s);
    for (const update of [clearSicBoBets,repeatSicBoBets,doubleSicBoBets,undoSicBoBet]) expect(update(s)).toBe(s);
    expect(placeSicBoBet(s,"big")).toBe(s);
    expect(settleSicBo(s,[6,6,6])).toBe(s);
    expect(rollSicBo(s)).toBe(s);
    const next=nextSicBoRound(s);
    expect(next.settled).toBeNull(); expect(next.bets).toEqual({}); expect(next.stats).toEqual(s.stats);
    expect(readSicBoState(next)).toEqual(next);
    expect(resetSicBoStats(s).settled).toEqual(s.settled);
    expect(readSicBoState(resetSicBoStats(s))).toEqual(resetSicBoStats(s));
  });
  it("keeps different rules in history and migrates old Australian returns without changing balances", () => {
    const au=settleSicBo({...freshSicBo(),bets:{"triple-3":10}},[3,3,3],{rule:"australia",minimum:20});
    const macau=settleSicBo(repeatSicBoBets(nextSicBoRound(au)),[3,3,3]);
    expect(macau.history.map(r=>[r.rule,r.returned])).toEqual([["macau",1510],["australia",1810]]);
    expect(readSicBoState(macau)).toEqual(macau);
    const legacy={...au,version:1,settled:undefined,distribution:undefined,history:au.history.map(r=>({...r,rule:undefined}))};
    const migrated=readSicBoState(legacy)!;
    expect(migrated.balance).toBe(au.balance); expect(migrated.stats).toEqual(au.stats);
    expect(migrated.history[0].returned).toBe(1810); expect(migrated.history[0].rule).toBe("australia");
    expect(migrated.distribution.samples).toBe(1); expect(migrated.settled).toBeNull();
  });
  it("counts faces, rounds, totals and triples separately across all 216 outcomes", () => {
    const data=allRolls.reduce(recordSicBoDice,emptySicBoDistribution());
    expect(data.samples).toBe(216);
    expect(data.faces).toEqual(Array(6).fill(108));
    expect(data.faceRounds).toEqual(Array(6).fill(91));
    expect(data.triples).toEqual(Array(6).fill(1));
    expect(sicBoCategories(data)).toEqual({big:105,small:105,odd:105,even:105,triple:6});
    expect(data.totals).toEqual([1,3,6,10,15,21,25,27,27,25,21,15,10,6,3,1]);
    let state=freshSicBo();
    for (let i=0;i<250;i++) state=settleSicBo({...nextSicBoRound(state),bets:{"single-1":10}},[1,2,3]);
    expect(state.history.length).toBe(200); expect(state.distribution.samples).toBe(250);
    expect(readSicBoState(state)).toEqual(state);
    expect(resetSicBoStats(state).distribution).toEqual(emptySicBoDistribution());
  });
});
describe("Sic Bo viewport", () => {
  it("fits desktop and both phone orientations with the same geometry", () => {
    for (const [w,h,d] of [[1440,900,true],[1000,620,true],[393,850,false],[360,650,false],[844,390,false]] as const) {
      const f=fitSicBoViewport(w,h,d);
      expect(f.width*f.scale).toBeLessThanOrEqual((f.rotated?h:w)+.001);
      expect(f.height*f.scale).toBeLessThanOrEqual((f.rotated?w:h)+.001);
      expect(f.width).toBeGreaterThanOrEqual(d?1000:720);
      expect(f.height).toBeGreaterThanOrEqual(d?620:360);
    }
  });
});
