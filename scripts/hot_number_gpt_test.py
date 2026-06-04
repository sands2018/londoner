"""
Hot Number — GPT Review Verification
=====================================
Test GPT's suggested improvements against current implementation.

Author: DeepSeek (via Claude Code)
Date: 2026-06-04
"""

import json
from collections import Counter, defaultdict
from statistics import mean, stdev

def load_sessions(path):
    with open(path, encoding="utf-8") as f: data = json.load(f)
    return sorted([{'name':e.get('Name','?'),'numbers':[int(x.strip()) for x in e.get('Numbers','').split(',') if x.strip()] if isinstance(e.get('Numbers',''),str) else e.get('Numbers',[]),'tms':e.get('tms',0)} for e in data if e.get('Numbers')], key=lambda s:s['tms'])

def count_win(arr, num, w):
    s=max(0,len(arr)-w)
    return sum(1 for i in range(s,len(arr)) if arr[i]==num)

def get_top_n(arr, w, n, ties=False):
    """Get top N numbers in window. ties=True includes cutoff ties."""
    if len(arr)<w: return set()
    s=max(0,len(arr)-w); c=Counter()
    for i in range(s,len(arr)):
        if arr[i]!=0: c[arr[i]]+=1
    sn=sorted(c.items(),key=lambda x:(-x[1],x[0]))
    if len(sn)<=n: return set(num for num,_ in sn)
    if ties:
        cutoff=sn[n-1][1]
        return set(num for num,cnt in sn if cnt>=cutoff)
    else:
        return set(num for num,_ in sn[:n])

def is_trending_up(arr, num, w):
    """Half-up: second half > first half"""
    if len(arr)<w: return False
    start=len(arr)-w; mid=start+w//2
    return sum(1 for i in range(mid,len(arr)) if arr[i]==num) > sum(1 for i in range(start,mid) if arr[i]==num)

def trend_diff(arr, num, w):
    if len(arr)<w: return 0
    start=len(arr)-w; mid=start+w//2
    return sum(1 for i in range(mid,len(arr)) if arr[i]==num) - sum(1 for i in range(start,mid) if arr[i]==num)

def acceleration_148(arr, num):
    """Three-segment acceleration over 148 spins."""
    if len(arr)<148: return False, 0
    s=len(arr)-148
    seg_size=49  # ~148/3
    seg1=sum(1 for i in range(s,s+seg_size) if arr[i]==num)
    seg2=sum(1 for i in range(s+seg_size,s+2*seg_size) if arr[i]==num)
    seg3=sum(1 for i in range(s+2*seg_size,len(arr)) if arr[i]==num)
    accel = seg3 > seg2 > seg1  # strictly accelerating
    return accel, seg3-seg1

def backtest(sessions, fn, warmup=50, max_n=1):
    ps = defaultdict(lambda:{'bet':0,'win':0,'s':0,'w':0})
    for sess in sessions:
        nums=sess['numbers']; sn=sess['name']
        for i in range(warmup, len(nums)):
            picks=fn(nums[:i])
            if not picks: continue
            bets=list(picks)[:max_n]
            if not bets: continue
            ps[sn]['bet']+=len(bets); ps[sn]['s']+=1
            if any(nums[i]==b and nums[i]!=0 for b in bets):
                ps[sn]['win']+=36; ps[sn]['w']+=1
    return ps

def analyze(ps, sessions, label):
    pnls=[ps.get(s['name'],{'bet':0,'win':0})['win']-ps.get(s['name'],{'bet':0,'win':0})['bet'] for s in sessions]
    tn=sum(pnls); tb=sum(ps[s['name']]['bet'] for s in sessions)
    ts=sum(ps[s['name']]['s'] for s in sessions)
    tw=sum(ps[s['name']]['w'] for s in sessions)
    roi=tn/tb*100 if tb else 0; wr=tw/ts*100 if ts else 0
    ws=sum(1 for p in pnls if p>0); ls=sum(1 for p in pnls if p<0)
    sp=sorted(pnls,reverse=True); t5=sum(sp[:5]); t5p=t5/tn*100 if tn>0 else 0
    cum=0;peak=0;dd=0
    for p in pnls: cum+=p;peak=max(peak,cum);dd=max(dd,peak-cum)
    cv=stdev(pnls)/abs(mean(pnls)) if mean(pnls)!=0 else 999
    print(f'{label}: ROI={roi:+.2f}% sig={ts} net={tn:+.0f} wr={wr:.2f}% cv={cv:.2f} top5={t5p:.0f}% dd={dd:.0f} W/L={ws}/{ls}')
    return roi, ts, tn, ws, ls, dd

sessions=load_sessions('HistoryData/wzs-merged.json')
recent=sessions[-72:]
print(f'{len(recent)} sessions\n')

# ---- A: Current implementation (Top3 with ties, warmup 50) ----
def current_top3_ties(nums):
    h37=get_top_n(nums,37,3,True); h74=get_top_n(nums,74,3,True); h111=get_top_n(nums,111,3,True)
    c=h37&h74&h111
    c=set(n for n in c if is_trending_up(nums,n,37))
    c=set(n for n in c if count_win(nums,n,20)<4)
    if c and len(nums)>=37:
        rc=Counter(x for x in nums[-37:] if x!=0)
        return [max(c,key=lambda n:rc.get(n,0))]
    return []

analyze(backtest(recent,current_top3_ties,50),recent,'A: Current Top3+ties warm50')

