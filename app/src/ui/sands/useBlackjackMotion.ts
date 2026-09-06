import { useLayoutEffect, useRef, type RefObject } from "react";
import type { BlackjackView } from "../../core/blackjack";
import type { TableFrame } from "./blackjackPresentation";

export type PlayingFrame = TableFrame & { serial: number; duration: number };

export function useBlackjackMotion(table: RefObject<HTMLElement | null>, view: BlackjackView, frame: PlayingFrame | null, active: boolean) {
  const positions = useRef(new Map<string, DOMRect>());
  useLayoutEffect(() => {
    const root = table.current;
    if (!root || !active) return;
    const elements = [...root.querySelectorAll<HTMLElement>("[data-card-id]")];
    const targets = new Map(elements.map((el) => [el.dataset.cardId!, el.getBoundingClientRect()]));
    const animations: Animation[] = [];
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (frame && !reduced) {
      const shoe = root.querySelector(".bj-shoe-mouth")?.getBoundingClientRect();
      const discard = root.querySelector(".bj-discard-tray")?.getBoundingClientRect();
      for (const element of elements) {
        const id = element.dataset.cardId!;
        const target = targets.get(id)!;
        const scale = target.width / element.offsetWidth || 1;
        const old = positions.current.get(id);
        const duration = frame.duration * .82;
        if (frame.motion === "collect" && discard) {
          animations.push(element.animate([
            { transform: "translate(0, 0) rotate(0) scale(1)", opacity: 1 },
            { transform: `translate(${(discard.x - target.x) / scale}px, ${(discard.y - target.y) / scale}px) rotate(-14deg) scale(.35)`, opacity: 0 },
          ], { duration, easing: "ease-in", fill: "forwards" }));
        } else if (frame.motion === "deal" && frame.cardId === id && shoe) {
          animations.push(element.animate([
            { transform: `translate(${(shoe.x + shoe.width / 2 - target.x - target.width / 2) / scale}px, ${(shoe.y + shoe.height / 2 - target.y - target.height / 2) / scale}px) rotate(-18deg) scale(.58)`, opacity: .8 },
            { transform: "translate(0, -3px) rotate(2deg) scale(1.015)", opacity: 1, offset: .82 },
            { transform: "translate(0, 0) rotate(0deg) scale(1)", opacity: 1 },
          ], { duration, easing: "cubic-bezier(.18,.65,.25,1)" }));
        } else if (old && frame.motion !== "collect" && (Math.abs(old.x - target.x) > 1 || Math.abs(old.y - target.y) > 1)) {
          animations.push(element.animate([
            { transform: `translate(${(old.x - target.x) / scale}px, ${(old.y - target.y) / scale}px)` },
            { transform: "translate(0, 0)" },
          ], { duration: Math.min(duration, 380), easing: "ease-out" }));
        }
      }
    }
    positions.current = targets;
    return () => animations.forEach((animation) => animation.cancel());
  }, [table, view, frame, active]);
}
