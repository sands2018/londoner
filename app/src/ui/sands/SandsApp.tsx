import { lazy, Suspense, useEffect, useLayoutEffect, useState } from "react";
import { ArrowRight, LockKeyhole, Settings2 } from "lucide-react";
import { BlackjackGame } from "./BlackjackGame";
import { PlayingCard, RouletteEmblem, SandsDialog, SandsMark } from "./SandsShared";
import { readDisplaySettings, useDisplaySettings, writeDisplaySettings } from "./displaySettings";
import { DiceEmblem } from "./DiceFace";
import { readSicBoSettings, writeSicBoSettings } from "./sicBoSettings";
import "./sands.css";
import "./sicBo.css";

const RouletteApp = lazy(() => import("../App").then(({ App }) => ({ default: App })));
const SicBoGame = lazy(() => import("./SicBoGame").then(({ SicBoGame }) => ({ default: SicBoGame })));
type Page = "lobby" | "roulette" | "blackjack" | "sicbo";
const pageFromHash = (): Page => location.hash === "#roulette" ? "roulette" : location.hash === "#blackjack" ? "blackjack" : location.hash === "#sicbo" ? "sicbo" : "lobby";

export function SandsApp() {
  const [page, setPage] = useState<Page>(pageFromHash);
  const [visitedRoulette, setVisitedRoulette] = useState(page === "roulette");
  const [visitedBlackjack, setVisitedBlackjack] = useState(page === "blackjack");
  const [visitedSicBo, setVisitedSicBo] = useState(page === "sicbo");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const display = useDisplaySettings();
  useEffect(() => {
    const update = () => setPage(pageFromHash());
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  useEffect(() => {
    if (page === "roulette") setVisitedRoulette(true);
    if (page === "blackjack") setVisitedBlackjack(true);
    if (page === "sicbo") setVisitedSicBo(true);
    const title = page === "lobby" ? "Sands2018" : `${page === "roulette" ? "轮盘" : page === "sicbo" ? "骰宝" : "二十一点"} · Sands2018`;
    document.title = title;
    if (window.parent !== window) window.parent.document.title = title;
  }, [page]);
  useLayoutEffect(() => {
    document.documentElement.classList.toggle("android", !display.iphone && /android/i.test(navigator.userAgent));
    document.documentElement.classList.toggle("iphone", display.iphone || /iphone/i.test(navigator.userAgent));
    document.documentElement.classList.toggle("sands-game-page", page !== "roulette");
  }, [display.iphone, page]);
  function navigate(next: Page) {
    location.hash = next === "lobby" ? "lobby" : next;
    setPage(next);
  }
  return <>
    {page === "lobby" && <main className={`sands-surface sands-lobby ${display.desktop ? "is-desktop" : "is-mobile"}`}>
      <header className="sands-lobby-nav"><span>SANDS2018</span><button type="button" className="sands-icon" title="配置" aria-label="配置" onClick={() => setSettingsOpen(true)}><Settings2 size={21} /></button></header>
      <div className="sands-lobby-content">
        <h1><SandsMark /></h1>
        <div className="sands-brand-divider"><span /> <i /> <span /></div>
        <div className="sands-game-choices">
          <button type="button" className="sands-game-choice" onClick={() => navigate("roulette")} aria-label="轮盘">
            <RouletteEmblem /><span className="sands-choice-label"><strong>轮盘</strong><small>ROULETTE</small></span><ArrowRight size={21} />
          </button>
          <button type="button" className="sands-game-choice" onClick={() => navigate("blackjack")} aria-label="二十一点">
            <span className="sands-card-emblem"><PlayingCard card={{ id: "lobby-ace", rank: "A", suit: "s", hidden: false }} /><PlayingCard card={{ id: "lobby-king", rank: "K", suit: "h", hidden: false }} /></span>
            <span className="sands-choice-label"><strong>二十一点</strong><small>BLACKJACK</small></span><ArrowRight size={21} />
          </button>
          <button type="button" className="sands-game-choice" onClick={() => navigate("sicbo")} aria-label="骰宝">
            <DiceEmblem /><span className="sands-choice-label"><strong>骰宝</strong><small>SIC BO</small></span><ArrowRight size={21} />
          </button>
          <button type="button" className="sands-game-choice is-upcoming" disabled aria-label="百家乐，尚未开放" title="百家乐尚未开放">
            <span className="sands-card-emblem"><PlayingCard card={{ id: "lobby-seven", rank: "7", suit: "d", hidden: false }} /><PlayingCard card={{ id: "lobby-two", rank: "2", suit: "c", hidden: false }} /></span>
            <span className="sands-choice-label"><strong>百家乐</strong><small>BACCARAT · 尚未开放</small></span><LockKeyhole size={20} />
          </button>
        </div>
      </div>
      <footer className="sands-lobby-footer"><span>私人牌桌</span><span>虚拟筹码 · 仅供娱乐</span></footer>
    </main>}
    {visitedRoulette && <div hidden={page !== "roulette"}>
      <Suspense fallback={<div className="sands-loading">Sands2018</div>}><RouletteApp active={page === "roulette"} onReturnToLobby={() => navigate("lobby")} /></Suspense>
    </div>}
    {visitedBlackjack && <div className="sands-blackjack-host" hidden={page !== "blackjack"}>
      <BlackjackGame desktop={display.desktop} active={page === "blackjack"} onLobby={() => navigate("lobby")} onSettings={() => setSettingsOpen(true)} />
    </div>}
    {visitedSicBo && <div className="sic-host" hidden={page !== "sicbo"}>
      <Suspense fallback={<div className="sands-loading">骰宝</div>}><SicBoGame desktop={display.desktop} active={page === "sicbo"} onLobby={() => navigate("lobby")} onSettings={() => setSettingsOpen(true)} /></Suspense>
    </div>}
    {settingsOpen && <SandsSettings onClose={() => setSettingsOpen(false)} />}
  </>;
}

function SandsSettings({ onClose }: { onClose: () => void }) {
  const [draft, setDraft] = useState(readDisplaySettings);
  const [sicBo, setSicBo] = useState(readSicBoSettings);
  return <SandsDialog title="配置 · 其它" onClose={onClose}>
    <section className="sands-settings-section"><h3>显示</h3>
      <div className="sands-radio-options" role="radiogroup" aria-label="设备模式">
        {([ ["auto", "自动"], ["desktop", "电脑"], ["mobile", "手机"], ["iphone", "模拟iPhone"] ] as const).map(([value, label]) => <label className="config-option-row" key={value}>
          <input type="radio" name="sands-display-mode" aria-label={label} checked={value === "iphone" ? draft.iphone : !draft.iphone && draft.mode === value} onChange={() => setDraft({ ...draft, iphone: value === "iphone", mode: value === "iphone" ? draft.mode : value })} /><span>{label}</span>
        </label>)}
      </div>
    </section>
    <section className="sands-settings-section"><h3>游戏</h3><div className="sands-speed-row"><span>动画速度</span><div className="sands-radio-options" role="radiogroup" aria-label="动画速度">{([ ["slow", "慢"], ["fast", "快"] ] as const).map(([value, label]) => <label className="config-option-row" key={value}><input type="radio" name="sands-speed" checked={draft.speed === value} onChange={() => setDraft({ ...draft, speed: value })} /><span>{label}</span></label>)}</div></div></section>
    <section className="sands-settings-section"><h3>骰宝</h3>
      <div className="sands-speed-row"><span>赔率规则</span><div className="sands-radio-options" role="radiogroup" aria-label="骰宝赔率规则">{([["macau", "澳门"], ["australia", "澳洲"]] as const).map(([rule, label]) => <label className="config-option-row" key={rule}><input type="radio" name="sic-rule" checked={sicBo.rule === rule} onChange={() => setSicBo({ ...sicBo, rule })} /><span>{label}</span></label>)}</div></div>
      <div className="sands-speed-row sic-setting-minimum"><span>最低下注</span><div className="sands-radio-options" role="radiogroup" aria-label="骰宝最低下注">{([500, 300, 20] as const).map(minimum => <label className="config-option-row" key={minimum}><input type="radio" name="sic-minimum" checked={sicBo.minimum === minimum} onChange={() => setSicBo({ ...sicBo, minimum })} /><span>{minimum}</span></label>)}</div></div>
      <p className="sic-settings-note">大小单双 {sicBo.minimum}，其余格子 {sicBo.minimum === 20 ? 10 : 100}。已开奖的牌局保留原赔率。</p>
    </section>
    <footer className="sands-modal-actions"><button type="button" className="sands-button" onClick={onClose}>取消</button><button type="button" className="sands-button primary" onClick={() => { writeSicBoSettings(sicBo); writeDisplaySettings(draft); onClose(); }}>保存</button></footer>
  </SandsDialog>;
}
