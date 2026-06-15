"""
Advanced Bet Management on Top of Gear Rotation
=================================================
Starting from the best gear rotation results (3行, score≥55, +0.91%),
test improvements via bet sizing and exit rules.

Tests:
A. Dynamic bet sizing: bet more when score is higher
B. "Exit on score drop" vs "exit on first loss"
C. Gear-specific progressions
D. Multi-entity confirmation
E. Streak-aware bet compounding

Author: DeepSeek (via Claude Code)
Date: 2026-06-03
"""

import json, math
from collections import defaultdict, Counter
from statistics import mean
from typing import Optional

def load_sessions(path: str) -> list:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    sessions = []
    for entry in data:
        name = entry.get("Name", "?")
        nums_str = entry.get("Numbers", "")
        nums = [int(x.strip()) for x in nums_str.split(",") if x.strip()] if isinstance(nums_str, str) else nums_str
        if nums:
            sessions.append({"name": name, "numbers": nums, "tms": entry.get("tms", 0)})
    sessions.sort(key=lambda s: s["tms"])
    return sessions

def get_row(n): return None if n==0 else (2 if n%3==1 else (1 if n%3==2 else 0))
def get_group(n): return None if n==0 else (n-1)//12


# ============================================================
# Gear Tracker (same as gear_rotation_backtest.py)
# ============================================================

class GearTracker:
    def __init__(self, gear_skip, window=20):
        self.gear = gear_skip
        self.window = window
        self.outcomes = []

    def record_outcome(self, spin, net):
        self.outcomes.append((spin, net))
        if len(self.outcomes) > self.window * 2:
            self.outcomes = self.outcomes[-self.window*2:]

    def recent_pnl(self, n=None):
        if n is None: n = self.window
        return [o[1] for o in self.outcomes[-n:]]

    def cumulative_pnl(self, n=None):
        vals = self.recent_pnl(n)
        cum = []; total = 0
        for v in vals: total += v; cum.append(total)
        return cum

    def pnl_trajectory(self, n=15):
        cum = self.cumulative_pnl(n)
        if len(cum) < 6: return None
        mid = len(cum)//2
        first, second = cum[:mid], cum[mid:]
        s1 = (first[-1]-first[0])/max(1,mid) if first else 0
        s2 = (second[-1]-second[0])/max(1,len(second)) if second else 0
        curvature = s2-s1
        bottoming = (first and first[-1]<first[0]) and (s2>s1*0.3)
        improving = s2>0
        if cum:
            min_pnl = min(cum)
            recovery = max(cum[cum.index(min_pnl):]) - min_pnl if min_pnl in cum else 0
        else:
            recovery = 0
        return {"final_pnl":cum[-1] if cum else 0, "s1":s1, "s2":s2,
                "curvature":curvature, "bottoming":bottoming,
                "improving":improving, "recovery":recovery}

    def gear_score(self, gaps, other_gears=None):
        score = 0
        traj = self.pnl_trajectory(15)
        capture_start, capture_end = self.gear, self.gear+2

        # A: P&L (30)
        if traj:
            if traj["bottoming"] and traj["final_pnl"]<-3: score+=30
            elif traj["bottoming"] and traj["recovery"]>2: score+=25
            elif traj["bottoming"]: score+=20
            elif traj["improving"] and traj["final_pnl"]<0: score+=20
            elif traj["improving"] and traj["curvature"]>0.3: score+=15
            elif traj["improving"]: score+=10
            elif traj["s2"]>-0.5: score+=5

        # B: Capture range (25)
        capture_pct = 0
        if len(gaps)>=12:
            recent=gaps[-12:]
            in_cap=sum(1 for g in recent if capture_start<=g<=capture_end)
            capture_pct=in_cap/len(recent)
            if capture_pct>=0.60: score+=25
            elif capture_pct>=0.50: score+=20
            elif capture_pct>=0.40: score+=12
            elif capture_pct>=0.30: score+=5
            if len(gaps)>=24:
                older_cap=sum(1 for g in gaps[-24:-12] if capture_start<=g<=capture_end)/12
                if capture_pct>older_cap+0.10: score+=3

        # C: Concentration (20)
        if len(gaps)>=12:
            recent=gaps[-12:]
            counter=Counter(recent)
            total=len(recent)
            sc=sorted(counter.values(),reverse=True)
            top2=(sc[0]+(sc[1] if len(sc)>1 else 0))/total
            if top2>0.65 and capture_pct>=0.45: score+=20
            elif top2>0.55: score+=14
            else:
                cum_pct=0; d80=0
                for c in sc: cum_pct+=c/total; d80+=1
                if cum_pct>=0.80 or d80<=5: pass
                if d80<=3: score+=8
                elif d80<=5: score+=3

        # D: Relative strength (15)
        if other_gears and traj:
            other_slopes=[other_gears[g].pnl_trajectory(15)["s2"]
                         for g in other_gears if g!=self.gear
                         if other_gears[g].pnl_trajectory(15)]
            if other_slopes:
                advantage=traj["s2"]-mean(other_slopes)
                if advantage>0.5 and traj["s2"]>0: score+=15
                elif advantage>0.2 and traj["improving"]: score+=12
                elif advantage>0: score+=8
                elif advantage>-0.3: score+=3

        # E: Not overheated (10)
        if len(gaps)>=18:
            tr=sum(1 for g in gaps[-18:] if 2<=g<=4)/18
            if tr<=0.35: score+=10
            elif tr<=0.45: score+=6
            elif tr<=0.55: score+=2

        return score