# ---- B: GPT improved DS 3-window ----
def gpt_ds_improved(nums):
    """warmup 111, Top5 no ties, half-up trend, burst<4in20"""
    h37=get_top_n(nums,37,5,False); h74=get_top_n(nums,74,5,False); h111=get_top_n(nums,111,5,False)
    c=h37&h74&h111
    c=set(n for n in c if is_trending_up(nums,n,37))
    c=set(n for n in c if count_win(nums,n,20)<4)
    if c and len(nums)>=37:
        rc=Counter(x for x in nums[-37:] if x!=0)
        return [max(c,key=lambda n:rc.get(n,0))]
    return []

analyze(backtest(recent,gpt_ds_improved,111),recent,'B: GPT-DS Top5 no-ties warm111')

# ---- C: 148 acceleration ----
def gpt_148_accel(nums):
    """148-window, Top10 pool, three-segment acceleration, Top1, chase 1-2"""
    if len(nums)<148: return []
    top10=get_top_n(nums,148,10,False)
    best_num=None; best_accel=0; best_cnt=0
    for n in top10:
        accel, diff = acceleration_148(nums, n)
        if accel:
            cnt=count_win(nums,n,74)
            if cnt>best_cnt or (cnt==best_cnt and diff>best_accel):
                best_num=n; best_accel=diff; best_cnt=cnt
    if best_num:
        return [best_num]
    return []

# Need to modify backtest for chase 1-2
def backtest_chase12(sessions, fn, warmup=148):
    """Chase 1-2: bet 1 unit on next spin, if miss bet 2 units. Max 2 rounds."""
    ps = defaultdict(lambda:{'bet':0,'win':0,'s':0,'w':0})
    for sess in sessions:
        nums=sess['numbers']; sn=sess['name']
        chasing=False; chase_round=0; chase_num=None
        for i in range(warmup, len(nums)):
            if not chasing:
                picks=fn(nums[:i])
                if picks:
                    chasing=True; chase_round=0; chase_num=picks[0]
                    ps[sn]['bet']+=1; ps[sn]['s']+=1
                    if nums[i]==chase_num and nums[i]!=0:
                        ps[sn]['win']+=36; ps[sn]['w']+=1; chasing=False
                continue
            # In chase
            bet_amt=2; ps[sn]['bet']+=bet_amt
            if nums[i]==chase_num and nums[i]!=0:
                ps[sn]['win']+=36; ps[sn]['w']+=1; chasing=False
            else:
                chasing=False  # lose both rounds
    return ps

analyze(backtest_chase12(recent,gpt_148_accel,148),recent,'C: GPT 148 accel chase1-2')

# ---- D: 148 accel flat bet (for comparison) ----
analyze(backtest(recent,gpt_148_accel,148),recent,'D: GPT 148 accel flat')

# ---- E: DS improved Top5 no-ties, burst<3in20 (stricter) ----
def ds_stricter(nums):
    h37=get_top_n(nums,37,5,False); h74=get_top_n(nums,74,5,False); h111=get_top_n(nums,111,5,False)
    c=h37&h74&h111
    c=set(n for n in c if is_trending_up(nums,n,37))
    c=set(n for n in c if count_win(nums,n,20)<3)  # stricter burst
    if c and len(nums)>=37:
        rc=Counter(x for x in nums[-37:] if x!=0)
        return [max(c,key=lambda n:rc.get(n,0))]
    return []

analyze(backtest(recent,ds_stricter,111),recent,'E: DS Top5 no-ties burst<3 warm111')

# ---- F: Hybrid: DS consensus as soft filter on 148 accel ----
def hybrid(nums):
    if len(nums)<148: return []
    # 148 acceleration pool
    top10=get_top_n(nums,148,10,False)
    # DS consensus as bonus score
    scores={}
    h37=get_top_n(nums,37,10,False); h74=get_top_n(nums,74,10,False); h111=get_top_n(nums,111,10,False)
    for n in top10:
        accel, diff = acceleration_148(nums, n)
        if not accel: continue
        # Consensus score: 0-3
        cs=(1 if n in h37 else 0)+(1 if n in h74 else 0)+(1 if n in h111 else 0)
        # Trend bonus
        td=trend_diff(nums,n,37)
        # Burst penalty
        burst=count_win(nums,n,20)
        scores[n]=(cs*10 + td*2 - burst*3 + diff)
    if scores:
        return [max(scores,key=scores.get)]
    return []

analyze(backtest(recent,hybrid,148),recent,'F: Hybrid 148accel + DS consensus')

# ---- G: 148 accel with burst<4 ----
def gpt_148_accel_burst(nums):
    if len(nums)<148: return []
    top10=get_top_n(nums,148,10,False)
    best_num=None; best_accel=0; best_cnt=0
    for n in top10:
        accel, diff = acceleration_148(nums, n)
        if accel and count_win(nums,n,20)<4:
            cnt=count_win(nums,n,74)
            if cnt>best_cnt or (cnt==best_cnt and diff>best_accel):
                best_num=n; best_accel=diff; best_cnt=cnt
    if best_num:
        return [best_num]
    return []

analyze(backtest(recent,gpt_148_accel_burst,148),recent,'G: 148accel + burst<4')
analyze(backtest_chase12(recent,gpt_148_accel_burst,148),recent,'H: 148accel+burst chase1-2')

print('\nDone.')
