"""Check recent session performance for pick=1 burst<3in20."""
import json
from collections import Counter, defaultdict

def load_sessions(path):
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

def get_hot(nums, window, n):
    if len(nums) < window: return set()
    counts = Counter(x for x in nums[-window:] if x != 0)
    sorted_nums = sorted(counts.items(), key=lambda x: (-x[1], x[0]))
    if len(sorted_nums) <= n: return set(num for num, _ in sorted_nums)
    cutoff = sorted_nums[n-1][1]
    return set(num for num, cnt in sorted_nums if cnt >= cutoff)

def get_trending_up(nums, window, n):
    if len(nums) < window: return set()
    start = len(nums) - window
    mid = start + window // 2
    first = Counter(x for x in nums[start:mid] if x != 0)
    second = Counter(x for x in nums[mid:] if x != 0)
    all_nums = set(list(first.keys()) + list(second.keys()))
    trending = []
    for num in all_nums:
        diff = second.get(num, 0) - first.get(num, 0)
        total = first.get(num, 0) + second.get(num, 0)
        if total > 0 and diff > 0:
            trending.append((num, total, diff))
    trending.sort(key=lambda x: (-x[1], -x[2]))
    if len(trending) <= n: return set(t[0] for t in trending)
    cutoff = trending[n-1][1]
    return set(t[0] for t in trending if t[1] >= cutoff)

def strategy(nums):
    h37 = get_hot(nums, 37, 3)
    h74 = get_hot(nums, 74, 3)
    h111 = get_hot(nums, 111, 3)
    all_hot = h37 & h74 & h111
    trending = get_trending_up(nums, 37, 3)
    candidates = all_hot & trending
    if len(nums) >= 20:
        burst = set(num for num, cnt in Counter(nums[-20:]).items() if cnt >= 3)
        candidates -= burst
    if len(nums) >= 37:
        rc = Counter(x for x in nums[-37:] if x != 0)
        ranked = sorted([(num, rc.get(num,0)) for num in candidates], key=lambda x: -x[1])
        return [ranked[0][0]] if ranked else []  # single pick — return just the number
    return [list(candidates)[0]] if candidates else []

def main():
    path = "HistoryData/wzs-merged.json"
    sessions = load_sessions(path)
    sessions.sort(key=lambda s: s["tms"])

    # Last 20 sessions
    recent = sessions[-20:]
    print(f"Last {len(recent)} sessions:\n")

    cum_net = 0
    for sess in recent:
        nums = sess["numbers"]
        bet = 0; win = 0; hits = 0
        for i in range(50, len(nums)):
            picks = strategy(nums[:i])
            if not picks: continue
            bet += 1
            if nums[i] == picks[0] and nums[i] != 0:
                win += 36
                hits += 1
        net = win - bet
        cum_net += net
        roi = net/bet*100 if bet else 0
        bar = "+" * max(1, int(net/10)) if net > 0 else ("-" * max(1, int(-net/10)))
        print(f"  {sess['name'][:30]:<35s} bet={bet:>4d} hit={hits:>2d} net={net:>+6.0f} ROI={roi:>+6.1f}% {bar}")

    print(f"\n  Cumulative: {cum_net:+.0f}")

    # Also last 30 and last 10
    for n_sess in [30, 10]:
        recent_n = sessions[-n_sess:]
        total_bet = 0; total_win = 0
        for sess in recent_n:
            nums = sess["numbers"]
            for i in range(50, len(nums)):
                picks = strategy(nums[:i])
                if not picks: continue
                total_bet += 1
                if nums[i] == picks[0] and nums[i] != 0:
                    total_win += 36
        net = total_win - total_bet
        roi = net/total_bet*100 if total_bet else 0
        print(f"  Last {n_sess}: bet={total_bet} net={net:+.0f} ROI={roi:+.2f}%")


if __name__ == "__main__":
    main()