# ============================================================
# Backtest variants
# ============================================================

def run_gear_backtest_advanced(sessions, mapper, target_id, label,
                                min_score=55, exit_mode="first_loss",
                                bet_mode="fixed_124", compound=False):
    """
    exit_mode:
      - "first_loss": exit sequence after first loss
      - "score_drop": exit when chosen gear's score drops below min_score-10
      - "two_losses": exit after 2 losses in the same sequence

    bet_mode:
      - "fixed_124": always [1,2,4]
      - "score_scaled": [1,2,4] but scale by score/50
      - "gear_specific": different progressions per gear
      - "kelly_style": bet proportional to (win_rate - 0.5)

    compound: if True, reinvest profits within streaks
    """
    all_signals = []

    for sess in sessions:
        nums = sess["numbers"]
        gears = {g: GearTracker(g) for g in [1,2,3,4]}
        active_bets = {g: None for g in [1,2,3,4]}
        gaps = []
        prev_hit = -1; nz_idx = 0

        # Our bet state
        in_bet = False; bet_round = 0
        chosen_gear = 0; entry_score = 0
        base_bet = 1  # for dynamic sizing
        bet_plan = [1,2,4]  # current bet plan
        losses_in_seq = 0
        score_at_entry = 0

        for si, n in enumerate(nums):
            # ---- Zero handling ----
            if n == 0:
                for g in [1,2,3,4]:
                    if active_bets[g] is not None:
                        esp, br = active_bets[g]; br+=1
                        if br>=3:
                            gears[g].record_outcome(esp, -7)
                            active_bets[g] = None
                        else:
                            active_bets[g] = (esp, br)
                if in_bet:
                    bet_round+=1
                    if bet_round >= len(bet_plan):
                        all_signals.append({"won":False, "net":-sum(bet_plan),
                                          "session":sess["name"],
                                          "gear":chosen_gear, "score":entry_score,
                                          "bet_plan":list(bet_plan)})
                        losses_in_seq += 1
                        in_bet = False
                continue

            eid = mapper(n)
            is_target = (eid == target_id)

            # ---- Resolve hypothetical ----
            for g in [1,2,3,4]:
                if active_bets[g] is not None:
                    esp, br = active_bets[g]
                    if is_target:
                        net = 2 if br==0 else (3 if br==1 else 5)
                        gears[g].record_outcome(esp, net)
                        active_bets[g] = None
                    else:
                        br+=1
                        if br>=3:
                            gears[g].record_outcome(esp, -7)
                            active_bets[g] = None
                        else:
                            active_bets[g] = (esp, br)

            # ---- Resolve actual bet ----
            if in_bet:
                if is_target:
                    # Win — calculate profit based on bet_plan
                    invested = sum(bet_plan[:bet_round+1])
                    payout = bet_plan[bet_round] * 3
                    net = payout - invested
                    all_signals.append({"won":True, "net":net,
                                      "session":sess["name"],
                                      "gear":chosen_gear, "score":entry_score,
                                      "bet_plan":list(bet_plan)})
                    losses_in_seq = 0
                    in_bet = False
                else:
                    bet_round += 1
                    if bet_round >= len(bet_plan):
                        all_signals.append({"won":False, "net":-sum(bet_plan),
                                          "session":sess["name"],
                                          "gear":chosen_gear, "score":entry_score,
                                          "bet_plan":list(bet_plan)})
                        losses_in_seq += 1
                        in_bet = False

            # ---- Update gaps ----
            if is_target:
                if prev_hit >= 0: gaps.append(nz_idx - prev_hit - 1)
                prev_hit = nz_idx
            nz_idx += 1
            cs = (nz_idx - prev_hit - 1) if prev_hit >= 0 else nz_idx

            # ---- Start hypothetical ----
            for g in [1,2,3,4]:
                if cs == g and active_bets[g] is None and len(gaps) >= 18:
                    active_bets[g] = (si, 0)

            # ---- Entry decision ----
            if len(gaps) < 18: continue

            # Score all gears
            gear_scores = {}
            for g in [1,2,3,4]:
                gear_scores[g] = gears[g].gear_score(gaps, gears)
            best_gear = max(gear_scores, key=gear_scores.get)
            best_score = gear_scores[best_gear]

            # Check exit conditions (for score_drop mode)
            if in_bet and exit_mode == "score_drop":
                # Check if current gear's score has dropped
                curr_score = gear_scores.get(chosen_gear, 0)
                if curr_score < score_at_entry - 15:
                    # Force exit — consider remaining bets as losses
                    remaining = sum(bet_plan[bet_round:])
                    all_signals.append({"won":False, "net":-(sum(bet_plan[:bet_round]) + remaining),
                                      "session":sess["name"],
                                      "gear":chosen_gear, "score":curr_score,
                                      "bet_plan":list(bet_plan),
                                      "early_exit":True})
                    losses_in_seq += 1
                    in_bet = False

            # Exit on two losses
            if in_bet and exit_mode == "two_losses" and losses_in_seq >= 2:
                remaining = sum(bet_plan[bet_round:])
                if remaining > 0:
                    all_signals.append({"won":False, "net":-sum(bet_plan[:bet_round]),
                                      "session":sess["name"],
                                      "gear":chosen_gear, "score":entry_score,
                                      "bet_plan":list(bet_plan),
                                      "early_exit":True})
                in_bet = False

            # Entry
            if not in_bet and best_score >= min_score and cs == best_gear:
                in_bet = True; bet_round = 0
                chosen_gear = best_gear
                entry_score = best_score
                score_at_entry = best_score
                losses_in_seq = 0

                # Determine bet plan
                if bet_mode == "fixed_124":
                    bet_plan = [1, 2, 4]
                elif bet_mode == "score_scaled":
                    scale = max(0.5, min(2.0, best_score / 50))
                    bet_plan = [int(1*scale), int(2*scale), int(4*scale)]
                    bet_plan = [max(1,b) for b in bet_plan]
                elif bet_mode == "gear_specific":
                    if chosen_gear == 1:
                        bet_plan = [1, 1, 2, 4]  # longer chain for early entry
                    elif chosen_gear == 2:
                        bet_plan = [1, 2, 4]     # standard
                    elif chosen_gear == 3:
                        bet_plan = [1, 2, 4]     # standard
                    else:  # gear 4
                        bet_plan = [2, 4]         # short, higher base
                elif bet_mode == "kelly_style":
                    # Bet more when score is high, less when low
                    kelly_frac = max(0.25, min(1.5, (best_score - 40) / 30))
                    bet_plan = [int(1*kelly_frac), int(2*kelly_frac), int(4*kelly_frac)]
                    bet_plan = [max(1,b) for b in bet_plan]
                elif bet_mode == "micro":
                    # Minimal risk: 2 rounds only
                    bet_plan = [1, 2]
                else:
                    bet_plan = [1, 2, 4]

    return all_signals


