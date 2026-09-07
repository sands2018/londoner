import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import type { BlackjackCard } from "../../core/blackjack";

export function SandsMark({ compact = false }: { compact?: boolean }) {
  return <span className={`sands-wordmark${compact ? " compact" : ""}`} aria-label="Sands2018">
    <svg className="sands-monogram" viewBox="0 0 100 100" aria-hidden="true">
      <path d="M50 3 91 27v46L50 97 9 73V27Z M50 10 85 30v40L50 90 15 70V30Z" fill="none" stroke="currentColor" strokeWidth="1" />
      <path d="M64 31c-14-12-34-3-30 9 4 10 30 8 32 20 3 17-25 22-35 9M64 26v12M31 63v13" fill="none" stroke="currentColor" strokeWidth="3.2" />
    </svg>
    <span className="sands-brand-name">Sands<span>2018</span></span>
  </span>;
}

export function SandsDialog({ title, onClose, children, showTitle = true, className = "" }: { title: string; onClose: () => void; children: ReactNode; showTitle?: boolean; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className={`sands-modal sands-surface ${className}`} aria-label={title} onCancel={onClose} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="sands-modal-inner">
      {showTitle ? <header><h2>{title}</h2><button type="button" className="sands-icon" aria-label="关闭" title="关闭" onClick={onClose}><X size={20} /></button></header>
        : <div className="sands-modal-close-row"><button type="button" className="sands-icon" aria-label="关闭" title="关闭" onClick={onClose}><X size={20} /></button></div>}
      {children}
    </div>
  </dialog>;
}

const suits: Record<string, string> = { s: "♠", h: "♥", c: "♣", d: "♦" };
const suitNames: Record<string, string> = { s: "黑桃", h: "红桃", c: "梅花", d: "方块" };
export function PlayingCard({ card, index = 0 }: { card: BlackjackCard; index?: number }) {
  const symbol = suits[card.suit];
  return <div data-card-id={card.id} className={`bj-card${card.hidden ? " is-hidden" : ""}${card.suit === "h" || card.suit === "d" ? " is-red" : ""}`} style={{ "--card-position": index } as React.CSSProperties} aria-label={card.hidden ? "暗牌" : `${suitNames[card.suit]} ${card.rank}`}>
    <div className="bj-card-turn"><div className="bj-card-face">{!card.hidden && <>
      <span className="bj-card-corner"><b>{card.rank}</b><span>{symbol}</span></span>
      <span className="bj-card-pip" aria-hidden="true">{symbol}</span>
      <span className="bj-card-corner bottom" aria-hidden="true"><b>{card.rank}</b><span>{symbol}</span></span>
    </>}</div><div className="bj-card-reverse"><div className="bj-card-back"><SandsMark compact /></div></div></div>
  </div>;
}

export function RouletteEmblem() {
  return <svg className="sands-roulette-emblem" viewBox="0 0 140 140" aria-hidden="true">
    <circle cx="70" cy="70" r="65" fill="#172f28" stroke="#bda16a" strokeWidth="2" />
    {Array.from({ length: 20 }, (_, i) => <path key={i} d="M70 13a57 57 0 0 1 17.61 2.79L82.67 31.05A41 41 0 0 0 70 29Z" fill={i === 0 ? "#306852" : i % 2 ? "#923e3e" : "#101b17"} stroke="#ac965f" strokeWidth="0.65" transform={`rotate(${i * 18} 70 70)`} />)}
    <circle cx="70" cy="70" r="37" fill="#355143" stroke="#bda16a" />
    <circle cx="70" cy="70" r="25" fill="none" stroke="#8e7d53" />
    <path d="M70 37v66M37 70h66" stroke="#bda16a" strokeWidth="3" />
    <circle cx="70" cy="70" r="9" fill="#d4bb7d" /><circle cx="105" cy="40" r="4" fill="#f5efdb" />
  </svg>;
}
