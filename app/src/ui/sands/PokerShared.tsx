import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowLeft, ChartNoAxesColumnIncreasing, CircleHelp, CirclePlus, History, RotateCcw, Settings2 } from "lucide-react";
import { pokerCard } from "../../core/pokerCards";
import { PlayingCard, SandsMark } from "./SandsShared";

export type PokerGameProps = { desktop: boolean; active: boolean; onLobby: () => void; onSettings: () => void };
export const pokerFormat = (n: number) => n.toLocaleString("zh-CN");
export const pokerSigned = (n: number) => `${n > 0 ? "+" : ""}${pokerFormat(n)}`;
export function usePokerStore<T>(key: string, fresh: () => T, read: (value: unknown) => T | null) {
  const [loaded] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      const saved = raw ? read(JSON.parse(raw)) : null;
      return { state: saved ?? fresh(), notice: raw && !saved ? "存档无法读取，已打开新牌桌" : "" };
    } catch { return { state: fresh(), notice: "无法读取本地存档" }; }
  });
  const [state, setState] = useState(loaded.state);
  const current = useRef(state);
  const [notice, setNotice] = useState(loaded.notice);
  const commit = useCallback((action: (s: T) => T): T | null => {
    try {
      const next = action(current.current);
      if (next === current.current) return null;
      localStorage.setItem(key, JSON.stringify(next));
      current.current = next; setState(next); setNotice("");
      return next;
    } catch { setNotice("操作未完成，请检查本地存储和浏览器随机数支持后重试"); return null; }
  }, [key]);
  return { state, current, notice, setNotice, commit };
}
type Animation = { kind: "deal" | "board" | "reveal" | "settle"; visible: number; total: number };
export function usePokerAnimation(active: boolean) {
  const [animation, setAnimation] = useState<Animation | null>(null);
  const locked = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const finish = useCallback(() => {
    timers.current.forEach(clearTimeout); timers.current = []; locked.current = false; setAnimation(null);
  }, []);
  const run = useCallback((kind: Animation["kind"], total: number, step: number) => {
    timers.current.forEach(clearTimeout); timers.current = [];
    locked.current = true; setAnimation({ kind, visible: 0, total });
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const interval = reduced ? 70 : step;
    for (let i = 0; i < total; i++) timers.current.push(setTimeout(() => setAnimation({ kind, visible: i + 1, total }), 80 + i * interval));
    timers.current.push(setTimeout(finish, 80 + total * interval + (reduced ? 80 : 350)));
  }, [finish]);
  useEffect(() => {
    const hide = () => { if (document.visibilityState === "hidden") finish(); };
    document.addEventListener("visibilitychange", hide);
    return () => { document.removeEventListener("visibilitychange", hide); timers.current.forEach(clearTimeout); };
  }, [finish]);
  useEffect(() => { if (!active) finish(); }, [active, finish]);
  return { animation, locked, run, finish };
}
export function usePokerViewport(desktop: boolean): CSSProperties {
  const [width, setWidth] = useState(innerWidth);
  useLayoutEffect(() => {
    const resize = () => setWidth(window.visualViewport?.width ?? innerWidth);
    resize(); window.addEventListener("resize", resize); window.visualViewport?.addEventListener("resize", resize);
    return () => { window.removeEventListener("resize", resize); window.visualViewport?.removeEventListener("resize", resize); };
  }, []);
  const scale = Math.min(1, Math.max(1, width) / 960);
  return desktop ? { width: `${100 / scale}%`, height: `calc(100dvh / ${scale})`, transform: `scale(${scale})` } : {};
}
export function PokerHeader({ title, onLobby, onSettings, onRules }: { title: string; onLobby: () => void; onSettings: () => void; onRules: () => void }) {
  return <header className="poker-header"><div className="poker-brand"><button type="button" className="sands-icon" aria-label="返回大厅" title="返回大厅" onClick={onLobby}><ArrowLeft size={21} /></button><SandsMark compact /></div>
    <h1>{title}</h1><div className="poker-header-tools"><button type="button" className="sands-icon" aria-label="玩法与规则" title="玩法与规则" onClick={onRules}><CircleHelp size={21} /></button><button type="button" className="sands-icon" aria-label="配置" title="配置" onClick={onSettings}><Settings2 size={21} /></button></div></header>;
}
export function PokerCards({ cards, hand, hidden = false, visible = cards.length, slots = cards.length, className = "", best = [] }: {
  cards: readonly number[]; hand: number; hidden?: boolean; visible?: number; slots?: number; className?: string; best?: readonly number[];
}) {
  return <div className={`poker-cards ${className}`}>{Array.from({ length: slots }, (_, i) => i < cards.length && i < visible
    ? <div key={`${hand}-${cards[i]}`} className={best.includes(cards[i]) && !hidden ? "poker-card-wrap is-best" : "poker-card-wrap"}><PlayingCard card={pokerCard(cards[i], hand, hidden)} /></div>
    : <div key={`empty-${i}`} className="bj-card-placeholder" />)}</div>;
}
export function PokerFooter({ balance, rounds, profit, disabled, onCredits, onHistory, onStats, onReset }: {
  balance: number; rounds: number; profit: number; disabled: boolean; onCredits: () => void; onHistory: () => void; onStats: () => void; onReset: () => void;
}) {
  return <footer className="poker-footer"><div><span>筹码余额 <button type="button" className="sands-icon poker-topup" aria-label="补充虚拟筹码" title="补充虚拟筹码" disabled={disabled} onClick={onCredits}><CirclePlus size={14} /></button></span><strong>{pokerFormat(balance)}</strong></div>
    <div><span>已玩局数</span><strong>{rounds}</strong></div><div><span>累计赢利</span><strong className={profit < 0 ? "lose" : "win"}>{pokerSigned(profit)}</strong></div>
    <nav aria-label="记录与统计"><button type="button" className="sands-icon" title="历史记录" aria-label="历史记录" onClick={onHistory}><History size={21} /></button><button type="button" className="sands-icon" title="统计" aria-label="统计" onClick={onStats}><ChartNoAxesColumnIncreasing size={21} /></button><button type="button" className="sands-icon" title="重置统计" aria-label="重置统计" disabled={disabled} onClick={onReset}><RotateCcw size={21} /></button></nav></footer>;
}