def run_baseline(sessions, mapper, target_id, skip=2):
    signals = []
    for sess in sessions:
        nums = sess["numbers"]
        gaps=[]; prev_hit=-1; nz_idx=0
        in_bet=False; br=0
        for si, n in enumerate(nums):
            if n==0:
                if in_bet:
                    br+=1
                    if br>=3:
                        signals.append({"won":False,"net":-7,"session":sess["name"],
                                      "gear":skip,"score":0,"bet_plan":[1,2,4]})
                        in_bet=False
                continue
            eid=mapper(n); is_target=(eid==target_id)
            if in_bet:
                if is_target:
                    net=2 if br==0 else (3 if br==1 else 5)
                    signals.append({"won":True,"net":net,"session":sess["name"],
                                  "gear":skip,"score":0,"bet_plan":[1,2,4]})
                    in_bet=False
                else:
                    br+=1
                    if br>=3:
                        signals.append({"won":False,"net":-7,"session":sess["name"],
                                      "gear":skip,"score":0,"bet_plan":[1,2,4]})
                        in_bet=False
            if is_target:
                if prev_hit>=0: gaps.append(nz_idx-prev_hit-1)
                prev_hit=nz_idx
            nz_idx+=1
            cs=(nz_idx-prev_hit-1) if prev_hit>=0 else nz_idx
            if not in_bet and cs==skip and len(gaps)>=12:
                in_bet=True; br=0
    return signals


