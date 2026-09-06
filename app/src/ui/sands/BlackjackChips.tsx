import { useLayoutEffect, useRef, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { chipColor, wagerChips } from "./blackjackPresentation";

export type ChipFlight = { id: number; value: number; x: number; y: number; fromX: number; fromY: number; size: number };

export function ChipStack({ amount, chips }: { amount: number; chips?: number[] }) {
  const values = chips ? chips.flatMap(wagerChips).slice(-6) : wagerChips(amount);
  return <span className="bj-chip-stack" aria-hidden="true">{values.map((value, i) => <span key={i} className="bj-chip-token" style={{ "--chip-color": chipColor(value), "--stack-index": i } as CSSProperties}><b>{value}</b></span>)}</span>;
}

export function FlyingChip({ flight, onFinish }: { flight: ChipFlight; onFinish: (id: number) => void }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const animation = element.animate([
      { transform: `translate(${flight.fromX - flight.x}px, ${flight.fromY - flight.y}px) scale(1.12) rotate(-22deg)` },
      { transform: "translate(0, -7px) scale(1.06) rotate(5deg)", offset: .8 },
      { transform: "translate(0, 0) scale(1) rotate(0deg)" },
    ], { duration: 360, easing: "cubic-bezier(.18,.72,.3,1)", fill: "both" });
    animation.onfinish = () => onFinish(flight.id);
    return () => animation.cancel();
  }, [flight, onFinish]);
  return createPortal(<span ref={ref} className="bj-chip-token bj-flying-chip" aria-hidden="true" style={{ "--chip-color": chipColor(flight.value), left: flight.x, top: flight.y, width: flight.size, height: flight.size, fontSize: flight.size / 3.6 } as CSSProperties}><b>{flight.value}</b></span>, document.body);
}
