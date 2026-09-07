import type { Die } from "../../core/sicBo";

const pips: Record<Die, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
export function DiceFace({ value }: { value: Die }) {
  return <span className={`sic-die${value === 1 || value === 4 ? " is-red" : ""}`} data-value={value} aria-hidden="true">
    {Array.from({ length: 9 }, (_, i) => <i key={i} className={pips[value].includes(i) ? "pip" : ""} />)}
  </span>;
}
export function DiceEmblem() {
  return <span className="sands-dice-emblem"><DiceFace value={1} /><DiceFace value={4} /><DiceFace value={6} /></span>;
}