# ============================================================
# Reporting
# ============================================================

def analyze(signals, label, sessions):
    if not signals: print(f"  {label}: 0 sig"); return None
    tb=sum(sum(sig.get("bet_plan",[1,2,4])) for sig in signals) if signals else 0
    tn=sum(s["net"] for s in signals)
    roi=tn/tb*100 if tb>0 else 0
    wins=sum(1 for s in signals if s["won"])
    wr=wins/len(signals)*100

    sess_pnl=defaultdict(float)
    for s in signals: sess_pnl[s["session"]]+=s["net"]
    pnls=list(sess_pnl.values())
    cum=0;peak=0;dd=0
    for p in pnls: cum+=p
    if cum>peak: peak=cum
    dd=max(dd,peak-cum)
    ws=sum(1 for p in pnls if p>0); ls=sum(1 for p in pnls if p<0)
    cl=0;cc=0
    for s in signals:
        if not s["won"]: cc+=1; cl=max(cl,cc)
        else: cc=0

    # By gear
    gs=defaultdict(lambda:{"s":0,"w":0,"net":0,"bet":0})
    for s in signals:
        g=s.get("gear",0)
        gs[g]["s"]+=1; gs[g]["bet"]+=sum(s.get("bet_plan",[1,2,4]))
        if s["won"]: gs[g]["w"]+=1
        gs[g]["net"]+=s["net"]

    r30n={s["name"] for s in sessions[-30:]}
    r30=[s for s in signals if s["session"] in r30n]
    r30b=sum(sum(sig.get("bet_plan",[1,2,4])) for sig in r30)
    r30net=sum(s["net"] for s in r30)
    r30r=r30net/r30b*100 if r30b>0 else 0

    # Avg profit per signal
    avg_net = tn/len(signals) if signals else 0
    avg_bet = tb/len(signals) if signals and len(signals) > 0 else 0

    print(f"  {label}")
    print(f"    sig={len(signals)} wr={wr:.1f}% ROI={roi:+.2f}% net={tn:+.0f} "
          f"avg_bet={avg_bet:.1f} avg_net={avg_net:+.2f} DD={dd:.0f} CL={cl} "
          f"ws={ws} ls={ls} r30={r30r:+.2f}%")

    # Gear breakdown
    gparts=[]
    for g in sorted(gs):
        gg=gs[g]; gr=gg["w"]/gg["s"]*100 if gg["s"]>0 else 0
        groi=gg["net"]/gg["bet"]*100 if gg["bet"]>0 else 0
        gparts.append(f"G{g}:{gg['s']}/{gr:.0f}%/{groi:+.1f}%")
    if gparts: print(f"    Gears: {' | '.join(gparts)}")

    return {"label":label,"signals":len(signals),"roi":roi,"net":tn,
            "wr":wr,"max_dd":dd,"max_cl":cl,"r30_roi":r30r,"ws":ws,"ls":ls}


# ============================================================
# MAIN
# ============================================================

def main():
    path = "HistoryData/wzs-merged.json"
    sessions = load_sessions(path)
    sessions.sort(key=lambda s: s["tms"])
    print(f"{len(sessions)} sessions")

    entities = [
        (get_row, 0, "1行"),
        (get_row, 2, "3行"),
        (get_group, 0, "一组"),
    ]

    all_results = []

    for mapper, target_id, elabel in entities:
        print(f"\n{'='*60}")
        print(f" {elabel}")
        print(f"{'='*60}")

        # Baseline
        for skip in [1,2,3,4]:
            sigs = run_baseline(sessions, mapper, target_id, skip)
            r = analyze(sigs, f"BASELINE skip={skip}", sessions)
            if r: all_results.append(r)

        # --- Test exit modes ---
        for exit_mode in ["first_loss", "two_losses"]:
            for min_score in [50, 55, 60]:
                sigs = run_gear_backtest_advanced(
                    sessions, mapper, target_id, elabel,
                    min_score=min_score, exit_mode=exit_mode, bet_mode="fixed_124")
                if len(sigs) < 20: continue
                r = analyze(sigs, f"GR exit={exit_mode} score≥{min_score}", sessions)
                if r: all_results.append(r)

        # --- Test bet modes ---
        for bet_mode in ["gear_specific", "score_scaled", "kelly_style", "micro"]:
            for min_score in [55, 60]:
                sigs = run_gear_backtest_advanced(
                    sessions, mapper, target_id, elabel,
                    min_score=min_score, exit_mode="first_loss", bet_mode=bet_mode)
                if len(sigs) < 20: continue
                r = analyze(sigs, f"GR bet={bet_mode} score≥{min_score}", sessions)
                if r: all_results.append(r)

        # --- Best combo: gear_specific + two_losses ---
        for min_score in [55, 60]:
            sigs = run_gear_backtest_advanced(
                sessions, mapper, target_id, elabel,
                min_score=min_score, exit_mode="two_losses", bet_mode="gear_specific")
            if len(sigs) < 20: continue
            r = analyze(sigs, f"GR two_losses+gear_spec score≥{min_score}", sessions)
            if r: all_results.append(r)

    # ============================================================
    # PORTFOLIO: best per entity combined
    # ============================================================
    print(f"\n{'='*60}")
    print(f" COMBINED PORTFOLIO")
    print(f"{'='*60}")

    # 1行: fixed skip=1
    s1 = run_baseline(sessions, get_row, 0, skip=1)
    # 3行: gear rotation score≥55 + gear_specific
    s3, _ = run_gear_backtest_advanced(sessions, get_row, 2, "3行",
                                        min_score=55, exit_mode="first_loss",
                                        bet_mode="gear_specific"), None
    # Hmm, the function returns just signals, not a tuple. Let me fix.

    # Actually let me just combine the individual results
    # Best for 1行: baseline skip=1
    # Best for 3行: gear rotation score≥55 + gear_specific
    # Best for 一组: baseline skip=3

    sigs_1x = run_baseline(sessions, get_row, 0, skip=1)
    sigs_3x = run_gear_backtest_advanced(sessions, get_row, 2, "3行",
                                          min_score=55, exit_mode="first_loss",
                                          bet_mode="gear_specific")
    sigs_g1 = run_baseline(sessions, get_group, 0, skip=3)

    combined = sigs_1x + sigs_3x + sigs_g1
    r = analyze(combined, "PORTFOLIO: 1行(skip1)+3行(GR)+一组(skip3)", sessions)
    if r: all_results.append(r)

    # ============================================================
    # RANKING
    # ============================================================
    print(f"\n{'='*60}")
    print(f" TOP 25 (by ROI)")
    print(f"{'='*60}")
    all_results.sort(key=lambda x: x["roi"], reverse=True)
    for i, rec in enumerate(all_results[:25]):
        print(f"  {i+1:2d}. {rec['label']:<55s} ROI={rec['roi']:+.2f}% sig={rec['signals']:>5d} "
              f"net={rec['net']:+.0f} wr={rec['wr']:.1f}% DD={rec['max_dd']:.0f} "
              f"ws={rec['ws']} ls={rec['ls']} r30={rec['r30_roi']:+.2f}%")


if __name__ == "__main__":
    main()
