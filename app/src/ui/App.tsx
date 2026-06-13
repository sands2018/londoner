import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import {
  getNumberColor,
  getNumberColRows,
  getRowIndex,
  isRouletteNumber,
  type ColRowIndex,
  type RouletteNumber,
} from "../core/roulette";
import { Keyboard, SkipBack, SkipForward } from "lucide-react";
import {
  calculateColRowCompare,
  calculateColRowExplore,
  calculateColRowStats,
  colRowExploreRounds as colRowExploreRoundOptions,
  colRowLongLabels,
  colRowSummaryHeaders,
  loadColRowExploreSelections,
  saveColRowExploreSelections,
  type ColRowExploreResult,
  type ColRowWave,
} from "../core/colRowStats";
import { formatNumbers, parseNumbersText } from "../core/numberText";
import {
  calculateColRowDistances,
  calculateColumnDistances,
  calculateFinishedLongs,
  calculateSnapshotStats,
  filterColumnDistances,
} from "../core/stats";
import {
  calculateFrequencyStats,
  frequencyBandLabels,
  frequencyDetailKeys,
  frequencyScopes as classicFrequencyScopes,
  type FrequencyScope,
  type FrequencyStats,
} from "../core/frequencyStats";
import {
  addGameBet,
  calculateGameStats,
  deleteGameBets,
  formatGameBet,
  gameAcrOptions,
  gameRounds,
  isDefaultGameBet,
  loadGameBetSettings,
  loadGameBets,
  restoreDefaultGameBets,
  saveGameBetSettings,
  type GameSortDirection,
  type GameSortField,
} from "../core/gameStats";
import {
  calculateOtherLongStats,
  calculateOtherNumberStats,
  calculateOtherRoundBet,
  calculateOtherRoundSummary,
  otherLongBetCountOptions,
  otherLongRoundOptions,
  otherRoundFailedRounds,
  type OtherNumberItem,
  type OtherNumberSortField,
} from "../core/otherStats";
import { LocalStorageAdapter } from "../storage/localStorageAdapter";
import {
  checkSharedAccess,
  deleteSharedSession,
  deleteTransferSession,
  listSharedSessions,
  listTransferSessions,
  type SharedSession,
  type TransferSession,
  uploadTransferSession,
  upsertSharedSession,
} from "../storage/sharedStorage";
import type { SavedSession } from "../storage/storage";
import {
  CHASE_LENGTH,
  ColdReversalEngine,
  computeColdDetailStats,
  computeRoi,
  computeRhythmDetailStats,
  computeRhythmRoi,
  EXTREME_PCT,
  GAP_WINDOW,
  MIN_GAP,
  PredictionTracker,
  PROGRESSION,
  RHYTHM_MIN_PCT,
  RHYTHM_PROG,
  type ColdSignal,
  type RhythmDetailRow,
  type RhythmSignal,
} from "../core/prediction";
import { analyzePreferredNumber } from "../core/preferredNumber";
import { checkWaveRecovery, computePeakSma, computePeakStats, createRecoveryState, extractGaps, type WaveRecoveryState } from "../core/wave";
import { analyzeChaseSixRolling, chaseSixWindowEnd, chaseSixWindowStart, isInChaseSixWindow } from "../core/chaseSix";
import { analyzeChaseThree, chaseThreeStreetEnd, chaseThreeStreetStart, streetOf } from "../core/chaseThree";
import { QUALITY_124_TIER_META, QUALITY_124_TIER_ORDER, analyzeQuality124 } from "../core/quality124";
import { analyzeHotNumbers, type HotNumberSignal } from "../core/hotNumbers";
import {
  analyzeNumberMergeV2,
  buildNumberMergeV2TolerantUnion,
  buildNumberMergeV2TolerantUnionWithChoices,
  buildNumberMergeV2Union,
  type NumberMergeConflictChoice,
  type NumberMergeEditIssue,
  type NumberMergeV2Result,
} from "../core/numberMergeV2";
import {
  REPEAT_INITIAL_ROUNDS,
  REPEAT_ENV_WINDOW,
  REPEAT_TIER_AGGRESSIVE,
  REPEAT_TIER_CORE,
  SHORT_REPEAT_ENV_WINDOW,
  analyzeRepeatNumber,
  analyzeShortRepeatNumber,
  type RepeatTier,
} from "../core/repeatNumber";

const storage = new LocalStorageAdapter();
const keyboardModeKey = "londoner.keyboardMode";
const currentSessionIdKey = "londoner.currentSessionId";
const colRowScopeKey = "londoner.colRowScope";
const refineScopeKey = "londoner.refineScope";
const otherScopeKey = "londoner.otherScope";
const windowModeKey = "londoner.windowMode";
const repeatFilterOptions: RepeatTier[] = [REPEAT_TIER_CORE, REPEAT_TIER_AGGRESSIVE];
type WindowMode = "classic" | "fibonacci";
const classicStatScopes: readonly number[] = [8, 13, 21, 40, 60, 100, -1];
const fibonacciStatScopes: readonly number[] = [8, 13, 21, 34, 55, 89, 144, -1];
const classicColRowScopes: readonly number[] = [18, 36, 72, 144, 288, -1];
const fibonacciColRowScopes: readonly number[] = [21, 34, 55, 89, 144, 233, -1];
const fibonacciFrequencyScopes: readonly FrequencyScope[] = [21, 34, 55, 89, 144, 233, 377];
const columnMinimums = [3, 4, 5, 6, 7];
const boardRows: RouletteNumber[][] = [
  [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
  [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
  [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
];
const keypadRows: RouletteNumber[][] = [
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
  [21, 22, 23, 24, 25, 26, 27, 28, 29, 30],
  [31, 32, 33, 34, 35, 36],
];

type DialogName = "connect" | "import" | "save" | null;
type DataTab = "local" | "shared" | "transfer";
type DataSortField = "name" | "count" | "time" | "sharedUploader";
type SortDirection = "asc" | "desc";
type ColRowTab = "detail" | "chart" | "summary" | "compare";
type RefineTab = "compare" | "detail";
type OtherTab = "longs" | "numbers" | "rounds";
type OtherRoundTab = "bet" | "summary";

function normalizeRepeatTier(value: string | null): RepeatTier {
  if (value === REPEAT_TIER_CORE || value === "精选信号") return REPEAT_TIER_CORE;
  if (value === REPEAT_TIER_AGGRESSIVE || value === "全部信号") return REPEAT_TIER_AGGRESSIVE;
  return REPEAT_TIER_AGGRESSIVE;
}
type RefineSortField = "name" | "succeeded" | "failureRate";

interface NoticeDialog {
  message: string;
  title: string;
}

interface ConfirmDialog extends NoticeDialog {
  confirmFirst?: boolean;
  confirmText?: string;
  onConfirm: () => Promise<void> | void;
  cancelText?: string;
  onCancel?: () => Promise<void> | void;
}

interface PromptDialog {
  confirmText?: string;
  defaultValue: string;
  message: string;
  onConfirm: (value: string) => Promise<void> | void;
  title: string;
}

interface SessionMergeDialog {
  conflictChoice: NumberMergeConflictChoice;
  issueChoices: NumberMergeConflictChoice[];
  left: SavedSession;
  result: NumberMergeV2Result;
  right: SavedSession;
  targetId: string;
}

interface ConnectIncomingData {
  label: string;
  numbers: RouletteNumber[];
}

interface ConnectDialog {
  conflictChoice: NumberMergeConflictChoice;
  incoming: ConnectIncomingData;
  issueChoices: NumberMergeConflictChoice[];
  result: NumberMergeV2Result;
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  if (window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall back to the legacy selection command below.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  textarea.style.fontSize = "16px";

  const selection = document.getSelection();
  const selectedRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }

  document.body.removeChild(textarea);
  if (selection && selectedRange) {
    selection.removeAllRanges();
    selection.addRange(selectedRange);
  }

  return copied;
}

const savedLoginKey = "londoner.sharedLogin";

export function App() {
  const [numbers, setNumbers] = useState<RouletteNumber[]>([]);
  const [redoNumbers, setRedoNumbers] = useState<RouletteNumber[]>([]);
  const [lastSavedNumbers, setLastSavedNumbers] = useState<RouletteNumber[]>([]);
  const [keyboardMode, setKeyboardMode] = useState<"keypad" | "board">(() => {
    return localStorage.getItem(keyboardModeKey) === "keypad" ? "keypad" : "board";
  });
  const [themeMode] = useState<"soft" | "color">("soft");
  const [keyboardVisible, setKeyboardVisible] = useState(true);
  const [separateColRows, setSeparateColRows] = useState(false);
  const [queueExpanded, setQueueExpanded] = useState(false);
  const [windowMode, setWindowMode] = useState<WindowMode>(() =>
    localStorage.getItem(windowModeKey) === "fibonacci" ? "fibonacci" : "classic",
  );
  const [statsScope, setStatsScope] = useState(21);
  const [colRowScope, setColRowScope] = useState(() => {
    const stored = Number.parseInt(localStorage.getItem(colRowScopeKey) ?? "", 10);
    return classicColRowScopes.includes(stored) ? stored : 72;
  });
  const [columnMinimum, setColumnMinimum] = useState(5);
  const [loaded, setLoaded] = useState(false);
  const [activeDialog, setActiveDialog] = useState<DialogName>(null);
  const [dataViewOpen, setDataViewOpen] = useState(false);
  const [dataTab, setDataTab] = useState<DataTab>("local");
  const [gameViewOpen, setGameViewOpen] = useState(false);
  const [colRowViewOpen, setColRowViewOpen] = useState(false);
  const [frequencyViewOpen, setFrequencyViewOpen] = useState(false);
  const [distanceViewOpen, setDistanceViewOpen] = useState(false);
  const [refineViewOpen, setRefineViewOpen] = useState(false);
  const [otherViewOpen, setOtherViewOpen] = useState(false);
  const [statsViewOpen, setStatsViewOpen] = useState(false);
  const [sixNumberViewOpen, setSixNumberViewOpen] = useState(false);
  const [numberZoneOpen, setNumberZoneOpen] = useState(false);
  const [numberZoneMode, setNumberZoneMode] = useState(() => localStorage.getItem("londoner.numberZoneMode") || "distance");
  const [statsTab, setStatsTab] = useState("game");
  const [statsGroupTab, setStatsGroupTab] = useState(() => localStorage.getItem("londoner.statsGroupTab") || "colrow");
  const [predictionWindowOpen, setPredictionWindowOpen] = useState(false);
  const [predictionTab, setPredictionTab] = useState(() => localStorage.getItem("londoner.predictionTab") || "overview");
  const [predictionOverviewTab, setPredictionOverviewTab] = useState(() => localStorage.getItem("londoner.predictionOverviewTab") || "repeat");
  const [show124, setShow124] = useState(() => localStorage.getItem("londoner.show124") !== "0");
  const [showQuality124, setShowQuality124] = useState(() => localStorage.getItem("londoner.showQuality124") !== "0");
  const [showHotNumber, setShowHotNumber] = useState(() => localStorage.getItem("londoner.showHotNumber") !== "0");
  const [showCold, setShowCold] = useState(() => localStorage.getItem("londoner.showCold") !== "0");
  const [chase6Filter, setChase6Filter] = useState(() => localStorage.getItem("londoner.chase6Filter") || "全部");
  const [chase3Filter, setChase3Filter] = useState(() => localStorage.getItem("londoner.chase3Filter") || "全部");
  const [showPreferredNumber, setShowPreferredNumber] = useState(() => localStorage.getItem("londoner.showPreferredNumber") !== "0");
  const [showRepeat, setShowRepeat] = useState(() => localStorage.getItem("londoner.showRepeat") !== "0");
  const [repeatFilter, setRepeatFilter] = useState<RepeatTier>(() => normalizeRepeatTier(localStorage.getItem("londoner.repeatFilter")));
  const [entryMode200, setEntryMode200] = useState(() => localStorage.getItem("londoner.entryMode200") !== "0");
  const [showShortRepeat, setShowShortRepeat] = useState(() => localStorage.getItem("londoner.showShortRepeat") !== "0");
  const [colRowTab, setColRowTab] = useState<ColRowTab>("detail");
  const [waveTab, setWaveTab] = useState<"rhythm" | "trend">("rhythm");
  const [waveWindow, setWaveWindow] = useState(() => Number(localStorage.getItem("londoner.waveWindow")) || 13);
  const [refineTab, setRefineTab] = useState<RefineTab>("compare");
  const [otherTab, setOtherTab] = useState<OtherTab>("longs");
  const [otherRoundTab, setOtherRoundTab] = useState<OtherRoundTab>("bet");
  const [otherLongBetCount, setOtherLongBetCount] = useState(4);
  const [otherLongRound, setOtherLongRound] = useState(5);
  const [otherNumberSortField, setOtherNumberSortField] = useState<OtherNumberSortField>("number");
  const [otherNumberSortDirection, setOtherNumberSortDirection] = useState<SortDirection>("desc");
  const fileInputRef = useRef<HTMLInputElement>(null);  const [keyPops, setKeyPops] = useState<Array<{ id: number; value: RouletteNumber }>>([]);
  const keyPopIdRef = useRef(0);
  const [refineRoundStart, setRefineRoundStart] = useState(0);
  const [refineRoundBet, setRefineRoundBet] = useState(1);
  const [refineSortField, setRefineSortField] = useState<RefineSortField>("succeeded");
  const [refineSortDirection, setRefineSortDirection] = useState<SortDirection>("desc");
  const [refineScope, setRefineScope] = useState(() => {
    const stored = Number.parseInt(localStorage.getItem(refineScopeKey) ?? "", 10);
    return classicColRowScopes.includes(stored) ? stored : 72;
  });
  const [otherScope, setOtherScope] = useState(() => {
    const stored = Number.parseInt(localStorage.getItem(otherScopeKey) ?? "", 10);
    return classicColRowScopes.includes(stored) ? stored : 72;
  });
  const [frequencyScopeIndex, setFrequencyScopeIndex] = useState(0);
  const [frequencyDetailKey, setFrequencyDetailKey] = useState<number | null>(null);
  const [distanceDetailKey, setDistanceDetailKey] = useState<number | null>(null);
  const [colRowExploreRows, setColRowExploreRows] = useState<number[]>(() => loadColRowExploreSelections().rows);
  const [colRowExploreRounds, setColRowExploreRounds] = useState<number[]>(() => loadColRowExploreSelections().rounds);
  const [configViewOpen, setConfigViewOpen] = useState(false);
  const [configTab, setConfigTab] = useState<"game" | "other">("game");
  const [rhythmRowsOnly, setRhythmRowsOnly] = useState(() => localStorage.getItem("londoner.rhythmRowsOnly") !== "false");
  const [rhythmMode, setRhythmMode] = useState(() => localStorage.getItem("londoner.rhythmMode") || (rhythmRowsOnly ? "仅行" : "全部"));
  const [coldAdaptiveMode, setColdAdaptiveMode] = useState<string>(() => localStorage.getItem("londoner.coldAdaptiveMode") || "adaptiveRow");
  const coldModeLabel = coldAdaptiveMode === "off" ? "不切换" : coldAdaptiveMode === "adaptive" ? "自适应" : "自适应+默认行";
  const [draftWindowMode, setDraftWindowMode] = useState<WindowMode>(windowMode);
  const [allSavedSessions, setAllSavedSessions] = useState<SavedSession[]>([]);
  const [betsManageOpen, setBetsManageOpen] = useState(false);
  const [dataText, setDataText] = useState("");
  const [sharedUsername, setSharedUsername] = useState("");
  const [sharedPassword, setSharedPassword] = useState("");
  const [sharedConnected, setSharedConnected] = useState(false);
  const [sharedLoginOpen, setSharedLoginOpen] = useState(false);
  const postLoginAction = useRef<((u: string, p: string) => void) | null>(null);
  const [sharedLoading, setSharedLoading] = useState(false);
  const [sharedSessions, setSharedSessions] = useState<SharedSession[]>([]);
  const [selectedSharedSessionIds, setSelectedSharedSessionIds] = useState<string[]>([]);
  const [transferSessions, setTransferSessions] = useState<TransferSession[]>([]);
  const [selectedTransferIds, setSelectedTransferIds] = useState<string[]>([]);
  const [sharedSortField, setSharedSortField] = useState<"name" | "count" | "user" | "time">("time");
  const [sharedSortDirection, setSharedSortDirection] = useState<SortDirection>("desc");
  // 优选号算法逻辑保留用于研究/回测，但当前 UI 暂时隐藏，不对任何用户开放。
  const canUsePreferredNumber = false;
  const canUseQuality124 = sharedConnected && sharedUsername.trim().toLowerCase() === "ww";

  const sortedSharedSessions = useMemo(() => {
    const sorted = [...sharedSessions];
    sorted.sort((a, b) => {
      let va: string | number, vb: string | number;
      switch (sharedSortField) {
        case "name": va = a.name; vb = b.name; break;
        case "count": va = a.numbers.length; vb = b.numbers.length; break;
        case "user": va = a.uploader; vb = b.uploader; break;
        default: va = a.updatedAt; vb = b.updatedAt;
      }
      if (va < vb) return sharedSortDirection === "asc" ? -1 : 1;
      if (va > vb) return sharedSortDirection === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [sharedSessions, sharedSortField, sharedSortDirection]);

  function sortSharedView(field: "name" | "count" | "user" | "time") {
    if (sharedSortField === field) {
      setSharedSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSharedSortField(field);
      setSharedSortDirection(field === "time" ? "desc" : "asc");
    }
  }
  const [toolsOpen, setToolsOpen] = useState(false);
  const [toolsText, setToolsText] = useState("");
  const [toolsKeepBreaks, setToolsKeepBreaks] = useState(false);
  const [importMode, setImportMode] = useState<"current" | "files">("current");
  const [dialogMessage, setDialogMessage] = useState("");
  const [noticeDialog, setNoticeDialog] = useState<NoticeDialog | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null);
  const [promptDialog, setPromptDialog] = useState<PromptDialog | null>(null);
  const [sessionMergeDialog, setSessionMergeDialog] = useState<SessionMergeDialog | null>(null);
  const [transferConnectDialog, setTransferConnectDialog] = useState<ConnectDialog | null>(null);
  const [promptValue, setPromptValue] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editSessionId, setEditSessionId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editUploader, setEditUploader] = useState("");
  const [editTime, setEditTime] = useState("");
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(() => {
    return localStorage.getItem(currentSessionIdKey);
  });
  const [saveName, setSaveName] = useState("");
  const [sessions, setSessions] = useState<SavedSession[]>([]);
  const [allGameBets, setAllGameBets] = useState<number[][]>([]);
  const [selectedBetKeys, setSelectedBetKeys] = useState<string[]>([]);
  const [selectedRounds, setSelectedRounds] = useState<number[]>([]);
  const [selectedAcrModes, setSelectedAcrModes] = useState<string[]>([]);
  const [selectedManageBetKeys, setSelectedManageBetKeys] = useState<string[]>([]);
  const [sessionSortField, setSessionSortField] = useState<DataSortField>("time");
  const [sessionSortDirection, setSessionSortDirection] = useState<SortDirection>("desc");
  const [gameSortField, setGameSortField] = useState<GameSortField>("won");
  const [gameSortDirection, setGameSortDirection] = useState<GameSortDirection>("desc");
  const [gameSettingsRevision, setGameSettingsRevision] = useState(0);

  // 预测引擎初始化
  const coldEngine = useMemo(() => new ColdReversalEngine(), []);
  const predictionTracker = useMemo(() => new PredictionTracker(), []);
  const statScopes = useMemo(
    () => (windowMode === "fibonacci" ? fibonacciStatScopes : classicStatScopes),
    [windowMode],
  );
  const colRowScopes = useMemo(
    () => (windowMode === "fibonacci" ? fibonacciColRowScopes : classicColRowScopes),
    [windowMode],
  );
  const frequencyScopes = useMemo(
    () => (windowMode === "fibonacci" ? fibonacciFrequencyScopes : classicFrequencyScopes),
    [windowMode],
  );

  const predictions = useMemo(() => {
    if (numbers.length < 10) return [];
    return coldEngine.analyze(numbers);
  }, [numbers, coldEngine]);

  const predictionAccuracy = predictionTracker.getFormattedAccuracy();
  const predictionRecordCount = predictionTracker.count;

  const sessionRoi = useMemo(() => computeRoi(numbers), [numbers]);
  // [PERF] 124 (rhythm) temporarily disabled — see AGENTS.md "Hot path perf budget"
  const rhythmRoi = { signals:0, bet:0, win:0, hits:0, roi:0 };
  const rhythmRowsOnlyRoi = { signals:0, bet:0, win:0, hits:0, roi:0 };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rhythmDetailStats: any[] = [];
  const quality124 = useMemo(() => analyzeQuality124(numbers), [numbers]);
  const quality124Signals = quality124.activeSignals;
  const quality124Roi = quality124.totalRoi;
  const quality124From201 = useMemo(() => analyzeQuality124(numbers, REPEAT_INITIAL_ROUNDS), [numbers]);
  const quality124RoiFrom201 = quality124From201.totalRoi;
  const hotNumber = useMemo(() => analyzeHotNumbers(numbers, REPEAT_INITIAL_ROUNDS), [numbers]);
  const hotNumberSignal = hotNumber.activeNumber;
  const hotNumberRoi = hotNumber.totalRoi;
  const hotNumberRoiFrom201 = hotNumber.totalRoiFrom201;
  const coldDetailStats = useMemo(() => computeColdDetailStats(numbers), [numbers]);

  // 长套自适应: 从历史session计算行/组累计ROI
  const currentSessionName = useMemo(() => {
    if (currentSessionId) {
      const found = allSavedSessions.find((s) => s.id === currentSessionId);
      if (found) return found.name;
    }
    return "";
  }, [currentSessionId, allSavedSessions]);

  // 长套自适应: 从同年、当前session之前的历史session计算行/组累计ROI
  const coldAdaptiveCis = useMemo(() => {
    if (coldAdaptiveMode === "off") return [0, 1, 2, 3, 4, 5] as const;
    const currentYear = (() => {
      const m = currentSessionName.match(/(\d{4})/);
      if (m) return m[1];
      return "";
    })();
    if (!currentYear || !currentSessionId) return [0, 1, 2, 3, 4, 5] as const;

    // Sort by dateKey asc + importIndex asc
    const getDateKey = (name: string) => {
      const m = name.match(/(\d{4})[-.]?(\d{2})[-.]?(\d{2})/);
      if (m) return m[1] + m[2] + m[3];
      const m2 = name.match(/(\d{4})(\d{2})(\d{2})/);
      if (m2) return m2[1] + m2[2] + m2[3];
      return "99999999";
    };
    // dateKey asc + importIndex asc (matches backtesting sort)
    const sorted = allSavedSessions
      .filter((s) => !s.name.startsWith("DEBUG-"))
      .filter((s) => (s.name.match(/(\d{4})/) || [""])[0] === currentYear)
      .sort((a, b) => {
        const dk = getDateKey(a.name).localeCompare(getDateKey(b.name));
        if (dk !== 0) return dk;
        const ai = a.importIndex;
        const bi = b.importIndex;
        if (ai !== undefined && bi !== undefined) return ai - bi;
        if (ai !== undefined) return -1;  // with index before without
        if (bi !== undefined) return 1;
        return 0;  // neither has index, keep stable
      });

    // Find current session position
    const curPos = sorted.findIndex((s) => s.id === currentSessionId);
    if (curPos < 0) return [0, 1, 2, 3, 4, 5] as const;

    // Only accumulate sessions BEFORE current
    let rowBet = 0, rowWin = 0, grpBet = 0, grpWin = 0;
    for (let i = 0; i < curPos; i++) {
      const s = sorted[i];
      const r = computeRoi(s.numbers, [3, 4, 5]);
      const g = computeRoi(s.numbers, [0, 1, 2]);
      rowBet += r.bet; rowWin += r.win;
      grpBet += g.bet; grpWin += g.win;
    }

    // Cold start / tie handling
    if (rowBet === 0 && grpBet === 0) {
      return (coldAdaptiveMode === "adaptiveRow" ? [3, 4, 5] : [0, 1, 2, 3, 4, 5]) as readonly number[];
    }
    const rowRoi = rowBet > 0 ? ((rowWin - rowBet) / rowBet) : 0;
    const grpRoi = grpBet > 0 ? ((grpWin - grpBet) / grpBet) : 0;
    if (rowRoi > grpRoi) return [3, 4, 5] as const;
    if (grpRoi > rowRoi) return [0, 1, 2] as const;
    // tie: rowRoi == grpRoi
    return (coldAdaptiveMode === "adaptiveRow" ? [3, 4, 5] : [0, 1, 2, 3, 4, 5]) as readonly number[];
  }, [coldAdaptiveMode, allSavedSessions, currentSessionName, currentSessionId]);
  const coldRowsOnlyRoi = useMemo(() => computeRoi(numbers, [3, 4, 5]), [numbers]);
  const coldGroupsOnlyRoi = useMemo(() => computeRoi(numbers, [0, 1, 2]), [numbers]);
  const coldActiveRoi = useMemo(() => computeRoi(numbers, coldAdaptiveCis), [numbers, coldAdaptiveCis]);

  const waveRhythmData = useMemo(() => {
    const labels = ["一组", "二组", "三组", "1行", "2行", "3行"];
    return labels.map((label, ci) => {
      const rawGaps = extractGaps(numbers.slice(-144), ci);
      const pts: { median: number; q1: number; q3: number }[] = [];
      const W = Math.max(5, Math.min(waveWindow, rawGaps.length));
      for (let i = W; i <= rawGaps.length; i++) {
        const window = rawGaps.slice(i - W, i);
        const sorted = [...window].sort((a, b) => a - b);
        const q1 = sorted[Math.floor(sorted.length * 0.25)];
        const q3 = sorted[Math.floor(sorted.length * 0.75)];
        const iqr = q3 - q1;
        const upper = q3 + 1.5 * iqr;
        const clean = window.filter(g => g <= upper);
        if (clean.length < 3) continue;
        const cs = [...clean].sort((a, b) => a - b);
        pts.push({
          median: cs[Math.floor(cs.length * 0.5)],
          q1: cs[Math.floor(cs.length * 0.25)],
          q3: cs[Math.floor(cs.length * 0.75)],
        });
      }
      return { label, pts, hasData: pts.length >= 1 };
    });
  }, [numbers, waveWindow]);

  const waveHistory = useMemo(() => {
    const labels = ["一组", "二组", "三组", "1行", "2行", "3行"];
    return labels.map((label, ci) => {
      const gaps = extractGaps(numbers, ci);
      const points: number[] = [];
      for (let i = Math.max(8, gaps.length - 60); i <= gaps.length; i += 3) {
        if (i < 8) continue;
        points.push(computePeakSma(gaps.slice(0, i)));
      }
      return { label, points: points.slice(-60), hasData: points.length >= 3 };
    });
  }, [numbers]);

  const waveSnapshot = useMemo(() => {
    const labels = ["一组", "二组", "三组", "1行", "2行", "3行"];
    return labels.map((label, ci) => {
      const gaps = extractGaps(numbers, ci);
      const stats = computePeakStats(gaps);
      if (!stats) return { label, peak: 0, conc: 0, sma: 0, trend: "flat" as const, hasData: false };
      const prevGaps = gaps.slice(0, -3);
      const prevStats = prevGaps.length >= 8 ? computePeakStats(prevGaps) : null;
      const prevSma = prevStats ? prevStats.sma : stats.sma;
      const trend = stats.sma > prevSma + 0.1 ? "up" : stats.sma < prevSma - 0.1 ? "down" : "flat";
      return { label, peak: stats.peak, conc: stats.conc, sma: stats.sma, trend, hasData: true };
    });
  }, [numbers]);

  // 波浪恢复: 每个行组独立追踪波浪状态
  // 直接从号码推算追号状态 — 不存独立state, 永远同步
  const signalDisplay = useMemo(() => {
    const items: Array<{ ci: ColRowIndex; label: string; round: number; betAmt: number; isNew: boolean; currentGap: number; threshold: number; peak: number; chaseLen: number; kind: "cold" | "rhythm" }> = [];

    // 长套信号
    for (const s of predictions) {
      if (!coldAdaptiveCis.includes(s.index)) continue;
      let firstTriggerRound = numbers.length;
      for (let r = numbers.length - 1; r >= 10; r--) {
        const engine = new ColdReversalEngine();
        const sigs = engine.analyze(numbers.slice(0, r));
        if (!sigs.some((ss) => ss.index === s.index)) { firstTriggerRound = r + 1; break; }
      }
      const chaseLen = s.chaseLength;
      const startedAt = firstTriggerRound + 1;
      const done = numbers.length - startedAt + 1;

      if (done <= 0) {
        items.push({ ci: s.index, label: s.label, round: 1, betAmt: 1, isNew: true, currentGap: s.currentGap, threshold: s.threshold, peak: 0, chaseLen: 4, kind: "cold" });
      } else if (done < chaseLen) {
        const nr = done + 1;
        items.push({ ci: s.index, label: s.label, round: nr, betAmt: [1,2,4,8][nr-1]??8, isNew: false, currentGap: s.currentGap, threshold: s.threshold, peak: 0, chaseLen: 4, kind: "cold" });
      }
    }

    // 124信号: 完整回放 active chase 状态
    {
      const labels124 = ["一组","二组","三组","1行","2行","3行"];
      const ls = [-1,-1,-1,-1,-1,-1];
      const ac: { ci: number; sr: number; cl: number; peak: number }[] = [];
      const rec: WaveRecoveryState[] = Array.from({ length: 6 }, () => createRecoveryState());
      const latestSignal: { ci: number; peak: number; cl: number }[] = Array.from({ length: 6 }, () => ({ ci: 0, peak: 0, cl: 0 }));

      for (let r = 0; r < numbers.length; r++) {
        const v = numbers[r];
        const hc = v !== 0 ? getNumberColRows(v) : [];
        const rm: typeof ac = [];
        for (const c of ac) {
          const bi = r - c.sr; if (bi >= c.cl) continue;
          if (hc.includes(c.ci as ColRowIndex)) { /* hit, chase done */ }
          else if (bi + 1 < c.cl) rm.push(c);
          else {
            const gaps = extractGaps(numbers.slice(0, r), c.ci);
            rec[c.ci] = createRecoveryState();
            rec[c.ci].paused = true;
            rec[c.ci].failSma = computePeakSma(gaps);
            rec[c.ci].failRound = r;
            rec[c.ci].phase = 0;
          }
        }
        ac.length = 0; ac.push(...rm);
        for (const ci of hc) ls[ci] = r;
        if (r < 15) continue;
        for (let ci = 0; ci < 6; ci++) {
          if (rec[ci].paused) {
            const gaps = extractGaps(numbers.slice(0, r), ci);
            if (checkWaveRecovery(rec[ci], gaps, r)) rec[ci].paused = false;
          }
        }
        for (let ci = 0; ci < 6; ci++) {
          if (rec[ci].paused) continue;
          const cg = ls[ci] >= 0 ? r - ls[ci] - 1 : r;
          if (cg < 1 || cg > 6) continue;
          if (ac.some((c) => c.ci === ci)) continue;
          const gaps = extractGaps(numbers.slice(0, r), ci);
          const stats = computePeakStats(gaps);
          if (!stats || stats.conc < RHYTHM_MIN_PCT) continue;
          if (cg !== stats.peak) continue;
          ac.push({ ci, sr: r + 1, cl: stats.zoneLen, peak: stats.peak });
          latestSignal[ci] = { ci, peak: stats.peak, cl: stats.zoneLen };
        }
      }

      // Current active chases → signal display
      for (const c of ac) {
        if (rhythmRowsOnly && c.ci < 3) continue;
        const roundsPlayed = Math.max(0, numbers.length - c.sr);
        const nr = roundsPlayed + 1;
        if (nr > c.cl) continue;
        const label = labels124[c.ci];
        const prog = RHYTHM_PROG;
        const sig = latestSignal[c.ci];
        items.push({
          ci: c.ci as ColRowIndex, label, round: nr, betAmt: prog[nr - 1] ?? prog[prog.length - 1],
          isNew: nr === 1, currentGap: 0, threshold: 0, peak: sig.peak, chaseLen: c.cl, kind: "rhythm",
        });
      }
    }

    return items;
  }, [predictions, numbers, rhythmRowsOnly, coldAdaptiveCis]);

  // 追6 分析（信号 + ROI + 波浪特征），单次遍历替代原 computeChaseSixRoi + chaseSixSignals
  const cs = useMemo(() => analyzeChaseSixRolling(numbers, 200), [numbers]);
  const chaseSixSignals = cs.activeSignals;
  const chaseSixRoi = cs.totalRoi;
  const chaseSixG1Roi = cs.group1Roi;
  const chaseSixG2Roi = cs.group2Roi;
  const chaseSixG3Roi = cs.group3Roi;

  // [PERF] 追3 temporarily disabled — see AGENTS.md "Hot path perf budget"
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chaseThreeSignals: any[] = [];
  const chaseThreeRoi = { signals:0, bet:0, win:0, hits:0, roi:0 };
  const chaseThreeG1Roi = chaseThreeRoi;
  const chaseThreeG2Roi = chaseThreeRoi;
  const chaseThreeG3Roi = chaseThreeRoi;
  const c3 = { star1Roi: chaseThreeRoi, star2Roi: chaseThreeRoi };

  const preferredNumber = useMemo(() => analyzePreferredNumber(numbers), [numbers]);
  const preferredNumberSignals = preferredNumber.activeSignals;
  const preferredNumberRoi = preferredNumber.totalRoi;
  const preferredNumberFrom201 = useMemo(() => analyzePreferredNumber(numbers, REPEAT_INITIAL_ROUNDS), [numbers]);
  const preferredNumberRoiFrom201 = preferredNumberFrom201.totalRoi;

  // [PERF] 长重号/短重号 temporarily disabled — see AGENTS.md "Hot path perf budget"
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const repeatSignals: any[] = [];
  const repeatAggressiveRoi = { signals:0, bet:0, win:0, hits:0, roi:0 };
  const repeatCoreRoi = { signals:0, bet:0, win:0, hits:0, roi:0 };
  const repeatFilteredRoi = { signals:0, bet:0, win:0, hits:0, roi:0 };
  const repeatFilteredRoiFrom201 = { signals:0, bet:0, win:0, hits:0, roi:0 };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shortRepeatSignals: any[] = [];
  const shortRepeatRoi = { signals:0, bet:0, win:0, hits:0, roi:0 };
  const shortRepeatRoiFrom201 = { signals:0, bet:0, win:0, hits:0, roi:0 };
  const repeatEnvironmentFilter = { g2Count:0, g3Count:0, passes:false };
  const shortRepeatEnvironmentFilter = { g2Count:0, g3Count:0, passes:false };

  // 综合ROI: 按总览配置汇总所有已启用策略
  const combinedRoi = useMemo(() => {
    let bet = 0, win = 0;
    // [PERF] show124 disabled — see AGENTS.md
    // if (show124) { const r = ...; bet += r.bet; win += r.win; }
    if (canUseQuality124 && showQuality124) {
      bet += quality124Roi.bet; win += quality124Roi.win;
    }
    if (showCold) {
      bet += coldActiveRoi.bet; win += coldActiveRoi.win;
    }
    if (chase6Filter !== "全关") {
      bet += chaseSixRoi.bet; win += chaseSixRoi.win;
    }
    if (chase3Filter !== "全关") {
      bet += chaseThreeRoi.bet; win += chaseThreeRoi.win;
    }
    if (canUsePreferredNumber && showPreferredNumber) {
      bet += preferredNumberRoi.bet; win += preferredNumberRoi.win;
    }
    if (showRepeat) {
      bet += repeatFilteredRoi.bet; win += repeatFilteredRoi.win;
    }
    if (showShortRepeat) {
      bet += shortRepeatRoi.bet; win += shortRepeatRoi.win;
    }
    if (showHotNumber) {
      bet += hotNumberRoi.bet; win += hotNumberRoi.win;
    }
    return { bet, win, net: win - bet };
  }, [show124, rhythmMode, rhythmRowsOnlyRoi, rhythmRoi, canUseQuality124, showQuality124, quality124Roi, showCold, coldActiveRoi, chase6Filter, chaseSixRoi, chase3Filter, chaseThreeRoi, canUsePreferredNumber, showPreferredNumber, preferredNumberRoi, showRepeat, repeatFilteredRoi, showShortRepeat, shortRepeatRoi, showHotNumber, hotNumberRoi]);

  // 从第201轮开始投注的综合ROI，numbers.length <= 200 时为空
  const combinedRoiFrom201 = useMemo(() => {
    if (numbers.length <= 200) return null;
    // [PERF] const rhs = ... computeRhythmRoi ... — see AGENTS.md
    const cold = computeRoi(numbers, coldAdaptiveCis, 200);
    const c6 = analyzeChaseSixRolling(numbers, 200, 200);
    const c3f = { totalRoi: { signals:0, bet:0, win:0, hits:0, roi:0 } }; // [PERF] analyzeChaseThree numbers.slice(200) — see AGENTS.md
    let bet = 0, win = 0;
    // [PERF] show124 disabled
    // if (show124) { bet += rhs.bet; win += rhs.win; }
    if (canUseQuality124 && showQuality124) { bet += quality124RoiFrom201.bet; win += quality124RoiFrom201.win; }
    if (showCold) { bet += cold.bet; win += cold.win; }
    if (chase6Filter !== "全关") { bet += c6.totalRoi.bet; win += c6.totalRoi.win; }
    if (chase3Filter !== "全关") { bet += c3f.totalRoi.bet; win += c3f.totalRoi.win; }
    if (canUsePreferredNumber && showPreferredNumber) { bet += preferredNumberRoiFrom201.bet; win += preferredNumberRoiFrom201.win; }
    if (showRepeat) {
      bet += repeatFilteredRoiFrom201.bet; win += repeatFilteredRoiFrom201.win;
    }
    if (showShortRepeat) { bet += shortRepeatRoiFrom201.bet; win += shortRepeatRoiFrom201.win; }
    if (showHotNumber) { bet += hotNumberRoiFrom201.bet; win += hotNumberRoiFrom201.win; }
    return { bet, win, net: win - bet };
  }, [numbers, show124, rhythmMode, canUseQuality124, showQuality124, quality124RoiFrom201, showCold, coldAdaptiveCis, chase6Filter, chase3Filter, canUsePreferredNumber, showPreferredNumber, preferredNumberRoiFrom201, showRepeat, repeatFilteredRoiFrom201, showShortRepeat, shortRepeatRoiFrom201, showHotNumber, hotNumberRoiFrom201]);

  const effectiveStatsScope = statsScope < 0 ? numbers.length : statsScope;
  const effectiveColRowScope = colRowScope < 0 ? numbers.length : colRowScope;
  const effectiveOtherScope = otherScope < 0 ? numbers.length : otherScope;
  const stats = useMemo(
    () => calculateSnapshotStats(numbers, effectiveStatsScope),
    [effectiveStatsScope, numbers],
  );
  const colRowDistances = useMemo(() => calculateColRowDistances(numbers), [numbers]);
  const topColRows = useMemo(() => {
    if (!separateColRows) return colRowDistances;

    return [
      ...colRowDistances.filter((item) => item.index < 3),
      ...colRowDistances.filter((item) => item.index >= 3),
    ];
  }, [colRowDistances, separateColRows]);
  const columnStats = useMemo(
    () => filterColumnDistances(calculateColumnDistances(numbers), columnMinimum),
    [columnMinimum, numbers],
  );
  const finishedLongs = useMemo(() => calculateFinishedLongs(numbers), [numbers]);
  const queueItems = useMemo(() => numbers.slice(-105).reverse(), [numbers]);
  const latestNumber = numbers.length > 0 ? numbers[numbers.length - 1] : null;
  const sixNumberSnapshot = useMemo(() => {
    const getMissDistanceBefore = (wi: number, startIndex: number) => {
      let distance = 0;
      for (let index = startIndex; index >= 0; index -= 1) {
        const value = numbers[index];
        if (isInChaseSixWindow(wi, value)) break;
        distance += 1;
      }
      return distance;
    };
    return Array.from({ length: 11 }, (_, wi) => {
      const highlighted = latestNumber !== null && isInChaseSixWindow(wi, latestNumber);
      return {
        distance: getMissDistanceBefore(wi, numbers.length - 1),
        highlighted,
        label: `${chaseSixWindowStart(wi)}-${chaseSixWindowEnd(wi)}`,
        previousDistance: highlighted ? getMissDistanceBefore(wi, numbers.length - 2) : null,
        wi,
      };
    });
  }, [latestNumber, numbers]);
  const threeNumberSnapshot = useMemo(() => {
    const latestStreet = latestNumber !== null ? streetOf(latestNumber) : -1;
    const getMissDistanceBefore = (wi: number, startIndex: number) => {
      let distance = 0;
      for (let index = startIndex; index >= 0; index -= 1) {
        if (streetOf(numbers[index]) === wi) break;
        distance += 1;
      }
      return distance;
    };
    return Array.from({ length: 12 }, (_, wi) => {
      const highlighted = latestStreet === wi;
      return {
        distance: getMissDistanceBefore(wi, numbers.length - 1),
        highlighted,
        label: `${chaseThreeStreetStart(wi)}-${chaseThreeStreetEnd(wi)}`,
        previousDistance: highlighted ? getMissDistanceBefore(wi, numbers.length - 2) : null,
        wi,
      };
    });
  }, [latestNumber, numbers]);
  const groupBlockSnapshot = useMemo(() => {
    const groupOfNumber = (value: number) => value === 0 ? -1 : Math.floor((value - 1) / 12);
    const latestGroup = latestNumber !== null ? groupOfNumber(latestNumber) : -1;
    const getMissDistanceBefore = (gi: number, startIndex: number) => {
      let distance = 0;
      for (let index = startIndex; index >= 0; index -= 1) {
        if (groupOfNumber(numbers[index]) === gi) break;
        distance += 1;
      }
      return distance;
    };
    return Array.from({ length: 3 }, (_, gi) => {
      const highlighted = latestGroup === gi;
      const start = gi * 12 + 1;
      return {
        distance: getMissDistanceBefore(gi, numbers.length - 1),
        highlighted,
        label: `${start}-${start + 11}`,
        previousDistance: highlighted ? getMissDistanceBefore(gi, numbers.length - 2) : null,
        gi,
      };
    });
  }, [latestNumber, numbers]);
  const rowBlockSnapshot = useMemo(() => {
    const latestRow = latestNumber !== null ? getRowIndex(latestNumber) : null;
    const getMissDistanceBefore = (ri: number, startIndex: number) => {
      let distance = 0;
      for (let index = startIndex; index >= 0; index -= 1) {
        if (getRowIndex(numbers[index]) === ri) break;
        distance += 1;
      }
      return distance;
    };
    return [2, 1, 0].map((ri) => {
      const highlighted = latestRow === ri;
      return {
        distance: getMissDistanceBefore(ri, numbers.length - 1),
        highlighted,
        label: `${ri + 1}行`,
        previousDistance: highlighted ? getMissDistanceBefore(ri, numbers.length - 2) : null,
        ri,
      };
    });
  }, [latestNumber, numbers]);
  const numberZoneData = useMemo(() => {
    const ONE_CIRCLE = 37;
    const circles: Record<string, number> = {
      "1": ONE_CIRCLE,
      "2": ONE_CIRCLE * 2,
      "3": ONE_CIRCLE * 3,
      "4": ONE_CIRCLE * 4,
      "5": ONE_CIRCLE * 5,
      "6": ONE_CIRCLE * 6,
    };

    const data: Record<number, { value: number; isLatest: boolean; prevDistance: number | null }> = {};

    for (let n = 0; n <= 36; n++) {
      let value: number;
      let prevDistance: number | null = null;

      if (numberZoneMode === "distance") {
        let dist = 0;
        let foundIdx = -1;
        for (let i = numbers.length - 1; i >= 0; i--) {
          if (numbers[i] === n) { foundIdx = i; break; }
          dist++;
        }
        value = dist;
        // For latest number: compute previous distance before this appearance
        if (n === latestNumber && foundIdx >= 0) {
          let prevDist = 0;
          for (let i = foundIdx - 1; i >= 0; i--) {
            if (numbers[i] === n) break;
            prevDist++;
          }
          prevDistance = prevDist;
        }
      } else if (numberZoneMode === "all") {
        value = numbers.filter((x) => x === n).length;
      } else {
        const windowSize = circles[numberZoneMode] || ONE_CIRCLE;
        const start = Math.max(0, numbers.length - windowSize);
        value = 0;
        for (let i = start; i < numbers.length; i++) {
          if (numbers[i] === n) value++;
        }
      }

      data[n] = { value, isLatest: latestNumber === n, prevDistance };
    }
    return data;
  }, [numbers, latestNumber, numberZoneMode]);

  // Compute trends FIRST (before hot/cold, used for tie-breaking)
  const numberZoneTrends = useMemo(() => {
    const ONE_CIRCLE = 37;
    const trends: Record<number, "up" | "down" | null> = {};

    for (let n = 0; n <= 36; n++) {
      if (numberZoneMode === "distance") {
        let currDist = 0;
        for (let i = numbers.length - 1; i >= 0; i--) {
          if (numbers[i] === n) break;
          currDist++;
        }
        const pastEnd = Math.max(0, numbers.length - 19);
        let pastDist = 0;
        for (let i = pastEnd; i >= 0; i--) {
          if (numbers[i] === n) break;
          pastDist++;
        }
        if (currDist < pastDist - 3) trends[n] = "up";
        else if (currDist > pastDist + 3) trends[n] = "down";
        else trends[n] = null;
      } else if (numberZoneMode === "all") {
        trends[n] = null;
      } else {
        const circles: Record<string, number> = { "1": ONE_CIRCLE, "2": ONE_CIRCLE * 2, "3": ONE_CIRCLE * 3, "5": ONE_CIRCLE * 5 };
        const ws = circles[numberZoneMode] || ONE_CIRCLE;
        const start = Math.max(0, numbers.length - ws);
        const isShort = ws <= 74; // 1圈、2圈用半劈算法

        if (isShort) {
          // Short window: split in half, compare second half vs first half
          const mid = start + Math.floor(ws / 2);
          let firstHalf = 0, secondHalf = 0;
          for (let i = start; i < mid; i++) { if (numbers[i] === n) firstHalf++; }
          for (let i = mid; i < numbers.length; i++) { if (numbers[i] === n) secondHalf++; }
          const diff = secondHalf - firstHalf;
          if (diff >= 2) {
            trends[n] = "up";
          } else if (diff <= -2) {
            trends[n] = "down";
          } else {
            trends[n] = null;
          }
        } else {
          // Long window: compare recent 1/3 vs earlier 2/3 by rate
          const recentLen = Math.min(Math.floor(ws / 3), 40);
          const recentStart = numbers.length - recentLen;
          let recentCount = 0, earlierCount = 0;
          for (let i = recentStart; i < numbers.length; i++) { if (numbers[i] === n) recentCount++; }
          for (let i = start; i < recentStart; i++) { if (numbers[i] === n) earlierCount++; }
          const recentRate = recentCount / recentLen;
          const earlierRate = earlierCount / Math.max(1, ws - recentLen);
          const ratio = earlierRate > 0 ? recentRate / earlierRate : (recentRate > 0 ? 999 : 1);
          if (ratio >= 1.5 && recentCount >= 2) {
            trends[n] = "up";
          } else if (ratio <= 0.5 && earlierCount >= 2) {
            trends[n] = "down";
          } else {
            trends[n] = null;
          }
        }
      }
    }
    return trends;
  }, [numbers, numberZoneMode]);

  const numberZoneHotCold = useMemo(() => {
    const entries = Object.entries(numberZoneData)
      .map(([num, d]) => ({ num: Number(num), value: d.value }))
      .filter((e) => e.num !== 0);

    const asc = numberZoneMode === "distance";
    const sorted = [...entries].sort((a, b) => asc ? a.value - b.value : b.value - a.value);

    const hotNums = new Set<number>();
    const coldNums = new Set<number>();

    // Hot: pick top 5. If ties at position 5, prefer trending-up numbers.
    const hotPicked: Array<{ num: number; value: number; trend: string | null }> = [];
    for (let i = 0; i < sorted.length; i++) {
      const e = sorted[i];
      if (hotPicked.length < 5) {
        hotPicked.push({ ...e, trend: numberZoneTrends[e.num] });
      } else if (e.value === hotPicked[4].value) {
        // Tie at cutoff — only add if trending up AND we can swap out a non-trending-up
        const trend = numberZoneTrends[e.num];
        if (trend === "up") {
          // Check if any of the tied picks at cutoff are NOT trending up
          const tiedAtCutoff = hotPicked.filter(p => p.value === hotPicked[4].value);
          const nonUp = tiedAtCutoff.find(p => p.trend !== "up");
          if (nonUp) {
            hotPicked.splice(hotPicked.indexOf(nonUp), 1);
            hotPicked.push({ ...e, trend });
          }
        }
      } else {
        break;
      }
    }
    for (const p of hotPicked) hotNums.add(p.num);

    // Cold: pick bottom 5. If ties at position 5, exclude trending-up numbers.
    const coldPicked: Array<{ num: number; value: number; trend: string | null }> = [];
    for (let i = sorted.length - 1; i >= 0; i--) {
      const e = sorted[i];
      if (coldPicked.length < 5) {
        coldPicked.push({ ...e, trend: numberZoneTrends[e.num] });
      } else if (e.value === coldPicked[4].value) {
        const trend = numberZoneTrends[e.num];
        // Only add if NOT trending up (keep only the truly cold)
        if (trend !== "up") {
          const tiedAtCutoff = coldPicked.filter(p => p.value === coldPicked[4].value);
          const upOne = tiedAtCutoff.find(p => p.trend === "up");
          if (upOne) {
            coldPicked.splice(coldPicked.indexOf(upOne), 1);
            coldPicked.push({ ...e, trend });
          }
        }
      } else {
        break;
      }
    }
    for (const p of coldPicked) coldNums.add(p.num);

    return { hot: hotNums, cold: coldNums };
  }, [numberZoneData, numberZoneMode, numberZoneTrends]);

  const renderGroupBlockDistance = (item: { distance: number; highlighted: boolean; previousDistance: number | null }) =>
    item.highlighted && item.previousDistance !== null ? (
      <span className="group-block-distance">({item.previousDistance})</span>
    ) : (
      <span className="group-block-distance">{item.distance}</span>
    );
  const hasUnsavedChanges = useMemo(
    () => numbers.length > 0 && !areSameNumbers(numbers, lastSavedNumbers),
    [lastSavedNumbers, numbers],
  );

  useEffect(() => {
    storage.loadCurrent().then(async (storedNumbers) => {
      const loadedNumbers = storedNumbers.filter(isRouletteNumber);
      let savedNumbers = loadedNumbers;
      if (currentSessionId) {
        const openedSession = (await storage.listSessions()).find((session) => session.id === currentSessionId);
        if (openedSession) {
          savedNumbers = openedSession.numbers.filter(isRouletteNumber);
        }
      }
      setNumbers(loadedNumbers);
      setLastSavedNumbers(savedNumbers);
      setLoaded(true);
    });
    storage.listSessions().then(setAllSavedSessions);
  }, []);

  useEffect(() => {
    if (loaded && numbers.length >= 10) {
      predictionTracker.backfill(coldEngine, numbers);
    }
  }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (loaded) {
      void storage.saveCurrent(numbers);
    }
  }, [loaded, numbers]);

  useEffect(() => {
    localStorage.setItem(keyboardModeKey, keyboardMode);
  }, [keyboardMode]);

  useEffect(() => {
    localStorage.setItem(windowModeKey, windowMode);
    setStatsScope((current) => (statScopes.includes(current) ? current : statScopes[0]));
    setColRowScope((current) => (colRowScopes.includes(current) ? current : colRowScopes[0]));
    setRefineScope((current) => (colRowScopes.includes(current) ? current : colRowScopes[0]));
    setOtherScope((current) => (colRowScopes.includes(current) ? current : colRowScopes[0]));
    setFrequencyScopeIndex((current) => (current < frequencyScopes.length ? current : 0));
  }, [colRowScopes, frequencyScopes.length, statScopes, windowMode]);

  useEffect(() => {
    localStorage.setItem(colRowScopeKey, String(colRowScope));
  }, [colRowScope]);

  useEffect(() => {
    localStorage.setItem(refineScopeKey, String(refineScope));
  }, [refineScope]);

  useEffect(() => {
    localStorage.setItem(otherScopeKey, String(otherScope));
  }, [otherScope]);

  useEffect(() => {
    if (currentSessionId) {
      localStorage.setItem(currentSessionIdKey, currentSessionId);
    } else {
      localStorage.removeItem(currentSessionIdKey);
    }
  }, [currentSessionId]);

  useEffect(() => {
    if (!canUsePreferredNumber && predictionTab === "preferredNumber") {
      setPredictionTab("overview");
      localStorage.setItem("londoner.predictionTab", "overview");
    }
  }, [canUsePreferredNumber, predictionTab]);

  useEffect(() => {
    if (!canUseQuality124 && predictionTab === "quality124") {
      setPredictionTab("overview");
      localStorage.setItem("londoner.predictionTab", "overview");
    }
  }, [canUseQuality124, predictionTab]);

  function getPredictionRank(predictions: ColdSignal[], item: ColdSignal): number {
    const sorted = [...predictions].sort((a, b) => b.excess - a.excess);
    const index = sorted.findIndex((p) => p.index === item.index);
    return Math.min(3, index);
  }

  let audioCtx: AudioContext | null = null;
  function playKeySound() {
    if (!audioCtx) audioCtx = new AudioContext();
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1800, now);
    osc.frequency.exponentialRampToValueAtTime(500, now + 0.022);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.028);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.028);
  }

  function addNumber(value: RouletteNumber) {
    playKeySound();
    const next = [...numbers, value];

    // Force key pop to render immediately before heavy computation
    const popId = keyPopIdRef.current++;
    flushSync(() => {
      setKeyPops(prev => [...prev, { id: popId, value }]);
    });

    if (predictions.length > 0 && value !== 0) {
      predictionTracker.record(predictions, value);
    }
    setNumbers(next);
    setRedoNumbers([]);
  }

  function undo() {
    const removed = numbers.at(-1);
    if (removed === undefined) return;

    setNumbers(numbers.slice(0, -1));
    setRedoNumbers([...redoNumbers, removed]);
  }
  function redo() {
    const restored = redoNumbers.at(-1);
    if (restored === undefined) return;

    setNumbers([...numbers, restored]);
    setRedoNumbers(redoNumbers.slice(0, -1));
  }
  function undoAll() {
    if (numbers.length === 0) return;
    setConfirmDialog({
      title: "长退",
      message: `确定要退回全部 ${numbers.length} 个数字吗？`,
      confirmText: "确定退回",
      onConfirm: () => {
        setRedoNumbers([...redoNumbers, ...numbers.slice().reverse()]);
        setNumbers([]);
      },
    });
  }
  function redoAll() {
    if (redoNumbers.length === 0) return;
    setConfirmDialog({
      title: "长进",
      message: `确定要恢复全部 ${redoNumbers.length} 个数字吗？`,
      confirmText: "确定恢复",
      onConfirm: () => {
        setNumbers([...numbers, ...redoNumbers.slice().reverse()]);
        setRedoNumbers([]);
      },
    });
  }
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function startLongPress(action: () => void) {
    longPressTimer.current = setTimeout(action, 600);
  }
  function cancelLongPress() {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  }

  async function refreshSessions() {
    const list = await storage.listSessions();
    setSessions(list);
    setAllSavedSessions(list);
  }

  async function refreshSharedSessions(username = sharedUsername, password = sharedPassword) {
    const list = await listSharedSessions(username.trim(), password);
    setSharedSessions(list);
    setSelectedSharedSessionIds((current) => current.filter((id) => list.some((s) => s.id === id)));
  }

  async function refreshTransferSessions(username = sharedUsername, password = sharedPassword) {
    const list = await listTransferSessions(username.trim(), password);
    list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    setTransferSessions(list);
    setSelectedTransferIds((current) => current.filter((id) => list.some((item) => item.id === id)));
  }

  function clearCurrentSession() {
    setCurrentSessionId(null);
  }

  function defaultSessionName() {
    const now = new Date();
    const pad = (value: number) => value.toString().padStart(2, "0");
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(
      now.getMinutes(),
    )}`;
  }

  function openSaveDialog() {
    if (numbers.length === 0) {
      setNoticeDialog({ title: "保存", message: "当前没有可保存的数据。" });
      return;
    }

    if (currentSessionId) {
      void saveCurrentSession();
      return;
    }

    setSaveName(defaultSessionName());
    setDialogMessage("");
    setActiveDialog("save");
  }

  function openSaveAsDialog() {
    if (numbers.length === 0) {
      setNoticeDialog({ title: "另存", message: "当前没有可保存的数据。" });
      return;
    }

    setSaveName(defaultSessionName());
    setDialogMessage("");
    setActiveDialog("save");
  }

  async function saveCurrentSession() {
    const currentSessions = await storage.listSessions();
    const currentSession = currentSessions.find((session) => session.id === currentSessionId);

    if (!currentSession) {
      clearCurrentSession();
      setSaveName(defaultSessionName());
      setDialogMessage("当前打开的数据不存在，请输入名称另存。");
      setActiveDialog("save");
      return;
    }

    await storage.saveSession({
      ...currentSession,
      numbers,
      updatedAt: new Date().toISOString(),
      importIndex: currentSession.importIndex,
    });
    await refreshSessions();
    setLastSavedNumbers(numbers);
    setNoticeDialog({ title: "保存成功", message: `保存"${currentSession.name}"成功。` });
  }

  async function persistSession(name: string, existingId?: string) {
    const id = existingId ?? crypto.randomUUID?.() ?? `${Date.now()}`;
    const existing = existingId ? (await storage.listSessions()).find((s) => s.id === existingId) : undefined;
    await storage.saveSession({
      id,
      name,
      numbers,
      updatedAt: new Date().toISOString(),
      importIndex: existing?.importIndex,
    });
    await refreshSessions();
    setCurrentSessionId(id);
    setLastSavedNumbers(numbers);
    setActiveDialog(null);
    setNoticeDialog({ title: "保存成功", message: `保存"${name}"成功。` });
  }

  async function saveSession() {
    const name = saveName.trim();
    if (!name) {
      setDialogMessage("请输入名称。");
      return;
    }

    const currentSessions = await storage.listSessions();
    const nameError = validateSessionName(name, currentSessions);
    if (nameError && nameError !== "该名称已经存在，请重新输入") {
      setDialogMessage(nameError);
      return;
    }

    const existingSession = currentSessions.find((session) => session.name.toLowerCase() === name.toLowerCase());
    if (existingSession) {
      setConfirmDialog({
        title: "请确认",
        message: "该名称的数据已存在，是否需要覆盖？",
        confirmText: "覆盖",
        onConfirm: () => persistSession(name, existingSession.id),
      });
      return;
    }

    await persistSession(name);
  }

  async function openDataDialog() {
    setDialogMessage("");
    await refreshSessions();
    setSelectedSessionIds([]);
    setDataTab("local");
    setDataViewOpen(true);
    if (!sharedConnected) void tryAutoLogin().then((creds) => { if (creds) setSharedConnected(true); });
  }

  function openPendingFeature(name: string) {
    if (name === "细化") {
      openRefineView();
      return;
    }

    if (name === "其它") {
      openOtherView();
      return;
    }

    setNoticeDialog({ title: name, message: `${name}功能下一步搬迁。` });
  }

  async function exportCurrentData() {
    const text = formatNumbers(numbers);
    if (!text) {
      setNoticeDialog({ title: "导出数据", message: "当前没有可导出的数据。" });
      return;
    }

    const copied = await copyTextToClipboard(text);
    setNoticeDialog({
      title: "导出数据",
      message: copied ? "数据已复制到剪贴板。" : "数据复制失败，请检查浏览器剪贴板权限。",
    });
  }

  function openImportDialog() {
    setImportMode("current");
    setDataText("");
    setDialogMessage("");
    setActiveDialog("import");
  }

  function openConnectDialog() {
    setDataText("");
    setDialogMessage("");
    setActiveDialog("connect");
  }

  function openToolsDialog() {
    setToolsText("");
    setToolsKeepBreaks(false);
    setToolsOpen(true);
  }

  function normalizeToolsText() {
    const lines = toolsKeepBreaks ? toolsText.split(/\r?\n/) : [toolsText];
    const normalizedLines: string[] = [];
    const invalidTokens: string[] = [];

    for (const line of lines) {
      const parsed = parseNumbersText(line);
      invalidTokens.push(...parsed.invalidTokens);
      const text = formatNumbers(parsed.numbers);
      if (toolsKeepBreaks || text) {
        normalizedLines.push(text);
      }
    }

    if (invalidTokens.length > 0) {
      setNoticeDialog({
        title: "整理数据文本",
        message: `存在无效数字：${invalidTokens.slice(0, 5).join("、")}`,
      });
      return;
    }

    setToolsText(toolsKeepBreaks ? normalizedLines.join("\n") : normalizedLines.join(","));
  }

  function reverseToolsText() {
    const parsed = parseNumbersText(toolsText);
    if (parsed.invalidTokens.length > 0) {
      setNoticeDialog({
        title: "整理数据文本",
        message: `存在无效数字：${parsed.invalidTokens.slice(0, 5).join("、")}`,
      });
      return;
    }

    setToolsText(formatNumbers([...parsed.numbers].reverse()));
  }

  async function copyToolsText() {
    const copied = await copyTextToClipboard(toolsText);
    setNoticeDialog({
      title: "整理数据文本",
      message: copied ? "已复制到剪贴板。" : "数据复制失败，请检查浏览器剪贴板权限。",
    });
  }

  function importFromFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        let parsed = JSON.parse(text);
        // Handle both array and object formats
        const items = Array.isArray(parsed) ? parsed : Object.values(parsed);
        if (!Array.isArray(items) || items.length === 0) {
          setDialogMessage("文件格式不正确，需要 JSON 数组。");
          return;
        }
        const imported: SavedSession[] = [];
        for (const item of items) {
          // Try multiple field names for numbers
          const numsStr = (item as any).Numbers ?? (item as any).numbers ?? (item as any).Nums ?? "";
          const nums = typeof numsStr === "string"
            ? parseNumbersText(numsStr)
            : parseNumbersText(Array.isArray(numsStr) ? numsStr.join(",") : "");
          if (nums.numbers.length === 0) continue;
          const name = String((item as any).Name ?? (item as any).name ?? `导入-${imported.length + 1}`);
          const tms = (item as any).tms ?? (item as any).SaveTime ?? undefined;
          imported.push({
            id: (item as any).id ?? crypto.randomUUID?.() ?? `${Date.now()}-${imported.length}`,
            name,
            numbers: nums.numbers,
            updatedAt: tms ? new Date(tms).toISOString() : new Date().toISOString(),
            importIndex: (item as any).ImportIndex ?? imported.length,
            sharedUploader: (item as any).SharedUploader ?? (item as any).sharedUploader ?? "",
          });
        }
        if (imported.length === 0) {
          setDialogMessage("文件中没有识别到有效数据。");
          return;
        }
        // Save all at once to avoid localStorage race conditions
        storage.listSessions().then((existing) => {
          const existingIds = new Set(existing.map((s) => s.id));
          const merged = [...existing, ...imported.filter((s) => !existingIds.has(s.id))];
          // Write directly to localStorage
          localStorage.setItem("londoner.sessions", JSON.stringify(merged));
          refreshSessions().then(() => {
            setActiveDialog(null);
            setNoticeDialog({ title: "文件导入", message: `已导入 ${imported.length} 条数据。` });
          });
        }).catch((err) => {
          setDialogMessage(`保存失败：${err instanceof Error ? err.message : String(err)}`);
        });
      } catch {
        setDialogMessage("文件解析失败，请检查是否为有效的 JSON 文件。");
      }
    };
    reader.readAsText(file);
  }

  function importData() {
    const parsed = parseNumbersText(dataText);
    if (parsed.invalidTokens.length > 0) {
      setDialogMessage(`存在无效数字：${parsed.invalidTokens.slice(0, 5).join("、")}`);
      return;
    }

    if (parsed.numbers.length === 0) {
      setDialogMessage("没有识别到有效数字。");
      return;
    }

    setNumbers(parsed.numbers);
    setRedoNumbers([]);
    setLastSavedNumbers([]);
    clearCurrentSession();
    setActiveDialog(null);
    setNoticeDialog({ title: "导入数据", message: `已导入 ${parsed.numbers.length} 个数字。` });
  }

  async function tryAutoLogin(): Promise<{ u: string; p: string } | null> {
    try {
      const raw = localStorage.getItem(savedLoginKey);
      if (!raw) return null;
      const creds = JSON.parse(raw) as { u: string; p: string };
      const allowed = await checkSharedAccess(creds.u, creds.p);
      if (!allowed) {
        localStorage.removeItem(savedLoginKey);
        return null;
      }
      setSharedUsername(creds.u);
      setSharedPassword(creds.p);
      setSharedConnected(true);
      await refreshSharedSessions(creds.u, creds.p);
      return creds;
    } catch {
      return null;
    }
  }

  async function connectSharedData() {
    const username = sharedUsername.trim();
    if (!username || !sharedPassword) {
      setNoticeDialog({ title: "共享数据", message: "请先输入用户名和密码。" });
      return;
    }

    setSharedLoading(true);
    try {
      const allowed = await checkSharedAccess(username, sharedPassword);
      if (!allowed) {
        setSharedConnected(false);
        localStorage.removeItem(savedLoginKey);
        setNoticeDialog({
          title: "共享数据",
          message: formatSharedLoginError("用户名或密码不正确。", "checkSharedAccess returned false"),
        });
        return;
      }
      localStorage.setItem(savedLoginKey, JSON.stringify({ u: username, p: sharedPassword }));
      setSharedConnected(true);
      await refreshSharedSessions(username, sharedPassword);
      const action = postLoginAction.current;
      postLoginAction.current = null;
      setSharedLoginOpen(false);
      action?.(username, sharedPassword);
    } catch (error) {
      setSharedConnected(false);
      localStorage.removeItem(savedLoginKey);
      setNoticeDialog({ title: "共享数据", message: formatSharedLoginError(formatSharedError(error), getRawErrorMessage(error)) });
    } finally {
      setSharedLoading(false);
    }
  }

  function ensureSharedConnected(action: (u: string, p: string) => void) {
    if (sharedConnected) { action(sharedUsername.trim(), sharedPassword); return; }
    postLoginAction.current = action;
    tryAutoLogin().then((creds) => {
      if (creds) {
        const act = postLoginAction.current;
        postLoginAction.current = null;
        act?.(creds.u, creds.p);
      } else {
        setSharedLoginOpen(true);
      }
    });
  }

  async function reloadSharedData(username?: string, password?: string) {
    const u = (username ?? sharedUsername).trim();
    const p = password ?? sharedPassword;
    if (!u || !p) return;
    setSharedLoading(true);
    try {
      await refreshSharedSessions(u, p);
    } catch (error) {
      setNoticeDialog({ title: "共享数据", message: formatSharedError(error) });
    } finally {
      setSharedLoading(false);
    }
  }

  async function reloadTransferData(username?: string, password?: string) {
    const u = (username ?? sharedUsername).trim();
    const p = password ?? sharedPassword;
    if (!u || !p) return;
    setSharedLoading(true);
    try {
      await refreshTransferSessions(u, p);
    } catch (error) {
      setNoticeDialog({ title: "传输数据", message: formatSharedError(error) });
    } finally {
      setSharedLoading(false);
    }
  }

  async function uploadCurrentTransfer(username?: string, password?: string) {
    if (numbers.length === 0) {
      setNoticeDialog({ title: "传输数据", message: "当前没有可传输的数据。" });
      return;
    }

    const u = (username ?? sharedUsername).trim();
    const p = password ?? sharedPassword;
    if (!u || !p) return;

    setSharedLoading(true);
    try {
      await uploadTransferSession({ numbers, password: p, username: u });
      await refreshTransferSessions(u, p);
      setNoticeDialog({ title: "传输数据", message: "当前数据已传输。" });
    } catch (error) {
      setNoticeDialog({ title: "传输数据", message: formatSharedError(error) });
    } finally {
      setSharedLoading(false);
    }
  }

  function connectInputData() {
    const parsed = parseNumbersText(dataText);
    if (parsed.invalidTokens.length > 0) {
      setDialogMessage(`存在无效数字：${parsed.invalidTokens.slice(0, 5).join("、")}`);
      return;
    }
    const incoming: ConnectIncomingData = {
      label: "输入数据",
      numbers: parsed.numbers,
    };
    if (incoming.numbers.length === 0) {
      setDialogMessage("没有识别到有效数字。");
      return;
    }
    if (numbers.length === 0) {
      setNumbers(incoming.numbers);
      setRedoNumbers([]);
      setLastSavedNumbers([]);
      clearCurrentSession();
      setActiveDialog(null);
      setNoticeDialog({ title: "接上数据", message: `已接上（${incoming.numbers.length} 个数字）` });
      return;
    }

    const result = analyzeNumberMergeV2(numbers, incoming.numbers);
    if (result.relationship === "none" || result.relationship === "insufficient") {
      setDialogMessage(`当前数据与输入数据没有找到足够可靠的尾部重叠关系，不能接上。${result.description}`);
      return;
    }
    if (result.relationship === "ambiguous") {
      setDialogMessage(`当前数据与输入数据存在 ${result.alternatives?.length ?? "多个"} 个同等可能的接法，无法确定正确顺序。本次不进行接上。`);
      return;
    }

    const relationship = result.tolerantAlignment?.relationship ?? (result.relationship === "conflict"
      ? result.alignment?.relationship
      : result.relationship);
    if (relationship === "b-then-a") {
      setDialogMessage("输入数据位于当前数据之前，不是当前局后续数据。本次没有修改。");
      return;
    }
    if (relationship === "identical" || relationship === "a-contains-b") {
      setDialogMessage(`输入数据已包含在当前数据中，没有新增号码。当前 ${numbers.length} 个，输入 ${incoming.numbers.length} 个。`);
      return;
    }
    if (result.safeToMerge) {
      applyTransferConnectNumbers(result.merged, incoming, result);
      return;
    }
    if (result.tolerantAlignment) {
      if (result.tolerantAlignment.relationship === "b-then-a") {
        setDialogMessage("输入数据位于当前数据之前，不是当前局后续数据。本次没有修改。");
        return;
      }
      const preview = buildNumberMergeV2TolerantUnion(result.tolerantAlignment, "a");
      if (preview.length <= numbers.length) {
        setDialogMessage("输入数据没有提供当前局后续号码，只发现重叠问题。本次没有修改。");
        return;
      }
      setActiveDialog(null);
      setTransferConnectDialog({
        conflictChoice: "a",
        incoming,
        issueChoices: result.tolerantAlignment.issues.map(() => "a"),
        result,
      });
      return;
    }
    if (result.alignment) {
      const preview = buildNumberMergeV2Union(numbers, incoming.numbers, result.alignment, "a");
      if (preview.length <= numbers.length) {
        setDialogMessage("输入数据没有提供当前局后续号码，只发现重叠冲突。本次没有修改。");
        return;
      }
      setActiveDialog(null);
      setTransferConnectDialog({
        conflictChoice: "a",
        incoming,
        issueChoices: [],
        result,
      });
      return;
    }
    setDialogMessage("无法构造安全的接上结果，本次没有修改数据。");
  }

  function applyTransferConnectNumbers(
    merged: readonly number[] | undefined,
    incoming: ConnectIncomingData,
    result?: NumberMergeV2Result,
  ) {
    if (!merged) {
      setNoticeDialog({ title: "接上失败", message: "无法构造安全的接上结果，本次没有修改数据。" });
      return;
    }
    const mergedNumbers = merged.filter(isRouletteNumber);
    if (mergedNumbers.length !== merged.length) {
      setNoticeDialog({ title: "接上失败", message: "接上结果中出现无效号码，本次没有修改数据。" });
      return;
    }
    if (mergedNumbers.length <= numbers.length) {
      setNoticeDialog({
        title: "无需接上",
        message: `输入数据没有新增号码。当前 ${numbers.length} 个，输入 ${incoming.numbers.length} 个。`,
      });
      return;
    }

    const originalLength = numbers.length;
    const added = mergedNumbers.length - originalLength;
    const overlapLength = result?.alignment?.overlapLength ?? result?.tolerantAlignment?.overlapLength;
    setNumbers(mergedNumbers);
    setRedoNumbers([]);
    setActiveDialog(null);
    setTransferConnectDialog(null);
    setNoticeDialog({
      title: "接上完成",
      message: `已接上输入数据：原来 ${originalLength} 个，输入 ${incoming.numbers.length} 个，新增 ${added} 个，接上后 ${mergedNumbers.length} 个。${overlapLength !== undefined ? `重叠 ${overlapLength} 个。` : ""}`,
    });
  }

  function applyTransferConnectConflict() {
    const dialog = transferConnectDialog;
    if (!dialog) return;
    if (dialog.result.tolerantAlignment) {
      const merged = buildNumberMergeV2TolerantUnionWithChoices(dialog.result.tolerantAlignment, dialog.issueChoices);
      applyTransferConnectNumbers(merged, dialog.incoming, dialog.result);
      return;
    }
    if (!dialog.result.alignment) return;
    const merged = buildNumberMergeV2Union(numbers, dialog.incoming.numbers, dialog.result.alignment, dialog.conflictChoice);
    applyTransferConnectNumbers(merged, dialog.incoming, dialog.result);
  }

  function importTransferData() {
    const selected = transferSessions.find((item) => item.id === selectedTransferIds[0]);
    if (!selected) return;

    setConfirmDialog({
      title: "导入传输数据",
      message: numbers.length > 0 ? "导入将清除当前数据！确定要导入吗？" : "系统将使用选中的传输数据，确定要导入吗？",
      confirmText: "导入",
      onConfirm: () => {
        const importedNumbers = selected.numbers.filter(isRouletteNumber);
        setNumbers(importedNumbers);
        setRedoNumbers([]);
        setLastSavedNumbers([]);
        clearCurrentSession();
        setDataViewOpen(false);
        setNoticeDialog({ title: "导入传输数据", message: `已导入 ${importedNumbers.length} 个数字。` });
      },
    });
  }

  function removeTransferData() {
    const selected = transferSessions.find((item) => item.id === selectedTransferIds[0]);
    if (!selected) return;

    setConfirmDialog({
      title: "传输数据",
      message: "确定要删除选中的传输数据吗？",
      confirmText: "删除",
      onConfirm: async () => {
        setSharedLoading(true);
        try {
          await deleteTransferSession(sharedUsername.trim(), sharedPassword, selected.id);
          await refreshTransferSessions();
          setSelectedTransferIds([]);
          setNoticeDialog({ title: "传输数据", message: "已删除选中的传输数据。" });
        } catch (error) {
          setNoticeDialog({ title: "传输数据", message: formatSharedError(error) });
        } finally {
          setSharedLoading(false);
        }
      },
    });
  }

  async function uploadSharedData(targetId?: string, username?: string, password?: string) {
    if (numbers.length === 0) return;
    const u = (username ?? sharedUsername).trim();
    const p = password ?? sharedPassword;
    if (!u || !p) return;

    const currentSession = sessions.find((session) => session.id === currentSessionId);
    const name = currentSession?.name ?? defaultSessionName();
    if (!targetId) {
      const list = await listSharedSessions(u, p);
      if (list.some((s) => s.name === name)) {
        setNoticeDialog({ title: "共享数据", message: "当前数据已存在" });
        return;
      }
    }
    setSharedLoading(true);
    try {
      await upsertSharedSession({
        id: targetId,
        name,
        numbers,
        password: p,
        updatedAt: currentSession?.updatedAt ?? new Date().toISOString(),
        username: u,
      });
      await refreshSharedSessions(u, p);
      setNoticeDialog({ title: "共享数据", message: targetId ? "已覆盖共享数据。" : "已上传到共享数据。" });
    } catch (error) {
      setNoticeDialog({ title: "共享数据", message: formatSharedError(error) });
    } finally {
      setSharedLoading(false);
    }
  }

  async function uploadLocalToShared(username?: string, password?: string) {
    const u = (username ?? sharedUsername).trim();
    const p = password ?? sharedPassword;
    if (!u || !p || selectedSessions.length === 0) return;
    setSharedLoading(true);
    try {
      const existing = await listSharedSessions(u, p);
      const existingNames = new Set(existing.map((s) => s.name.toLowerCase()));
      let uploaded = 0;
      let skipped = 0;
      for (const session of selectedSessions) {
        if (existingNames.has(session.name.toLowerCase())) {
          skipped += 1;
          continue;
        }
        await upsertSharedSession({
          name: session.name,
          numbers: session.numbers,
          password: p,
          updatedAt: session.updatedAt,
          username: u,
        });
        existingNames.add(session.name.toLowerCase());
        uploaded += 1;
      }
      await refreshSharedSessions(u, p);
      const msg = skipped > 0
        ? `已上传 ${uploaded} 条，${skipped} 条重名已跳过。`
        : `已上传 ${uploaded} 条到云端。`;
      setNoticeDialog({ title: "共享数据", message: msg });
      setSelectedSessionIds([]);
    } catch (error) {
      setNoticeDialog({ title: "共享数据", message: formatSharedError(error) });
    } finally {
      setSharedLoading(false);
    }
  }

  async function importSharedToLocal() {
    const selected = sharedSessions.filter((s) => selectedSharedSessionIds.includes(s.id));
    if (selected.length === 0) return;

    const localSessions = await storage.listSessions();
    const names = new Set(localSessions.map((s) => s.name.toLowerCase()));
    let imported = 0;
    let skipped = 0;
    for (const shared of selected) {
      if (names.has(shared.name.toLowerCase())) {
        skipped += 1;
        continue;
      }
      const session: SavedSession = {
        id: crypto.randomUUID?.() ?? `${Date.now()}`,
        name: shared.name,
        numbers: shared.numbers,
        updatedAt: shared.updatedAt,
        sharedUploader: shared.uploader === sharedUsername.trim() ? "" : shared.uploader,
      };
      await storage.saveSession(session);
      names.add(shared.name.toLowerCase());
      imported += 1;
    }
    await refreshSessions();
    setSelectedSharedSessionIds([]);
    const msg = skipped > 0
      ? `已导入 ${imported} 条，${skipped} 条重名已跳过。`
      : `已导入 ${imported} 条到本地。`;
    setNoticeDialog({ title: "共享数据", message: msg });
  }

  async function removeSharedData() {
    const selected = sharedSessions.filter((s) => selectedSharedSessionIds.includes(s.id));
    if (selected.length === 0) return;

    setConfirmDialog({
      title: "共享数据",
      message: `确定要删除 ${selected.length} 条共享数据吗？`,
      confirmText: "删除",
      onConfirm: async () => {
        setSharedLoading(true);
        try {
          for (const s of selected) {
            await deleteSharedSession(sharedUsername.trim(), sharedPassword, s.id);
          }
          await refreshSharedSessions();
          setNoticeDialog({ title: "共享数据", message: `已删除 ${selected.length} 条。` });
        } catch (error) {
          setNoticeDialog({ title: "共享数据", message: formatSharedError(error) });
        } finally {
          setSharedLoading(false);
        }
      },
    });
  }

  function openSession(session: SavedSession) {
    setConfirmDialog({
      title: "打开数据",
      message: numbers.length > 0 ? "打开将清除当前数据！确定要打开吗？" : "系统将使用打开的数据，确定要打开吗？",
      confirmText: "打开",
      onConfirm: () => {
        const openedNumbers = session.numbers.filter(isRouletteNumber);
        setNumbers(openedNumbers);
        setRedoNumbers([]);
        setLastSavedNumbers(openedNumbers);
        setCurrentSessionId(session.id);
        setDataViewOpen(false);
        setNoticeDialog({ title: "打开数据", message: `已打开：${session.name}` });
      },
    });
  }

  async function deleteSessions(items: SavedSession[]) {
    for (const session of items) {
      await storage.deleteSession(session.id);
    }
    await refreshSessions();
    if (items.some((session) => session.id === currentSessionId)) {
      clearCurrentSession();
    }
    setSelectedSessionIds([]);
  }

  function openSessionMerge(items: SavedSession[]) {
    if (items.length !== 2) return;

    const [left, right] = items;
    const result = analyzeNumberMergeV2(left.numbers, right.numbers);
    if (result.relationship === "none" || result.relationship === "insufficient") {
      setNoticeDialog({
        title: "无法合并",
        message: `"${left.name}"与"${right.name}"没有找到足够可靠的重叠关系，不能合并。${result.description}`,
      });
      return;
    }
    if (result.relationship === "ambiguous") {
      setNoticeDialog({
        title: "无法安全合并",
        message: `"${left.name}"与"${right.name}"存在 ${result.alternatives?.length ?? "多个"} 个同等可能的接法，无法确定正确顺序。本次不进行合并。`,
      });
      return;
    }

    const relationship = result.tolerantAlignment?.relationship ?? result.alignment?.relationship ?? result.relationship;
    const targetId = relationship === "b-contains-a" || relationship === "a-then-b"
      ? right.id
      : left.id;
    setSessionMergeDialog({
      conflictChoice: targetId === right.id ? "b" : "a",
      issueChoices: result.tolerantAlignment?.issues.map(() => (targetId === right.id ? "b" : "a")) ?? [],
      left,
      result,
      right,
      targetId,
    });
  }

  async function applySessionMerge() {
    const dialog = sessionMergeDialog;
    if (!dialog) return;

    const { left, right, result } = dialog;
    const merged = result.safeToMerge
      ? result.merged
      : result.tolerantAlignment
        ? buildNumberMergeV2TolerantUnionWithChoices(result.tolerantAlignment, dialog.issueChoices)
      : result.alignment
        ? buildNumberMergeV2Union(left.numbers, right.numbers, result.alignment, dialog.conflictChoice)
        : undefined;
    if (!merged) {
      setSessionMergeDialog(null);
      setNoticeDialog({ title: "合并失败", message: "无法构造安全的合并结果，本次没有修改数据。" });
      return;
    }

    const mergedNumbers = merged.filter(isRouletteNumber);
    if (mergedNumbers.length !== merged.length) {
      setSessionMergeDialog(null);
      setNoticeDialog({ title: "合并失败", message: "合并结果中出现无效号码，本次没有修改数据。" });
      return;
    }

    const target = dialog.targetId === left.id ? left : right;
    const removed = target.id === left.id ? right : left;
    try {
      await storage.saveSession({
        ...target,
        numbers: mergedNumbers,
      });
      await storage.deleteSession(removed.id);
      await refreshSessions();
      setSelectedSessionIds([target.id]);

      if (currentSessionId === left.id || currentSessionId === right.id) {
        setNumbers(mergedNumbers);
        setRedoNumbers([]);
        setLastSavedNumbers(mergedNumbers);
        setCurrentSessionId(target.id);
      }

      setSessionMergeDialog(null);
      setNoticeDialog({
        title: "合并完成",
        message: `合并结果已保存到"${target.name}"（${mergedNumbers.length} 个号码），并删除"${removed.name}"。`,
      });
    } catch (error) {
      setSessionMergeDialog(null);
      setNoticeDialog({
        title: "合并失败",
        message: error instanceof Error ? error.message : "保存本地数据时发生错误，请重试。",
      });
    }
  }

  function renameSession(session: SavedSession) {
    setPromptValue(session.name);
    setPromptDialog({
      title: "重命名数据",
      message: "请输入该数据的新名称：",
      defaultValue: session.name,
      confirmText: "确定",
      onConfirm: async (value) => {
        const name = value.trim();
        const error = validateSessionName(name, sessions, session.id);
        if (error) {
          setNoticeDialog({ title: "重命名失败", message: error });
          return;
        }

        await storage.renameSession(session.id, name);
        await refreshSessions();
        setSelectedSessionIds([session.id]);
        setNoticeDialog({ title: "重命名成功", message: `"${session.name}"重命名为"${name}"成功。` });
      },
    });
  }

  function editSession(session: SavedSession) {
    setEditSessionId(session.id);
    setEditName(session.name);
    setEditUploader(session.sharedUploader ?? "");
    setEditTime(isoToDatetimeLocal(session.updatedAt));
    setEditDialogOpen(true);
  }

  async function saveEditSession() {
    if (!editSessionId) return;
    const session = sessions.find((s) => s.id === editSessionId);
    if (!session) return;

    const name = editName.trim();
    const nameError = validateSessionName(name, sessions, editSessionId);
    if (nameError) {
      setNoticeDialog({ title: "编辑失败", message: nameError });
      return;
    }

    const timeString = editTime.trim();
    let updatedAt = session.updatedAt;
    if (timeString) {
      const parsedDate = new Date(timeString);
      if (Number.isNaN(parsedDate.getTime())) {
        setNoticeDialog({ title: "编辑失败", message: "保存时间格式无效，请输入正确的日期时间。" });
        return;
      }
      updatedAt = parsedDate.toISOString();
    }

    const updated: SavedSession = {
      ...session,
      name,
      sharedUploader: editUploader.trim(),
      updatedAt,
    };

    await storage.saveSession(updated);
    await refreshSessions();
    setSelectedSessionIds([session.id]);
    setEditDialogOpen(false);
    setNoticeDialog({ title: "编辑成功", message: `数据"${name}"已更新。` });
  }

  async function exportSessions(items: SavedSession[]) {
    const exportItems = items.length > 0 ? items : sortedSessions;
    if (exportItems.length === 0) return;

    const text = JSON.stringify(
      exportItems.map((session) => ({
        Count: session.numbers.length,
        Name: session.name,
        Numbers: formatNumbers(session.numbers),
        SaveTime: formatSessionTime(session.updatedAt),
        tms: new Date(session.updatedAt).getTime(),
        ImportIndex: session.importIndex,
        SharedUploader: session.sharedUploader || "",
      })),
    );

    const copied = await copyTextToClipboard(text);
    setNoticeDialog({
      title: "导出数据",
      message: copied ? "数据已经用 JSON 格式导出到剪贴板。" : "数据复制失败，请检查浏览器剪贴板权限。",
    });
  }

  async function openExportDialog() {
    const items = selectedSessionIds.length > 0
      ? sortedSessions.filter((s) => selectedSessionIds.includes(s.id))
      : sortedSessions;
    if (items.length === 0) return;
    setConfirmDialog({
      title: "导出数据",
      message: `已选 ${items.length} 条数据。`,
      confirmText: "导出到文件",
      onConfirm: () => void exportToFile(),
      cancelText: "导出到剪贴板",
      onCancel: () => void exportSessions(items),
    });
  }

  async function exportToFile() {
    const items = selectedSessionIds.length > 0
      ? sortedSessions.filter((s) => selectedSessionIds.includes(s.id))
      : sortedSessions;
    if (items.length === 0) return;
    const data = items.map((session) => ({
      Count: session.numbers.length,
      Name: session.name,
      Numbers: formatNumbers(session.numbers),
      SaveTime: formatSessionTime(session.updatedAt),
      tms: new Date(session.updatedAt).getTime(),
      ImportIndex: session.importIndex,
      SharedUploader: session.sharedUploader || "",
    }));
    const json = JSON.stringify(data, null, 2);
    const filename = "history_data.json";

    // Try File System Access API (desktop Chrome/Edge)
    if ("showDirectoryPicker" in window) {
      try {
        const dirHandle = await (window as any).showDirectoryPicker();
        const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(json);
        await writable.close();
        setNoticeDialog({ title: "导出文件", message: `已保存到选定文件夹：${filename}` });
        return;
      } catch (err: any) {
        if (err.name === "AbortError") return;
      }
    }

    // Fallback: browser download
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setNoticeDialog({ title: "导出文件", message: `已下载：${filename}` });
  }

  function toggleSessionSelection(id: string) {
    setSelectedSessionIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function sortDataView(field: DataSortField) {
    if (sessionSortField === field) {
      setSessionSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
    } else {
      setSessionSortField(field);
      setSessionSortDirection(field === "time" ? "desc" : "asc");
    }
  }

  function importFilesFromText() {
    let result: { imported: SavedSession[]; skipped: number };
    try {
      result = parseSessionImport(dataText, sessions);
    } catch (error) {
      setDialogMessage(error instanceof Error ? error.message : "数据格式不正确，请检查。");
      return;
    }

    const { imported, skipped } = result;
    if (imported.length === 0) {
      setNoticeDialog({ title: "数据导入", message: `没有新数据可导入。${skipped > 0 ? ` ${skipped} 条重名已跳过。` : ""}` });
      setActiveDialog(null);
      return;
    }

    let confirmMsg = `将导入 ${imported.length} 条数据`;
    if (skipped > 0) confirmMsg += `，${skipped} 条重名将跳过`;
    confirmMsg += "，确定要导入吗？";

    setConfirmDialog({
      title: "数据导入",
      message: confirmMsg,
      confirmText: "导入",
      onConfirm: async () => {
        for (const session of imported) {
          await storage.saveSession(session);
        }
        await refreshSessions();
        setActiveDialog(null);
        let doneMsg = `已导入 ${imported.length} 条数据`;
        if (skipped > 0) doneMsg += `，${skipped} 条重名未导入`;
        setNoticeDialog({ title: "数据导入", message: doneMsg + "。" });
      },
    });
  }

  const maxStatsColRowCount = Math.max(...stats.colRows.map((item) => item.count), 1);
  const maxBisectionCount = Math.max(
    stats.bisections.red,
    stats.bisections.black,
    stats.bisections.odd,
    stats.bisections.even,
    stats.bisections.big,
    stats.bisections.small,
    1,
  );
  const orderedColRows = useMemo(
    () => [...stats.colRows].sort((left, right) => left.index - right.index),
    [stats.colRows],
  );
  const groupStats = orderedColRows.slice(0, 3);
  const rowStats = orderedColRows.slice(3, 6);
  const sortedSessions = useMemo(
    () => sortSessions(sessions, sessionSortField, sessionSortDirection),
    [sessionSortDirection, sessionSortField, sessions],
  );
  const gameStats = useMemo(
    () => calculateGameStats(numbers, effectiveStatsScope, gameSortField, gameSortDirection),
    [effectiveStatsScope, gameSettingsRevision, gameSortDirection, gameSortField, numbers],
  );
  const colRowStats = useMemo(
    () => calculateColRowStats(numbers, effectiveColRowScope),
    [effectiveColRowScope, numbers],
  );
  const frequencyStats = useMemo(() => calculateFrequencyStats(numbers, frequencyScopes), [frequencyScopes, numbers]);
  const distanceStats = colRowStats.rawDistances;
  const colRowCompareRows = useMemo(() => {
    return buildColRowCompareRows(
      colRowStats.rawDistances,
      colRowScope,
      refineRoundStart,
      refineRoundBet,
      refineSortField,
      refineSortDirection,
    );
  }, [colRowScope, colRowStats.rawDistances, refineRoundBet, refineRoundStart, refineSortDirection, refineSortField]);
  const refineCompareRows = useMemo(() => {
    return buildColRowCompareRows(
      colRowStats.rawDistances,
      refineScope,
      refineRoundStart,
      refineRoundBet,
      refineSortField,
      refineSortDirection,
    );
  }, [colRowStats.rawDistances, refineRoundBet, refineRoundStart, refineScope, refineSortDirection, refineSortField]);
  const otherNumberStats = useMemo(
    () => calculateOtherNumberStats(numbers, effectiveOtherScope, otherNumberSortField, otherNumberSortDirection),
    [effectiveOtherScope, numbers, otherNumberSortDirection, otherNumberSortField],
  );
  const otherLongStats = useMemo(
    () => calculateOtherLongStats(numbers, otherLongBetCount, otherLongRound),
    [numbers, otherLongBetCount, otherLongRound],
  );
  const otherRoundBetStats = useMemo(
    () => calculateOtherRoundBet(numbers, effectiveOtherScope),
    [effectiveOtherScope, numbers],
  );
  const otherRoundSummaryStats = useMemo(
    () => calculateOtherRoundSummary(numbers, effectiveOtherScope),
    [effectiveOtherScope, numbers],
  );
  const colRowDetailItems = useMemo(
    () =>
      [0, 1, 2, 4, 5, 6]
        .map((key) => colRowStats.rows.find((item) => item.key === key))
        .filter((item): item is ColRowWave => Boolean(item)),
    [colRowStats.rows],
  );
  const colRowExploreResults = useMemo(
    () => calculateColRowExplore(colRowStats.rows, colRowExploreRows, colRowExploreRounds),
    [colRowExploreRows, colRowExploreRounds, colRowStats.rows],
  );
  const selectedSessions = useMemo(
    () => sortedSessions.filter((session) => selectedSessionIds.includes(session.id)),
    [selectedSessionIds, sortedSessions],
  );

  function sortGameView(field: GameSortField) {
    if (gameSortField === field) {
      setGameSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
    } else {
      setGameSortField(field);
      setGameSortDirection(field === "name" ? "asc" : "desc");
    }
  }

  function sortRefineView(field: RefineSortField) {
    if (field === "name") {
      setRefineSortField("name");
      setRefineSortDirection("asc");
      return;
    }

    if (refineSortField === field) {
      setRefineSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
    } else {
      setRefineSortField(field);
      setRefineSortDirection("desc");
    }
  }

  function sortOtherNumbers(field: OtherNumberSortField) {
    if (field === "number") {
      setOtherNumberSortField("number");
      setOtherNumberSortDirection("asc");
      return;
    }

    if (otherNumberSortField === field) {
      setOtherNumberSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
    } else {
      setOtherNumberSortField(field);
      setOtherNumberSortDirection("desc");
    }
  }

  function reloadGameConfigState() {
    const settings = loadGameBetSettings();
    setAllGameBets(loadGameBets());
    setSelectedBetKeys(settings.bets.map(formatGameBet));
    setSelectedRounds(settings.rounds);
    setSelectedAcrModes(settings.acrModes);
    setSelectedManageBetKeys([]);
  }

  function openConfigView() {
    reloadGameConfigState();
    setDraftWindowMode(windowMode);
    setConfigViewOpen(true);
  }

  function openGameView() {
    setColRowViewOpen(false);
    setFrequencyViewOpen(false);
    setDistanceViewOpen(false);
    setRefineViewOpen(false);
    setOtherViewOpen(false);
    setGameViewOpen(true);
  }

  function openColRowView() {
    setGameViewOpen(false);
    setFrequencyViewOpen(false);
    setDistanceViewOpen(false);
    setRefineViewOpen(false);
    setOtherViewOpen(false);
    setColRowViewOpen(true);
  }

  function openFrequencyView() {
    setGameViewOpen(false);
    setColRowViewOpen(false);
    setDistanceViewOpen(false);
    setRefineViewOpen(false);
    setOtherViewOpen(false);
    setFrequencyViewOpen(true);
  }

  function openDistanceView() {
    setGameViewOpen(false);
    setColRowViewOpen(false);
    setFrequencyViewOpen(false);
    setRefineViewOpen(false);
    setOtherViewOpen(false);
    setDistanceDetailKey(null);
    setDistanceViewOpen(true);
  }

  function openRefineView() {
    setGameViewOpen(false);
    setColRowViewOpen(false);
    setFrequencyViewOpen(false);
    setDistanceViewOpen(false);
    setOtherViewOpen(false);
    setRefineViewOpen(true);
  }

  function openOtherView() {
    setGameViewOpen(false);
    setColRowViewOpen(false);
    setFrequencyViewOpen(false);
    setDistanceViewOpen(false);
    setRefineViewOpen(false);
    setOtherViewOpen(true);
  }

  function toggleBetSelection(bet: number[]) {
    const key = formatGameBet(bet);
    setSelectedBetKeys((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  }

  function toggleRoundSelection(round: number) {
    setSelectedRounds((current) =>
      current.includes(round) ? current.filter((item) => item !== round) : [...current, round].sort((a, b) => a - b),
    );
  }

  function toggleAcrSelection(mode: string) {
    setSelectedAcrModes((current) =>
      current.includes(mode) ? current.filter((item) => item !== mode) : [...current, mode],
    );
  }

  function toggleAllBets() {
    setSelectedBetKeys((current) =>
      current.length === allGameBets.length ? [] : allGameBets.map(formatGameBet),
    );
  }

  function toggleAllRounds() {
    setSelectedRounds((current) => (current.length === gameRounds.length ? [] : [...gameRounds]));
  }

  function toggleAllAcrModes() {
    setSelectedAcrModes((current) => (current.length === gameAcrOptions.length ? [] : [...gameAcrOptions]));
  }

  function toggleColRowExploreRow(index: number) {
    setColRowExploreRows((current) => {
      const next = current.includes(index)
        ? current.filter((item) => item !== index)
        : [...current, index].sort((a, b) => a - b);
      saveColRowExploreSelections(next, colRowExploreRounds);
      return next;
    });
  }

  function toggleColRowExploreRound(round: number) {
    setColRowExploreRounds((current) => {
      const next = current.includes(round)
        ? current.filter((item) => item !== round)
        : [...current, round].sort((a, b) => a - b);
      saveColRowExploreSelections(colRowExploreRows, next);
      return next;
    });
  }

  function saveConfigView() {
    if (configTab === "other") {
      setWindowMode(draftWindowMode);
      localStorage.setItem(windowModeKey, draftWindowMode);
      setConfigViewOpen(false);
      return;
    }

    const selectedBets = allGameBets.filter((bet) => selectedBetKeys.includes(formatGameBet(bet)));
    if (selectedBets.length <= 0) {
      setNoticeDialog({ title: "打法配置", message: "至少要选择一个打法！" });
      return;
    }
    if (selectedRounds.length <= 0) {
      setNoticeDialog({ title: "打法配置", message: "至少要选择一个轮次！" });
      return;
    }
    if (selectedAcrModes.length <= 0) {
      setNoticeDialog({ title: "打法配置", message: "至少要选择一个行组选项！" });
      return;
    }

    saveGameBetSettings({
      acrModes: selectedAcrModes,
      bets: selectedBets,
      rounds: selectedRounds,
    });
    setGameSettingsRevision((value) => value + 1);
    setConfigViewOpen(false);
  }

  function openBetsManage() {
    setAllGameBets(loadGameBets());
    setSelectedManageBetKeys([]);
    setBetsManageOpen(true);
  }

  function addManagedBet() {
    setPromptValue("");
    setPromptDialog({
      title: "添加打法",
      message: "请输入新打法：",
      defaultValue: "",
      confirmText: "添加",
      onConfirm: (value) => {
        const result = addGameBet(value);
        if (result.error) {
          setNoticeDialog({ title: "添加失败", message: result.error });
          return;
        }
        reloadGameConfigState();
        setAllGameBets(result.bets ?? loadGameBets());
        setGameSettingsRevision((revision) => revision + 1);
      },
    });
  }

  function toggleManageBetSelection(bet: number[]) {
    const key = formatGameBet(bet);
    setSelectedManageBetKeys((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  }

  function deleteManagedBets() {
    const selected = allGameBets.filter((bet) => selectedManageBetKeys.includes(formatGameBet(bet)));
    if (selected.length <= 0 || selected.length >= allGameBets.length) return;

    setConfirmDialog({
      title: "请确认",
      message: "确定要删除当前选中的打法吗？",
      confirmText: "删除",
      onConfirm: () => {
        setAllGameBets(deleteGameBets(selected));
        reloadGameConfigState();
        setGameSettingsRevision((revision) => revision + 1);
      },
    });
  }

  function restoreManagedBets() {
    setConfirmDialog({
      title: "请确认",
      message: "确定要重新加入预定义的打法吗？",
      confirmText: "恢复",
      onConfirm: () => {
        setAllGameBets(restoreDefaultGameBets());
        reloadGameConfigState();
        setGameSettingsRevision((revision) => revision + 1);
      },
    });
  }

  // Stats tab content components (inside App for closure access)
  function StatsFrequencyTab() {
    return (
      <div className={`frequency-body ${frequencyDetailKey === null ? "frequency-overview-body" : "frequency-detail-body"}`}>
        {frequencyDetailKey === null ? (
          <>
            <FrequencyOverviewChart frequencyStats={frequencyStats} onSelect={(key:number) => setFrequencyDetailKey(key)} scopeIndex={frequencyScopeIndex} />
          </>
        ) : (
          <>
            <div className="data-screen-actions frequency-detail-actions" style={{borderTop:0,padding:0}}>
              {frequencyDetailKeys.map((key) => (
                <button className={key === frequencyDetailKey ? "selected" : ""} key={key} onClick={() => setFrequencyDetailKey(key)} type="button">{frequencyBandLabels[key]}</button>
              ))}
            </div>
            <FrequencyDetailChart
              frequencyScopes={frequencyScopes}
              frequencyStats={frequencyStats}
              onBack={() => setFrequencyDetailKey(null)}
              selectedKey={frequencyDetailKey}
            />
          </>
        )}
      </div>
    );
  }

  function StatsDistanceTab() {
    return (
      <div className="distance-body">
        <DistanceOverviewChart distances={distanceStats} onSelect={(key:number) => setDistanceDetailKey(key)} />
        {distanceDetailKey !== null ? (
          <div className="distance-detail-backdrop" onClick={() => setDistanceDetailKey(null)} role="button" tabIndex={0}>
            <DistanceSingleChart distances={distanceStats} selectedKey={distanceDetailKey} />
          </div>
        ) : null}
      </div>
    );
  }

  function StatsColRowTab() {
    const items = [0,1,2,4,5,6].map((key) => colRowStats.rows.find((item) => item.key === key)).filter((item): item is ColRowWave => Boolean(item));
    return (
      <div className="colrow-body">
        <div className="stats-tabs">
          <button className={colRowTab === "detail" ? "selected" : ""} onClick={() => setColRowTab("detail")} type="button">明细</button>
          <button className={colRowTab === "chart" ? "selected" : ""} onClick={() => setColRowTab("chart")} type="button">统计图</button>
          <button className={colRowTab === "summary" ? "selected" : ""} onClick={() => setColRowTab("summary")} type="button">统计数据</button>
          <button className={colRowTab === "compare" ? "selected" : ""} onClick={() => setColRowTab("compare")} type="button">比较</button>
        </div>
        {colRowTab === "detail" ? <ColRowDetailView items={items} /> : null}
        {colRowTab === "chart" ? <ColRowChartView items={colRowStats.rows.slice(0, 8)} scope={effectiveColRowScope} /> : null}
        {colRowTab === "summary" ? <ColRowSummaryView items={colRowStats.rows.slice(0, 8)} key={`cs-${colRowScope}-${numbers.length}`} results={colRowExploreResults} selectedRounds={colRowExploreRounds} selectedRows={colRowExploreRows} toggleRound={toggleColRowExploreRound} toggleRow={toggleColRowExploreRow} /> : null}
        {colRowTab === "compare" ? (
          <div className="refine-compare">
            <div className="refine-rounds">
              <div className="refine-round-row"><span>从第几轮开始：</span>
                <div className="data-screen-actions refine-round-actions" style={{borderTop:0,padding:0}}>
                  {[0,1,2,3,4,5,6,7,8,9].map((value) => (<button className={value===refineRoundStart?"selected":""} key={value} onClick={()=>setRefineRoundStart(value)} type="button">{value}</button>))}
                </div>
              </div>
              <div className="refine-round-row"><span>打几轮：</span>
                <div className="data-screen-actions refine-round-actions" style={{borderTop:0,padding:0}}>
                  {[1,2,3,4,5,6,7,8,9,10].map((value) => (<button className={value===refineRoundBet?"selected":""} key={value} onClick={()=>setRefineRoundBet(value)} type="button">{value}</button>))}
                </div>
              </div>
            </div>
            <table className="refine-table"><thead><tr>
              <th><button onClick={()=>sortRefineView("name")} type="button">行组{refineSortField==="name"?<SortMark active direction={refineSortDirection}/>:null}</button></th>
              <th><button onClick={()=>sortRefineView("succeeded")} type="button">成功{refineSortField==="succeeded"?<SortMark active direction={refineSortDirection}/>:null}</button></th>
              <th>失败</th>
              <th><button onClick={()=>sortRefineView("failureRate")} type="button">失败率{refineSortField==="failureRate"?<SortMark active direction={refineSortDirection}/>:null}</button></th>
            </tr></thead><tbody>
              {colRowCompareRows.map((item) => (<tr key={item.key}><th>{item.label}</th><td>{item.succeeded}</td><td>{item.failed}</td><td>{(item.failureRate*100).toFixed(2)}%</td></tr>))}
            </tbody></table>
          </div>
        ) : null}
      </div>
    );
  }

  function StatsWaveTab() {
    const w = 360, h = 100, padX = 4, padR = 4, padY = 8;
    const MAX_SLOTS = 60;
    const BASIS = 144;
    const maxSlots = Math.round(BASIS / 7);
    const chartW = w - padX - padR;
    const slotW = chartW / maxSlots;
    return (
      <div className="prediction-body" style={{padding:0}}>
        <div className="stats-tabs">
          <button className={waveTab === "rhythm" ? "selected" : ""} onClick={() => setWaveTab("rhythm")} type="button">节奏</button>
          <button className={waveTab === "trend" ? "selected" : ""} onClick={() => setWaveTab("trend")} type="button">趋势</button>
        </div>
        {waveTab === "rhythm" ? (
          <>
            <div className="wave-grid" style={{padding:"0 10px"}}>
              {waveRhythmData.map((wd) => {
                const allQ3 = waveRhythmData.flatMap(x => x.pts.map(p => p.q3));
                const yMax = allQ3.length > 0 ? Math.max(4, ...allQ3) + 1 : 6;
                const yVal = (v: number) => padY + ((yMax - v) / yMax) * (h - padY * 2);
                const gridLines = (() => { const g: number[] = []; for (let n = 1; n <= yMax; n++) g.push(n); return g; })();
                const overflow = wd.pts.length > maxSlots;
                const stepX = overflow ? slotW : (wd.pts.length > 1 ? chartW / (wd.pts.length - 1) : chartW);
                const svgW = overflow ? padX + (wd.pts.length - 1) * slotW + padR : w;
                const lineEnd = overflow ? padX + (wd.pts.length - 1) * slotW : w - padR;
                return (
                  <div className="wave-card" key={wd.label} style={{display:"flex", flexDirection:"row", alignItems:"stretch"}}>
                    <div style={{display:"flex", alignItems:"center", padding:"2px 4px 2px 0", minWidth:22, borderRight:"1px solid #e8e4e0"}}>
                      <span style={{writingMode:"vertical-rl", fontSize:12, fontWeight:500, color:"#6b5a38"}}>{wd.label}</span>
                    </div>
                    <div className="wave-scroll" style={{flex:1, minWidth:0, overflowX: overflow ? "auto" : "hidden", WebkitOverflowScrolling:"touch"}} ref={(el) => { if (el && overflow) el.scrollLeft = el.scrollWidth; }}>
                    <svg className="wave-sparkline" viewBox={"0 0 " + svgW + " " + h} preserveAspectRatio="none" role="img" style={{width: overflow ? svgW : "100%", height: h}}>
                      <rect x={padX} y={padY} width={lineEnd - padX} height={h - padY * 2} fill="#fafaf7" rx="2" />
                      <line x1={padX} x2={lineEnd} y1={yVal(0)} y2={yVal(0)} stroke="#9a7a5a" strokeWidth="1" />
                      {gridLines.map((g) => (
                        <line key={"g" + g} x1={padX} x2={lineEnd} y1={yVal(g)} y2={yVal(g)} stroke={g % 5 === 0 ? "#c0ae98" : "#e0d8cc"} strokeWidth={g % 5 === 0 ? "0.7" : "0.5"} />
                      ))}
                      {wd.pts.length >= 2 && (() => {
                        let bandPath = "";
                        for (let j = 0; j < wd.pts.length; j++) {
                          const x = padX + j * stepX;
                          bandPath += (j === 0 ? "M" : "L") + x.toFixed(1) + "," + yVal(wd.pts[j].q3).toFixed(1) + " ";
                        }
                        for (let j = wd.pts.length - 1; j >= 0; j--) {
                          const x = padX + j * stepX;
                          bandPath += "L" + x.toFixed(1) + "," + yVal(wd.pts[j].q1).toFixed(1) + " ";
                        }
                        bandPath += "Z";
                        return <path d={bandPath} fill="#c8b898aa" stroke="none" />;
                      })()}
                      {wd.pts.length >= 2 && (() => {
                        const pts = wd.pts.map((p, j) => (padX + j * stepX).toFixed(1) + "," + yVal(p.median).toFixed(1)).join(" ");
                        return <polyline points={pts} fill="none" stroke="#c0a860" strokeWidth="1.5" />;
                      })()}
                    </svg>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="scope-row" style={{marginTop:6, paddingLeft:8}}>
              {[5, 8, 13, 21, 34].map(n => (
                <button key={n} className={waveWindow === n ? "selected" : ""} onClick={() => { setWaveWindow(n); localStorage.setItem("londoner.waveWindow", String(n)); }} type="button">{n}</button>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="prediction-desc" style={{padding:"0 18px"}}>峰值间隔的移动平均趋势。下降(绿)=节奏加快，上升(红)=节奏变慢，走平=稳定</p>
            <div className="wave-grid" style={{padding:"0 10px"}}>
              {waveHistory.map((wh, i) => {
                const ws = waveSnapshot[i];
                if (!wh.hasData) return null;
                const maxSma = Math.max(...wh.points, 3);
                const minSma = Math.min(...wh.points, 1);
                const range = Math.max(maxSma - minSma, 0.5);
                const w2 = 360, h2 = 64, padX2 = 0, padY2 = 4;
                const baseline = h2 - padY2;
                const maxSlots = 59;
                const stepX = w2 / maxSlots;
                const yVal2 = (v: number) => padY2 + ((maxSma - v) / range) * (h2 - padY2 * 2);
                const segments: { x1: number; y1: number; x2: number; y2: number; up: boolean }[] = [];
                for (let j = 1; j < wh.points.length; j++) {
                  segments.push({ x1: padX2 + (j - 1) * stepX, y1: yVal2(wh.points[j - 1]), x2: padX2 + j * stepX, y2: yVal2(wh.points[j]), up: wh.points[j] <= wh.points[j - 1] });
                }
                return (
                  <div className="wave-card" key={wh.label}>
                    <div className="wave-card-head">
                      <strong className="wave-card-label">{wh.label}</strong>
                      <span className="wave-card-info">k={ws.peak} {(ws.conc*100).toFixed(0)}% SMA {ws.sma.toFixed(1)}</span>
                    </div>
                    <svg className="wave-sparkline" viewBox={"0 0 " + w2 + " " + h2} preserveAspectRatio="none" role="img">
                      <line x1={padX2} x2={w2 - padX2} y1={baseline} y2={baseline} stroke="#e8e4e0" strokeWidth="1" />
                      {segments.map((seg, j) => {
                        const color = seg.up ? "#5f9a7088" : "#b85a3a88";
                        const pts = seg.x1.toFixed(1) + "," + seg.y1.toFixed(1) + " " + seg.x2.toFixed(1) + "," + seg.y2.toFixed(1) + " " + seg.x2.toFixed(1) + "," + baseline + " " + seg.x1.toFixed(1) + "," + baseline;
                        return <polygon key={j} points={pts} fill={color} />;
                      })}
                      <polyline
                        points={wh.points.map((v, j) => (padX2 + j * stepX).toFixed(1) + "," + yVal2(v).toFixed(1)).join(" ")}
                        fill="none" stroke="#5a4a38" strokeWidth="1.5"
                      />
                    </svg>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  }

  function StatsOtherTab() {
    return (
      <div className="other-body">
        <div className="stats-tabs other-tabs">
          <button className={otherTab==="longs"?"selected":""} onClick={()=>setOtherTab("longs")} type="button">追打</button>
          <button className={otherTab==="numbers"?"selected":""} onClick={()=>setOtherTab("numbers")} type="button">号码</button>
          <button className={otherTab==="rounds"?"selected":""} onClick={()=>setOtherTab("rounds")} type="button">轮次</button>
        </div>
        {otherTab === "longs" ? (
          <div className="other-longs">
            <table className="other-table other-longs-table"><thead><tr><th>次数</th>{otherLongStats.rounds.map((round)=>(<th key={round}>{round}</th>))}<th>NOT</th></tr></thead><tbody>
              <tr><th rowSpan={2}>{otherLongStats.total}</th>{otherLongStats.wins.map((count,index)=>(<td key={otherLongStats.rounds[index]}>{count}</td>))}<td>{otherLongStats.misses}</td></tr>
              <tr>{otherLongStats.percentages.map((percent,index)=>(<td key={index}>{formatPercent(percent)}</td>))}</tr>
            </tbody></table>
          </div>
        ) : null}
        {otherTab === "numbers" ? <div className="other-numbers"><table className="other-table other-numbers-table"><thead><tr><th onClick={()=>sortOtherNumbers("number")}>号码 <SortMark active={otherNumberSortField==="number"} direction={otherNumberSortDirection}/></th><th onClick={()=>sortOtherNumbers("distance")}>距离 <SortMark active={otherNumberSortField==="distance"} direction={otherNumberSortDirection}/></th><th onClick={()=>sortOtherNumbers("frequency")}>次数 <SortMark active={otherNumberSortField==="frequency"} direction={otherNumberSortDirection}/></th><th onClick={()=>sortOtherNumbers("number")}>号码</th><th onClick={()=>sortOtherNumbers("distance")}>距离</th><th onClick={()=>sortOtherNumbers("frequency")}>次数</th></tr></thead><tbody>{otherNumberStats.rows.map((row,index)=>(<tr key={index}><OtherNumberCells item={row.left}/><OtherNumberCells item={row.right}/></tr>))}</tbody></table><div className="other-max-distance"><strong>最大距离前五名：</strong>{otherNumberStats.maxDistances.map((item,index)=>(<span key={`${item.number}-${item.distance}-${index}`}>{item.number}：{item.distance}</span>))}</div></div> : null}
        {otherTab === "rounds" ? (
          <div className="other-rounds">
            <div className="stats-tabs other-round-tabs"><button className={otherRoundTab==="bet"?"selected":""} onClick={()=>setOtherRoundTab("bet")} type="button">轮次参考数据</button><button className={otherRoundTab==="summary"?"selected":""} onClick={()=>setOtherRoundTab("summary")} type="button">轮次统计数据</button></div>
            {otherRoundTab === "bet" ? <table className="other-table other-round-bet-table"><thead><tr><th>轮次</th><th>不出</th><th>概率</th>{otherRoundFailedRounds.map((round)=>(<th key={`f-${round}`}>F{round}</th>))}{otherRoundFailedRounds.map((round)=>(<th key={`fp-${round}`}>概率</th>))}</tr></thead><tbody>{otherRoundBetStats.map((item)=>(<tr key={item.round}><th>{item.round}</th><td>{item.notYet}</td><td>{formatPercent(item.notYetPercentage)}</td>{item.failed.map((count,index)=>(<td key={`f-${index}`}>{count}</td>))}{item.failedPercentages.map((percent,index)=>(<td key={`fp-${index}`}>{formatPercent(percent)}</td>))}</tr>))}</tbody></table> : <table className="other-table other-round-summary-table"><thead><tr><th rowSpan={2}>轮次</th><th colSpan={3}>组</th><th colSpan={3}>行</th><th colSpan={3}>全部</th></tr><tr><th>前</th><th>本轮</th><th>后</th><th>前</th><th>本轮</th><th>后</th><th>前</th><th>本轮</th><th>后</th></tr></thead><tbody>{otherRoundSummaryStats.map((item)=>(<tr key={item.round}><th>{item.round}</th><td>{item.group.before}</td><td>{item.group.current}</td><td>{item.group.after}</td><td>{item.row.before}</td><td>{item.row.current}</td><td>{item.row.after}</td><td>{item.all.before}</td><td>{item.all.current}</td><td>{item.all.after}</td></tr>))}</tbody></table>}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <main className={`app-shell theme-${themeMode} ${keyboardVisible ? "" : "keyboard-hidden"}`}>
      <section className="top-stats-strip" aria-label="统计数据">
        <strong className="top-stats-count">{numbers.length}</strong>
        <span className="top-stats-roi">
          <span className="top-stats-item">投<strong>{combinedRoi.bet}</strong></span>
          <span className={`top-stats-item top-stats-net ${combinedRoi.net >= 0 ? "net-positive" : "net-negative"}`}>
            净<strong>{combinedRoi.net >= 0 ? "+" : ""}{combinedRoi.net}</strong>
          </span>
          {combinedRoiFrom201 ? (
            <>
              <span className="top-stats-sep">|</span>
              <span className="top-stats-item">投<strong>{combinedRoiFrom201.bet}</strong></span>
              <span className={`top-stats-item top-stats-net ${combinedRoiFrom201.net >= 0 ? "net-positive" : "net-negative"}`}>
                净<strong>{combinedRoiFrom201.net >= 0 ? "+" : ""}{combinedRoiFrom201.net}</strong>
              </span>
            </>
          ) : null}
        </span>
      </section>
      <section className="signal-strip" aria-label="行组状态" onClick={() => setSeparateColRows((value) => !value)}>
        {topColRows.map((item) => (
          <div
            className={`signal-cell ${
              item.distance > 5 ? "signal-strong" : item.distance >= 5 ? "signal-watch" : ""
            }`}
            key={item.index}
          >
            <div className="signal-label">
              <span>{item.label}</span>
              <strong>{item.distance}</strong>
            </div>
          </div>
        ))}
      </section>

      {columnStats.length > 0 ? (
        <section className="columns-panel">
          <div className="columns-grid">
            {columnStats.map((item) => (
              <div className={`column-chip ${item.active ? "active" : "inactive"}`} key={item.index}>
                <span>{item.label}</span>
                <strong>{item.distance}</strong>
              </div>
            ))}
          </div>
          <div className="scope-row">
            {columnMinimums.map((value) => (
              <button
                className={value === columnMinimum ? "selected" : ""}
                key={value}
                onClick={() => setColumnMinimum(value)}
                type="button"
              >
                {value}
              </button>
            ))}
            <button type="button">...</button>
          </div>
        </section>
      ) : null}

      {finishedLongs.length > 0 ? (
        <section className="finished-line">
          <span>刚结束</span>
          {finishedLongs.map((item) => (
            <strong key={item.index}>
              {item.label} {item.closedDistance}/{item.afterDistance}
            </strong>
          ))}
        </section>
      ) : null}

      <section
        className={`queue-panel ${queueExpanded ? "expanded" : "collapsed"}`}
        onClick={() => setQueueExpanded((value) => !value)}
      >
        {queueItems.length === 0 ? <span className="empty-state">等待输入</span> : null}
        <div className="queue-row">
          {(queueExpanded ? [...numbers].reverse() : queueItems).map((value, index) => (
            <span className={`queue-chip number-${getNumberColor(value)}`} key={`q-${index}-${numbers.length}`}>{value}</span>
          ))}
        </div>
      </section>

      <section className="summary-grid">
        <div className="summary-panel ratio-panel">
          <div className="panel-head">
            <span>最近 {statsScope < 0 ? "全部" : statsScope} 个</span>
            <strong>0: {stats.zeroCount}</strong>
          </div>
          <div className="group-counts">
            <SegmentedStatGroup
              items={groupStats.map((item) => ({ label: item.label, value: item.count }))}
              max={maxStatsColRowCount}
            />
            <SegmentedStatGroup
              items={rowStats.map((item) => ({ label: item.label, value: item.count }))}
              max={maxStatsColRowCount}
            />
          </div>
          <div className="ratio-grid">
            <SegmentedStatGroup
              items={[
                { label: "红", value: stats.bisections.red },
                { label: "黑", value: stats.bisections.black },
              ]}
              max={maxBisectionCount}
            />
            <SegmentedStatGroup
              items={[
                { label: "单", value: stats.bisections.odd },
                { label: "双", value: stats.bisections.even },
              ]}
              max={maxBisectionCount}
            />
            <SegmentedStatGroup
              items={[
                { label: "大", value: stats.bisections.big },
                { label: "小", value: stats.bisections.small },
              ]}
              max={maxBisectionCount}
            />
          </div>
          <div className="scope-row">
            {statScopes.map((value) => (
              <button
                className={value === statsScope ? "selected" : ""}
                key={value}
                onClick={() => setStatsScope(value)}
                type="button"
              >
                {value < 0 ? "全部" : value}
              </button>
            ))}
          </div>
        </div>
      </section>

      {canUseQuality124 && showQuality124 && quality124Signals.length > 0 ? (
        <section className="quality124-signal-area" aria-label="行组节奏信号">
          {quality124Signals.map((item) => (
            <div
              className={`quality124-signal-item quality124-tier-${item.tier}`}
              key={`quality124-${item.kind}-${item.ci}-${item.entryAfter}-${item.tier}`}
              onClick={() => { setPredictionTab("quality124"); setPredictionWindowOpen(true); }}
              role="button"
              tabIndex={0}
            >
              <span className="quality124-signal-label">{item.label}</span>
              <span className="quality124-signal-chase">
                <span className="quality124-stars">{item.stars > 0 ? "★".repeat(item.stars) : ""}</span>
                <span className="quality124-dots">
                  {Array.from({ length: item.chaseLen }, (_, i) => i + 1).map((n) => (
                    <span key={n} className={`quality124-dot ${n <= item.round ? "filled" : ""}`} />
                  ))}
                </span>
                <span className="quality124-bet">{item.betAmt}</span>
              </span>
            </div>
          ))}
        </section>
      ) : null}

      {(() => { const filtered = signalDisplay.filter(item => item.kind === "cold" && showCold); return filtered.length > 0 ? (
        <section className="prediction-signal-area" aria-label="预测信号">
          {filtered.map((item) => (
            <div
              className={`prediction-signal-item ${item.isNew ? "" : "chase-active"} ${item.kind === "rhythm" ? "rhythm-signal" : ""}`}
              key={`${item.kind}-${item.ci}`}
              onClick={() => { setPredictionTab(item.kind === "rhythm" ? "rhythm" : "cold"); setPredictionWindowOpen(true); }}
              role="button"
              tabIndex={0}
            >
              <strong className="prediction-signal-label">{item.label}</strong>
              <span className="prediction-chase">
                <span className="prediction-dots">
                  {Array.from({length: item.chaseLen}, (_, i) => i + 1).map((n) => (
                    <span key={n} className={`prediction-dot ${n <= item.round ? "filled" : ""}`} />
                  ))}
                </span>
                <span className="prediction-bet">{item.betAmt}</span>
              </span>
            </div>
          ))}
        </section>
      ) : null; })()}

      {(() => { const c6f = chase6Filter; const filtered6 = c6f === "全关" ? [] : c6f === "TOP2" ? chaseSixSignals.filter(item => item.isStrong || item.isWaveStrong) : c6f === "TOP1" ? chaseSixSignals.filter(item => item.isWaveStrong) : chaseSixSignals; return filtered6.length > 0 ? (
        <section className="chase6-signal-area" aria-label="追6信号">
          {filtered6.map((item) => (
            <div
              className={`chase6-signal-item ${item.isStrong ? "chase6-hq" : ""} ${item.isWaveStrong ? "chase6-wave" : ""} ${item.isNew ? "" : "chase6-active"}`}
              key={`chase6-${item.wi}`}
              onClick={() => { setPredictionTab("chase6"); setPredictionWindowOpen(true); }}
              role="button"
              tabIndex={0}
            >
              <strong className="chase6-label">{item.windowName}</strong>
              <span className="chase6-chase">
                <span className="chase6-dots">
                  {Array.from({ length: item.chaseLen }, (_, i) => i + 1).map((n) => (
                    <span key={n} className={`chase6-dot ${n <= item.round ? "filled" : ""}`} />
                  ))}
                </span>
                <span className="chase6-bet">{item.betAmt}</span>
                <span className="chase6-stars" style={item.isStrong ? undefined : { visibility: "hidden" }}>{item.isWaveStrong ? "★★" : "★"}</span>
              </span>
            </div>
          ))}
        </section>
      ) : null; })()}

      {(() => { const c3f = chase3Filter; const filtered3 = c3f === "全关" ? [] : c3f === "TOP2" ? chaseThreeSignals.filter(item => item.isStar1 || item.isStar2) : c3f === "TOP1" ? chaseThreeSignals.filter(item => item.isStar2) : chaseThreeSignals; return filtered3.length > 0 ? (
        <section className="chase3-signal-area" aria-label="追3信号">
          {filtered3.map((item) => (
            <div
              className={`chase3-signal-item ${item.isStar1 ? "chase3-star1" : ""} ${item.isStar2 ? "chase3-star2" : ""} ${item.isNew ? "" : "chase3-active"}`}
              key={`chase3-${item.wi}`}
              onClick={() => { setPredictionTab("chase3"); setPredictionWindowOpen(true); }}
              role="button"
              tabIndex={0}
            >
              <strong className="chase3-label">{item.streetName}</strong>
              <span className="chase3-chase">
                <span className="chase3-gap">冷{item.triggerGap}</span>
                <span className="chase3-bet">{item.betAmt}</span>
                <span className="chase3-stars" style={(item.isStar1 || item.isStar2) ? undefined : { visibility: "hidden" }}>{item.isStar2 ? "★★" : "★"}</span>
              </span>
            </div>
          ))}
        </section>
      ) : null; })()}

      {(() => {
        const filteredPreferredNumber = canUsePreferredNumber && showPreferredNumber ? preferredNumberSignals : [];
        const filteredHotNumber = showHotNumber && hotNumberSignal ? [hotNumberSignal] : [];
        return filteredPreferredNumber.length > 0 || filteredHotNumber.length > 0 ? (
          <section className="repeat-signal-area" aria-label="单号信号">
            {filteredHotNumber.map((item) => (
              <div
                className="repeat-signal-item repeat-hot"
                key={`hot-${item.number}`}
                onClick={() => { setPredictionTab("hotNumber"); setPredictionWindowOpen(true); }}
                role="button"
                tabIndex={0}
              >
                <span className="repeat-tier-badge hot-badge">{item.mode === "short" ? "热门S" : "热门"}</span>
                <strong className="repeat-number">{item.number}</strong>
              </div>
            ))}
            {filteredPreferredNumber.map((item, index) => (
              <div
                className="repeat-signal-item repeat-preferred"
                key={`preferred-${index}-${item.numbers.join("-")}`}
                onClick={() => { setPredictionTab("preferredNumber"); setPredictionWindowOpen(true); }}
                role="button"
                tabIndex={0}
              >
                <span className="repeat-tier-badge">优选</span>
                <span className="preferred-number-picks">
                  {item.numbers.map((value) => (
                    <strong className="repeat-number" key={value}>{value}</strong>
                  ))}
                </span>
              </div>
            ))}
          </section>
        ) : null;
      })()}

      {keyboardVisible ? (
      <section className="input-dock" aria-label="号码输入">
        <div className="dock-actions">
          <button disabled={sharedLoading || numbers.length === 0} onClick={() => { ensureSharedConnected((u, p) => { setConfirmDialog({ title: "传输数据", message: "要把当前数据上传到传输数据中吗？", confirmFirst: true, confirmText: "上传", onConfirm: () => void uploadCurrentTransfer(u, p) }); }); }} type="button">传递</button>
          <button disabled={numbers.length === 0} onClick={openConnectDialog} type="button">接上</button>
          <button onClick={openImportDialog} type="button">导入</button>
          <button disabled={!hasUnsavedChanges} onClick={openSaveDialog} type="button">保存</button>
          <button disabled={numbers.length === 0} onClick={openSaveAsDialog} type="button">另存</button>
          <button disabled={numbers.length === 0} onClick={() => void exportCurrentData()} type="button">导出</button>
          <button onClick={openDataDialog} type="button">数据</button>
        </div>
        <div className="dock-actions dock-actions-primary">
          <button onClick={() => setPredictionWindowOpen(true)} type="button">预测</button>
          <button onClick={() => { setStatsTab("game"); setStatsViewOpen(true); }} type="button">打法</button>
          <button onClick={() => { setStatsTab(statsGroupTab); setStatsViewOpen(true); }} type="button">行组</button>
          <button onClick={() => setNumberZoneOpen(true)} type="button">号码</button>
          <button onClick={() => setSixNumberViewOpen(true)} type="button">快照</button>
          <button onClick={() => { setStatsTab("other"); setStatsViewOpen(true); }} type="button">其它</button>
          <button onClick={openConfigView} type="button">配置</button>
        </div>

        {keyboardMode === "keypad" ? (
          <div className="keypad-grid portrait-keypad">
            {keypadRows.flat().map((value) => (
              <NumberButton key={value} value={value} onClick={addNumber} />
            ))}
            <NumberButton className="zero-key keypad-zero-h" value={0} onClick={addNumber} />
            <button className="control-button wide-control" onClick={undoAll} disabled={numbers.length === 0} title="退到头">
              <SkipBack size={16} />
            </button>
            <button className="control-button skip-control keypad-redo" onClick={redoAll} disabled={redoNumbers.length === 0} title="进到底">
              <SkipForward size={16} />
            </button>
            <button className="control-button wide-control" onClick={undo} disabled={numbers.length === 0}>
              ←
            </button>
            <button className="control-button wide-control keypad-redo" onClick={redo} disabled={redoNumbers.length === 0}>
              →
            </button>
            <button
              className="control-button wide-control"
              onClick={() => setKeyboardMode("board")}
            >
              切换键盘
            </button>
            <button className="control-button skip-control" onClick={() => setKeyboardVisible(false)}>
              X
            </button>
          </div>
        ) : (
          <div className="board-grid">
            {boardRows.flat().map((value) => (
              <NumberButton key={value} value={value} onClick={addNumber} />
            ))}
            <button className="control-button board-wide-2" onClick={undoAll} disabled={numbers.length === 0} title="退到头">
              <SkipBack size={16} />
            </button>
            <button className="control-button" onClick={redoAll} disabled={redoNumbers.length === 0} title="进到底">
              <SkipForward size={16} />
            </button>
            <NumberButton className="board-wide-2 zero-key" value={0} onClick={addNumber} />
            <button
              className="control-button board-wide-2"
              onClick={undo}
              disabled={numbers.length === 0}
            >
              ←
            </button>
            <button className="control-button board-wide-2" onClick={redo} disabled={redoNumbers.length === 0}>
              →
            </button>
            <button
              className="control-button board-wide-2"
              onClick={() => setKeyboardMode("keypad")}
            >
              切换键盘
            </button>
            <button className="control-button" onClick={() => setKeyboardVisible(false)}>
              X
            </button>
          </div>
        )}
      </section>
      ) : (
        <button
          className="keyboard-reopen"
          onClick={() => setKeyboardVisible(true)}
          type="button"
          aria-label="显示键盘"
        >
          <Keyboard aria-hidden="true" size={22} strokeWidth={2.2} />
        </button>
      )}

      {dataViewOpen ? (
        <section className="data-screen" aria-label="保存的数据">
            <header className="data-screen-head">
              <strong>保存的数据</strong>
            <button className="close-button title-close-button" onClick={() => setDataViewOpen(false)} type="button">x</button>
            </header>
          <div className="stats-tabs data-tabs" aria-label="数据来源">
            <button className={dataTab === "local" ? "selected" : ""} onClick={() => setDataTab("local")} type="button">本地数据</button>
            <button className={dataTab === "shared" ? "selected" : ""} onClick={() => setDataTab("shared")} type="button">共享数据</button>
            <button className={dataTab === "transfer" ? "selected" : ""} onClick={() => { setDataTab("transfer"); if (sharedConnected) void reloadTransferData(); }} type="button">临时数据</button>
          </div>
          {dataTab === "local" ? (
            <>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th onClick={() => sortDataView("name")}>
                    名称 <SortMark active={sessionSortField === "name"} direction={sessionSortDirection} />
                  </th>
                  <th onClick={() => sortDataView("count")}>
                    量 <SortMark active={sessionSortField === "count"} direction={sessionSortDirection} />
                  </th>
                  <th onClick={() => sortDataView("sharedUploader")}>
                    ID <SortMark active={sessionSortField === "sharedUploader"} direction={sessionSortDirection} />
                  </th>
                  <th onClick={() => sortDataView("time")}>
                    时间 <SortMark active={sessionSortField === "time"} direction={sessionSortDirection} />
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedSessions.length === 0 ? (
                  <tr>
                    <td className="data-empty" colSpan={4}>暂无保存的数据</td>
                  </tr>
                ) : null}
                {sortedSessions.map((session) => (
                  <tr
                    className={selectedSessionIds.includes(session.id) ? "selected" : ""}
                    key={session.id}
                    onClick={() => toggleSessionSelection(session.id)}
                  >
                    <td>{session.name}</td>
                    <td>{session.numbers.length}</td>
                    <td>{session.sharedUploader ?? ""}</td>
                    <td>{formatSessionTime(session.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(() => {
            const totalNums = sortedSessions.reduce((sum, s) => sum + s.numbers.length, 0);
            const thisYear = new Date().getFullYear();
            const years = [thisYear, thisYear - 1, thisYear - 2];
            const yearCounts: Record<number, { sessions: number; numbers: number }> = {};
            for (const y of years) yearCounts[y] = { sessions: 0, numbers: 0 };
            for (const s of sortedSessions) {
              const t = s.updatedAt ? new Date(s.updatedAt).getFullYear() : null;
              if (t && yearCounts[t]) {
                yearCounts[t].sessions += 1;
                yearCounts[t].numbers += s.numbers.length;
              }
            }
            return (
              <div className="data-summary-row">
                <span className="data-summary-total"><strong>{sortedSessions.length}</strong> / <span className="data-summary-nums">{totalNums}</span></span>
                {years.map((y) => (
                  yearCounts[y].sessions > 0 ? (
                    <span key={y}><span className="data-summary-year">{y}</span> <strong>{yearCounts[y].sessions}</strong> / <span className="data-summary-nums">{yearCounts[y].numbers}</span></span>
                  ) : null
                ))}
              </div>
            );
          })()}
          <footer className="data-screen-actions data-actions-stack">
            <div className="data-actions-full">
              <button
                disabled={sortedSessions.length === 0}
                onClick={() =>
                  setSelectedSessionIds(
                    selectedSessionIds.length === sortedSessions.length
                      ? []
                      : sortedSessions.map((s) => s.id),
                  )
                }
                type="button"
              >
                全选
              </button>
              <button disabled={selectedSessionIds.length !== 1} onClick={() => { const s = sortedSessions.find((x) => x.id === selectedSessionIds[0]); if (s) openSession(s); }} type="button">
                打开
              </button>
              <button disabled={selectedSessionIds.length !== 1} onClick={() => { const s = sortedSessions.find((x) => x.id === selectedSessionIds[0]); if (s) renameSession(s); }} type="button">
                更名
              </button>
              <button
                disabled={selectedSessionIds.length !== 1}
                onClick={() => { const s = sortedSessions.find((x) => x.id === selectedSessionIds[0]); if (s) editSession(s); }}
                type="button"
              >
                编辑
              </button>
              <button
                disabled={selectedSessionIds.length < 1}
                onClick={() =>
                  setConfirmDialog({
                    title: "请确认",
                    message: "确定要删除当前选中的数据吗？",
                    confirmText: "删除",
                    onConfirm: () => deleteSessions(sortedSessions.filter((s) => selectedSessionIds.includes(s.id))),
                  })
                }
                type="button"
              >
                删除
              </button>
            </div>
            <div className="data-actions-full">
              <button
                disabled={selectedSessionIds.length !== 2}
                onClick={() => openSessionMerge(sortedSessions.filter((s) => selectedSessionIds.includes(s.id)))}
                type="button"
              >
                合并
              </button>
              <button
                onClick={() => {
                  setImportMode("files");
                  setDataText("");
                  setDialogMessage("");
                  setActiveDialog("import");
                }}
                type="button"
              >
                导入
              </button>
              <button disabled={sortedSessions.length === 0} onClick={() => openExportDialog()} type="button">
                导出
              </button>
              <button disabled={selectedSessionIds.length === 0} onClick={() => { ensureSharedConnected((u, p) => void uploadLocalToShared(u, p)); }} type="button">上传</button>
              <button onClick={openToolsDialog} type="button">工具</button>
            </div>
          </footer>
            </>
          ) : dataTab === "shared" ? (
            <>
              <div className="shared-data-body">
                {sharedConnected ? (
                  <div className="data-table-wrap shared-data-table-wrap">
                    <table className="data-table shared-data-table">
                      <thead>
                        <tr>
                          <th onClick={() => sortSharedView("name")}>
                            名称 <SortMark active={sharedSortField === "name"} direction={sharedSortDirection} />
                          </th>
                          <th onClick={() => sortSharedView("count")}>
                            量 <SortMark active={sharedSortField === "count"} direction={sharedSortDirection} />
                          </th>
                          <th onClick={() => sortSharedView("user")}>
                            ID <SortMark active={sharedSortField === "user"} direction={sharedSortDirection} />
                          </th>
                          <th onClick={() => sortSharedView("time")}>
                            时间 <SortMark active={sharedSortField === "time"} direction={sharedSortDirection} />
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedSharedSessions.length === 0 ? (
                          <tr>
                            <td className="data-empty" colSpan={4}>暂无共享数据</td>
                          </tr>
                        ) : null}
                        {sortedSharedSessions.map((session) => (
                          <tr
                            className={selectedSharedSessionIds.includes(session.id) ? "selected" : ""}
                            key={session.id}
                            onClick={() => setSelectedSharedSessionIds((prev) => prev.includes(session.id) ? prev.filter((id) => id !== session.id) : [...prev, session.id])}
                          >
                            <td>{session.name}</td>
                            <td>{session.numbers.length}</td>
                            <td>{session.uploader}</td>
                            <td>{formatSessionTime(session.updatedAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="shared-data-empty">
                    <strong>共享数据尚未连接</strong>
                    <span>连接后可以查看、上传和导入共享数据。</span>
                    <button onClick={() => setSharedLoginOpen(true)} type="button">连接共享库</button>
                  </div>
                )}
              </div>
              <footer className="data-screen-actions data-actions-stack">
                <div className="data-actions-shared-row">
                  <button
                    disabled={!sharedConnected || sharedLoading || sortedSharedSessions.length === 0}
                    onClick={() =>
                      setSelectedSharedSessionIds(
                        selectedSharedSessionIds.length === sortedSharedSessions.length
                          ? []
                          : sortedSharedSessions.map((s) => s.id),
                      )
                    }
                    type="button"
                  >
                    全选
                  </button>
                  <button disabled={!sharedConnected || sharedLoading || selectedSharedSessionIds.length === 0} onClick={() => void removeSharedData()} type="button">删除</button>
                  <button disabled={!sharedConnected || sharedLoading} onClick={() => { ensureSharedConnected((u, p) => void reloadSharedData(u, p)); }} type="button">刷新</button>
                </div>
                <div className="data-actions-shared-row">
                  <button disabled={!sharedConnected || sharedLoading || numbers.length === 0} onClick={() => { ensureSharedConnected((u, p) => void uploadSharedData(undefined, u, p)); }} type="button">上传当前</button>
                  <button disabled={!sharedConnected || sharedLoading || selectedSharedSessionIds.length === 0} onClick={() => void importSharedToLocal()} type="button">导入本地</button>
                  <button disabled={!sharedConnected || sharedLoading} onClick={() => { setSharedConnected(false); setSharedSessions([]); setSelectedSharedSessionIds([]); localStorage.removeItem(savedLoginKey); }} type="button">退出登录</button>
                </div>
              </footer>
            </>
          ) : (
            <>
              <div className="shared-data-body">
                {sharedConnected ? (
                  <div className="data-table-wrap shared-data-table-wrap">
                    <table className="data-table transfer-data-table">
                      <thead>
                        <tr>
                          <th>量</th>
                          <th>ID</th>
                          <th>时间</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transferSessions.length === 0 ? (
                          <tr>
                            <td className="data-empty" colSpan={3}>暂无传输数据</td>
                          </tr>
                        ) : null}
                        {transferSessions.map((item) => (
                          <tr
                            className={selectedTransferIds.includes(item.id) ? "selected" : ""}
                            key={item.id}
                            onClick={() => setSelectedTransferIds((prev) => prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id])}
                          >
                            <td>{item.numbers.length}</td>
                            <td>{item.uploader}</td>
                            <td>{formatSessionTime(item.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="shared-data-empty">
                    <strong>传输数据尚未连接</strong>
                    <span>连接后可以查看最近 10 条传输数据。</span>
                    <button onClick={() => setSharedLoginOpen(true)} type="button">连接共享库</button>
                  </div>
                )}
              </div>
              <footer className="data-screen-actions transfer-data-actions">
                <button
                  disabled={!sharedConnected || sharedLoading || transferSessions.length === 0}
                  onClick={() =>
                    setSelectedTransferIds(
                      selectedTransferIds.length === transferSessions.length
                        ? []
                        : transferSessions.map((s) => s.id),
                    )
                  }
                  type="button"
                >
                  全选
                </button>
                <button disabled={!sharedConnected || sharedLoading || selectedTransferIds.length === 0} onClick={importTransferData} type="button">导入当前</button>
                <button disabled={!sharedConnected || sharedLoading || selectedTransferIds.length === 0} onClick={removeTransferData} type="button">删除</button>
                <button disabled={!sharedConnected || sharedLoading} onClick={() => { ensureSharedConnected((u, p) => void reloadTransferData(u, p)); }} type="button">刷新</button>
              </footer>
            </>
          )}
        </section>
      ) : null}

      {gameViewOpen ? (
        <section className="data-screen game-screen" aria-label="打法统计">
          <header className="data-screen-head">
            <strong>打法统计</strong>
            <button className="close-button title-close-button" onClick={() => setGameViewOpen(false)} type="button">x</button>
          </header>
          <div className="data-table-wrap">
            <table className="data-table game-table">
              <thead>
                <tr>
                  <th onClick={() => sortGameView("name")}>
                    名称 <SortMark active={gameSortField === "name"} direction={gameSortDirection} />
                  </th>
                  <th>完成</th>
                  <th onClick={() => sortGameView("won")}>
                    赢 <SortMark active={gameSortField === "won"} direction={gameSortDirection} />
                  </th>
                  <th>平</th>
                  <th>输</th>
                  <th onClick={() => sortGameView("balance")}>
                    结算 <SortMark active={gameSortField === "balance"} direction={gameSortDirection} />
                  </th>
                  <th onClick={() => sortGameView("live")}>
                    实时 <SortMark active={gameSortField === "live"} direction={gameSortDirection} />
                  </th>
                </tr>
              </thead>
              <tbody>
                {numbers.length === 0 ? (
                  <tr>
                    <td className="data-empty" colSpan={7}>暂无可统计的数据</td>
                  </tr>
                ) : null}
                {numbers.length > 0 && gameStats.length === 0 ? (
                  <tr>
                    <td className="data-empty" colSpan={7}>暂无启用的打法</td>
                  </tr>
                ) : null}
                {numbers.length > 0
                  ? gameStats.map((item) => (
                      <tr key={item.name}>
                        <td>{item.name}</td>
                        <td>{item.completed}</td>
                        <td className="td-won">{item.won}</td>
                        <td className="td-drew">{item.drew}</td>
                        <td className="td-lost">{item.lost}</td>
                        <td>{item.balance}</td>
                        <td>{item.live}</td>
                      </tr>
                    ))
                  : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {sixNumberViewOpen ? (
        <section className="data-screen six-number-screen" aria-label="行组快照">
          <header className="data-screen-head">
            <strong>行组快照</strong>
            <button className="close-button title-close-button" onClick={() => setSixNumberViewOpen(false)} type="button">x</button>
          </header>
          <div className="group-block-body">
            <div className="group-block-head" aria-hidden="true">
              <span>组</span><span>6数字</span><span>3数字</span><span>号码</span>
            </div>
            <div className="group-block-grid">
              {threeNumberSnapshot.map((item) => (
                <div className={`group-block-row${item.highlighted ? " highlighted" : ""}`} key={`row-${item.wi}`} style={{ gridRow: `${item.wi + 1}` }}>
                  {[chaseThreeStreetStart(item.wi), chaseThreeStreetStart(item.wi) + 1, chaseThreeStreetEnd(item.wi)].map((value) => (
                    <span className={latestNumber === value ? "current" : ""} key={value}>{value}</span>
                  ))}
                </div>
              ))}
              <div className="group-block-row-stats" style={{ gridRow: "13" }}>
                {rowBlockSnapshot.map((item) => (
                  <div className={`group-block-row-stat${item.highlighted ? " highlighted" : ""}`} key={item.ri}>
                    <span className="group-block-row-label">{item.label}</span>
                    <strong>{renderGroupBlockDistance(item)}</strong>
                  </div>
                ))}
              </div>
              {threeNumberSnapshot.map((item) => (
                <div className={`group-block-cell group-block-x${item.highlighted ? " highlighted" : ""}`} key={`x-${item.wi}`} style={{ gridRow: `${item.wi + 1}` }}>
                  {renderGroupBlockDistance(item)}
                </div>
              ))}
              {sixNumberSnapshot.map((item) => (
                <div
                  className={`group-block-cell group-block-y${item.highlighted ? " highlighted" : ""}`}
                  key={`y-${item.wi}`}
                  style={{ gridRow: `${item.wi + 1} / span 2` }}
                >
                  {renderGroupBlockDistance(item)}
                </div>
              ))}
              {groupBlockSnapshot.map((item) => (
                <div className={`group-block-cell group-block-z${item.highlighted ? " highlighted" : ""}`} key={`z-${item.gi}`} style={{ gridRow: `${item.gi * 4 + 1} / span 4` }}>
                  {renderGroupBlockDistance(item)}
                </div>
              ))}
              <button
                className="number-zone-trigger"
                onClick={() => setNumberZoneOpen(true)}
                style={{ gridColumn: "4", gridRow: "1 / 14", opacity: 0, cursor: "pointer" }}
                title="打开号码区"
                type="button"
              >
                号码区
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {numberZoneOpen ? (
        <section className="data-screen number-zone-screen" aria-label="号码区">
          <header className="data-screen-head">
            <strong>号码</strong>
            <button className="close-button title-close-button" onClick={() => setNumberZoneOpen(false)} type="button">x</button>
          </header>
          <div className="number-zone-body" onClick={() => { setNumberZoneOpen(false); setSixNumberViewOpen(true); }}>
            <div className="number-zone-grid">
              <div className="number-zone-zero-row">
                <div className={`number-zone-cell zero-cell${latestNumber === 0 ? " current" : ""}`}>
                  <span className="number-zone-value">0</span>
                  <span className="number-zone-distance">
                    {numberZoneMode === "distance" && latestNumber === 0 && numberZoneData[0]?.prevDistance !== null
                      ? `(${numberZoneData[0].prevDistance})`
                      : numberZoneData[0]?.value ?? "-"}
                  </span>
                </div>
              </div>
              {Array.from({ length: 12 }, (_, wi) => (
                <div className="number-zone-row" key={wi}>
                  {[chaseThreeStreetStart(wi), chaseThreeStreetStart(wi) + 1, chaseThreeStreetEnd(wi)].map((value) => {
                    const nd = numberZoneData[value];
                    const showPrev = numberZoneMode === "distance" && nd?.isLatest && nd?.prevDistance !== null;
                    const showHotCold = numberZoneMode !== "distance";
                    const isHot = showHotCold && numberZoneHotCold.hot.has(value);
                    const isCold = showHotCold && numberZoneHotCold.cold.has(value);
                    const trend = isHot ? numberZoneTrends[value] : null;
                    const cls = [
                      "number-zone-cell",
                      nd?.isLatest ? "current" : "",
                      isHot ? "hot" : "",
                      isCold ? "cold" : "",
                      trend === "up" ? "trend-up" : "",
                      trend === "down" ? "trend-down" : "",
                    ].filter(Boolean).join(" ");
                    return (
                      <div className={cls} key={value}>
                        <span className="number-zone-value">{value}</span>
                        <span className="number-zone-distance">
                          {showPrev ? `(${nd!.prevDistance})` : nd?.value ?? "-"}
                          {trend && <span className={`number-zone-trend ${trend}`}> {trend === "up" ? "▲" : "▼"}</span>}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <div className="number-zone-tabs">
            {["distance", "1", "2", "3", "5", "all"].map((mode) => (
              <button
                className={`number-zone-tab${numberZoneMode === mode ? " selected" : ""}`}
                key={mode}
                onClick={() => {
                  setNumberZoneMode(mode);
                  localStorage.setItem("londoner.numberZoneMode", mode);
                }}
                type="button"
              >
                {mode === "distance" ? "距离" : mode === "all" ? "全部" : `${mode}圈`}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {colRowViewOpen ? (
        <section className="data-screen colrow-screen" aria-label="行组距离数据">
          <header className="data-screen-head">
            <strong>行组距离数据</strong>
            <button className="close-button title-close-button" onClick={() => setColRowViewOpen(false)} type="button">x</button>
          </header>
          <div className="colrow-body">
            <div className="stats-tabs">
              <button className={colRowTab === "detail" ? "selected" : ""} onClick={() => setColRowTab("detail")} type="button">
                明细
              </button>
              <button className={colRowTab === "chart" ? "selected" : ""} onClick={() => setColRowTab("chart")} type="button">
                统计图
              </button>
              <button className={colRowTab === "summary" ? "selected" : ""} onClick={() => setColRowTab("summary")} type="button">
                统计数据
              </button>
            </div>
            {colRowTab === "detail" ? <ColRowDetailView items={colRowDetailItems} /> : null}
            {colRowTab === "chart" ? <ColRowChartView items={colRowStats.rows.slice(0, 8)} scope={effectiveColRowScope} /> : null}
            {colRowTab === "summary" ? (
              <ColRowSummaryView
                items={colRowStats.rows.slice(0, 8)}
                key={`colrow-summary-${colRowScope}-${numbers.length}`}
                results={colRowExploreResults}
                selectedRounds={colRowExploreRounds}
                selectedRows={colRowExploreRows}
                toggleRound={toggleColRowExploreRound}
                toggleRow={toggleColRowExploreRow}
              />
            ) : null}
          </div>
          <footer className="stats-bottom-actions">
          {colRowTab === "detail" ? null : (
            <div className="data-screen-actions colrow-scope-actions" aria-label="行组统计范围">
              {colRowScopes.map((value) => (
                <button
                  className={value === colRowScope ? "selected" : ""}
                  key={value}
                  onClick={() => setColRowScope(value)}
                  type="button"
                >
                  {value < 0 ? "全部" : value}
                </button>
              ))}
            </div>
          )}
            <div className="data-screen-actions stats-nav-actions" aria-label="统计页面">
              <button
                onClick={openGameView}
                type="button"
              >
                打法
              </button>
              <button className="selected" type="button">行组</button>
              <button
                onClick={openFrequencyView}
                type="button"
              >
                频率
              </button>
              <button onClick={openDistanceView} type="button">距离</button>
              <button onClick={openRefineView} type="button">细化</button>
              <button onClick={() => setPredictionWindowOpen(true)} type="button">预测</button>
              <button onClick={openOtherView} type="button">其它</button>
            </div>
          </footer>
        </section>
      ) : null}

      {frequencyViewOpen ? (
        <section className="data-screen frequency-screen" aria-label="频率统计图">
          <header className="data-screen-head">
            <strong>频率统计图</strong>
            <button className="close-button title-close-button" onClick={() => setFrequencyViewOpen(false)} type="button">x</button>
          </header>
          <div className={`frequency-body ${frequencyDetailKey === null ? "frequency-overview-body" : "frequency-detail-body"}`}>
            {frequencyDetailKey === null ? (
              <FrequencyOverviewChart
                frequencyStats={frequencyStats}
                onSelect={(key) => setFrequencyDetailKey(key)}
                scopeIndex={frequencyScopeIndex}
              />
            ) : (
              <>
                <div className="data-screen-actions frequency-detail-actions" aria-label="频率明细行组">
                  {frequencyDetailKeys.map((key) => (
                    <button
                      className={key === frequencyDetailKey ? "selected" : ""}
                      key={key}
                      onClick={() => setFrequencyDetailKey(key)}
                      type="button"
                    >
                      {frequencyBandLabels[key]}
                    </button>
                  ))}
                </div>
                <FrequencyDetailChart
                  frequencyScopes={frequencyScopes}
                  frequencyStats={frequencyStats}
                  onBack={() => setFrequencyDetailKey(null)}
                  selectedKey={frequencyDetailKey}
                />
              </>
            )}
          </div>
          <footer className="stats-bottom-actions">
            {frequencyDetailKey === null ? (
              <div className="data-screen-actions frequency-scope-actions" aria-label="频率统计范围">
                {frequencyScopes.map((value, index) => (
                  <button
                    className={index === frequencyScopeIndex ? "selected" : ""}
                    key={value}
                    onClick={() => setFrequencyScopeIndex(index)}
                    type="button"
                  >
                    {value}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="data-screen-actions stats-nav-actions" aria-label="统计页面">
              <button
                onClick={openGameView}
                type="button"
              >
                打法
              </button>
              <button
                onClick={openColRowView}
                type="button"
              >
                行组
              </button>
              <button className="selected" type="button">频率</button>
              <button onClick={openDistanceView} type="button">距离</button>
              <button onClick={openRefineView} type="button">细化</button>
              <button onClick={() => setPredictionWindowOpen(true)} type="button">预测</button>
              <button onClick={openOtherView} type="button">其它</button>
            </div>
          </footer>
        </section>
      ) : null}

      {distanceViewOpen ? (
        <section className="data-screen distance-screen" aria-label="距离统计图">
          <header className="data-screen-head">
            <strong>距离统计图</strong>
            <button className="close-button title-close-button" onClick={() => setDistanceViewOpen(false)} type="button">x</button>
          </header>
          <div className="distance-body">
            <DistanceOverviewChart distances={distanceStats} onSelect={(key) => setDistanceDetailKey(key)} />
          </div>
          <footer className="stats-bottom-actions">
            <div className="data-screen-actions stats-nav-actions" aria-label="统计页面">
              <button onClick={openGameView} type="button">打法</button>
              <button onClick={openColRowView} type="button">行组</button>
              <button onClick={openFrequencyView} type="button">频率</button>
              <button className="selected" type="button">距离</button>
              <button onClick={openRefineView} type="button">细化</button>
              <button onClick={openOtherView} type="button">其它</button>
            </div>
          </footer>
          {distanceDetailKey !== null ? (
            <div className="distance-detail-backdrop" onClick={() => setDistanceDetailKey(null)} role="button" tabIndex={0}>
              <DistanceSingleChart distances={distanceStats} selectedKey={distanceDetailKey} />
            </div>
          ) : null}
        </section>
      ) : null}

      {refineViewOpen ? (
        <section className="data-screen refine-screen" aria-label="行组细化数据">
          <header className="data-screen-head">
            <strong>行组细化数据</strong>
            <button className="close-button title-close-button" onClick={() => setRefineViewOpen(false)} type="button">x</button>
          </header>
          <div className="refine-body">
            <div className="stats-tabs refine-tabs">
              <button className={refineTab === "compare" ? "selected" : ""} onClick={() => setRefineTab("compare")} type="button">
                各行各组比较
              </button>
              <button className={refineTab === "detail" ? "selected" : ""} onClick={() => setRefineTab("detail")} type="button">
                行组细化数据
              </button>
            </div>
            {refineTab === "compare" ? (
              <div className="refine-compare">
                <div className="refine-rounds" aria-label="细化轮次">
                  <div className="refine-round-row">
                    <span>从第几轮开始：</span>
                    <div className="data-screen-actions refine-round-actions">
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((value) => (
                        <button
                          className={value === refineRoundStart ? "selected" : ""}
                          key={value}
                          onClick={() => setRefineRoundStart(value)}
                          type="button"
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="refine-round-row">
                    <span>打几轮：</span>
                    <div className="data-screen-actions refine-round-actions">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
                        <button
                          className={value === refineRoundBet ? "selected" : ""}
                          key={value}
                          onClick={() => setRefineRoundBet(value)}
                          type="button"
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <table className="refine-table">
                  <thead>
                    <tr>
                      <th>
                        <button onClick={() => sortRefineView("name")} type="button">
                          行组{refineSortField === "name" ? <SortMark active direction={refineSortDirection} /> : null}
                        </button>
                      </th>
                      <th>
                        <button onClick={() => sortRefineView("succeeded")} type="button">
                          成功{refineSortField === "succeeded" ? <SortMark active direction={refineSortDirection} /> : null}
                        </button>
                      </th>
                      <th>失败</th>
                      <th>
                        <button onClick={() => sortRefineView("failureRate")} type="button">
                          失败率{refineSortField === "failureRate" ? <SortMark active direction={refineSortDirection} /> : null}
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {refineCompareRows.map((item) => (
                      <tr key={item.key}>
                        <th>{item.label}</th>
                        <td>{item.succeeded}</td>
                        <td>{item.failed}</td>
                        <td>{(item.failureRate * 100).toFixed(2)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="refine-detail-empty" aria-label="行组细化数据" />
            )}
          </div>
          <footer className="stats-bottom-actions">
            <div className="data-screen-actions colrow-scope-actions" aria-label="细化统计范围">
              {colRowScopes.map((value) => (
                <button
                  className={value === refineScope ? "selected" : ""}
                  key={value}
                  onClick={() => setRefineScope(value)}
                  type="button"
                >
                  {value < 0 ? "全部" : value}
                </button>
              ))}
            </div>
            <div className="data-screen-actions stats-nav-actions" aria-label="统计页面">
              <button onClick={openGameView} type="button">打法</button>
              <button onClick={openColRowView} type="button">行组</button>
              <button onClick={openFrequencyView} type="button">频率</button>
              <button onClick={openDistanceView} type="button">距离</button>
              <button className="selected" type="button">细化</button>
              <button onClick={openOtherView} type="button">其它</button>
            </div>
          </footer>
        </section>
      ) : null}

      {otherViewOpen ? (
        <section className="data-screen other-screen" aria-label="其它统计数据">
          <header className="data-screen-head">
            <strong>其它统计数据</strong>
            <button className="close-button title-close-button" onClick={() => setOtherViewOpen(false)} type="button">x</button>
          </header>
          <div className="other-body">
            <div className="stats-tabs other-tabs">
              <button className={otherTab === "longs" ? "selected" : ""} onClick={() => setOtherTab("longs")} type="button">
                追打
              </button>
              <button className={otherTab === "numbers" ? "selected" : ""} onClick={() => setOtherTab("numbers")} type="button">
                号码
              </button>
              <button className={otherTab === "rounds" ? "selected" : ""} onClick={() => setOtherTab("rounds")} type="button">
                轮次
              </button>
            </div>

            {otherTab === "longs" ? (
              <div className="other-longs">
                <table className="other-table other-longs-table">
                  <thead>
                    <tr>
                      <th>次数</th>
                      {otherLongStats.rounds.map((round) => (
                        <th key={round}>{round}</th>
                      ))}
                      <th>NOT</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <th rowSpan={2}>{otherLongStats.total}</th>
                      {otherLongStats.wins.map((count, index) => (
                        <td key={otherLongStats.rounds[index]}>{count}</td>
                      ))}
                      <td>{otherLongStats.misses}</td>
                    </tr>
                    <tr>
                      {otherLongStats.percentages.map((percent, index) => (
                        <td key={index}>{formatPercent(percent)}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
                <div className="other-option-rows">
                  <div className="other-option-row">
                    <span>长套后轮次：</span>
                    <div className="data-screen-actions other-option-actions">
                      {otherLongBetCountOptions.map((value) => (
                        <button
                          className={value === otherLongBetCount ? "selected" : ""}
                          key={value}
                          onClick={() => setOtherLongBetCount(value)}
                          type="button"
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="other-option-row">
                    <span>长套轮次：</span>
                    <div className="data-screen-actions other-option-actions other-round-option-actions">
                      {otherLongRoundOptions.map((value) => (
                        <button
                          className={value === otherLongRound ? "selected" : ""}
                          key={value}
                          onClick={() => setOtherLongRound(value)}
                          type="button"
                        >
                          {value}+
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {otherTab === "numbers" ? (
              <div className="other-numbers">
                <table className="other-table other-numbers-table">
                  <thead>
                    <tr>
                      <th onClick={() => sortOtherNumbers("number")}>
                        号码 <SortMark active={otherNumberSortField === "number"} direction={otherNumberSortDirection} />
                      </th>
                      <th onClick={() => sortOtherNumbers("distance")}>
                        距离 <SortMark active={otherNumberSortField === "distance"} direction={otherNumberSortDirection} />
                      </th>
                      <th onClick={() => sortOtherNumbers("frequency")}>
                        次数 <SortMark active={otherNumberSortField === "frequency"} direction={otherNumberSortDirection} />
                      </th>
                      <th onClick={() => sortOtherNumbers("number")}>
                        号码 <SortMark active={otherNumberSortField === "number"} direction={otherNumberSortDirection} />
                      </th>
                      <th onClick={() => sortOtherNumbers("distance")}>
                        距离 <SortMark active={otherNumberSortField === "distance"} direction={otherNumberSortDirection} />
                      </th>
                      <th onClick={() => sortOtherNumbers("frequency")}>
                        次数 <SortMark active={otherNumberSortField === "frequency"} direction={otherNumberSortDirection} />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {otherNumberStats.rows.map((row, index) => (
                      <tr key={index}>
                        <OtherNumberCells item={row.left} />
                        <OtherNumberCells item={row.right} />
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="other-max-distance">
                  <strong>最大距离前五名：</strong>
                  {otherNumberStats.maxDistances.map((item, index) => (
                    <span key={`${item.number}-${item.distance}-${index}`}>
                      {item.number}：{item.distance}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {otherTab === "rounds" ? (
              <div className="other-rounds">
                <div className="stats-tabs other-round-tabs">
                  <button className={otherRoundTab === "bet" ? "selected" : ""} onClick={() => setOtherRoundTab("bet")} type="button">
                    轮次参考数据
                  </button>
                  <button
                    className={otherRoundTab === "summary" ? "selected" : ""}
                    onClick={() => setOtherRoundTab("summary")}
                    type="button"
                  >
                    轮次统计数据
                  </button>
                </div>
                {otherRoundTab === "bet" ? (
                  <table className="other-table other-round-bet-table">
                    <thead>
                      <tr>
                        <th>轮次</th>
                        <th>不出</th>
                        <th>概率</th>
                        {otherRoundFailedRounds.map((round) => (
                          <th key={`f-${round}`}>F{round}</th>
                        ))}
                        {otherRoundFailedRounds.map((round) => (
                          <th key={`fp-${round}`}>概率</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {otherRoundBetStats.map((item) => (
                        <tr key={item.round}>
                          <th>{item.round}</th>
                          <td>{item.notYet}</td>
                          <td>{formatPercent(item.notYetPercentage)}</td>
                          {item.failed.map((count, index) => (
                            <td key={`f-${index}`}>{count}</td>
                          ))}
                          {item.failedPercentages.map((percent, index) => (
                            <td key={`fp-${index}`}>{formatPercent(percent)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <table className="other-table other-round-summary-table">
                    <thead>
                      <tr>
                        <th rowSpan={2}>轮次</th>
                        <th colSpan={3}>组</th>
                        <th colSpan={3}>行</th>
                        <th colSpan={3}>全部</th>
                      </tr>
                      <tr>
                        <th>前</th>
                        <th>本轮</th>
                        <th>后</th>
                        <th>前</th>
                        <th>本轮</th>
                        <th>后</th>
                        <th>前</th>
                        <th>本轮</th>
                        <th>后</th>
                      </tr>
                    </thead>
                    <tbody>
                      {otherRoundSummaryStats.map((item) => (
                        <tr key={item.round}>
                          <th>{item.round}</th>
                          <td>{item.group.before}</td>
                          <td>{item.group.current}</td>
                          <td>{item.group.after}</td>
                          <td>{item.row.before}</td>
                          <td>{item.row.current}</td>
                          <td>{item.row.after}</td>
                          <td>{item.all.before}</td>
                          <td>{item.all.current}</td>
                          <td>{item.all.after}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ) : null}
          </div>
          <footer className="stats-bottom-actions">
            {otherTab === "longs" ? null : (
              <div className="data-screen-actions colrow-scope-actions" aria-label="其它统计范围">
                {colRowScopes.map((value) => (
                  <button
                    className={value === otherScope ? "selected" : ""}
                    key={value}
                    onClick={() => setOtherScope(value)}
                    type="button"
                  >
                    {value < 0 ? "全部" : value}
                  </button>
                ))}
              </div>
            )}
            <div className="data-screen-actions stats-nav-actions" aria-label="统计页面">
              <button onClick={openGameView} type="button">打法</button>
              <button onClick={openColRowView} type="button">行组</button>
              <button onClick={openFrequencyView} type="button">频率</button>
              <button onClick={openDistanceView} type="button">距离</button>
              <button onClick={openRefineView} type="button">细化</button>
              <button className="selected" type="button">其它</button>
            </div>
          </footer>
        </section>
      ) : null}

      {predictionWindowOpen ? (
          <section className="prediction-screen" aria-label="预测明细">
            <div className="modal-head">
              <strong>预测明细</strong>
              <button className="close-button" onClick={() => setPredictionWindowOpen(false)} type="button">x</button>
            </div>
            <div className="prediction-tabs">
              <button className={predictionTab === "overview" ? "selected" : ""} onClick={() => { setPredictionTab("overview"); localStorage.setItem("londoner.predictionTab", "overview"); }} type="button">总览</button>
              {canUseQuality124 ? (
                <button className={predictionTab === "quality124" ? "selected" : ""} onClick={() => { setPredictionTab("quality124"); localStorage.setItem("londoner.predictionTab", "quality124"); }} type="button">节奏</button>
              ) : null}
              <button className={predictionTab === "cold" ? "selected" : ""} onClick={() => { setPredictionTab("cold"); localStorage.setItem("londoner.predictionTab", "cold"); }} type="button">长套</button>
              <button className={predictionTab === "chase6" ? "selected" : ""} onClick={() => { setPredictionTab("chase6"); localStorage.setItem("londoner.predictionTab", "chase6"); }} type="button">追6</button>
              <button className={predictionTab === "hotNumber" ? "selected" : ""} onClick={() => { setPredictionTab("hotNumber"); localStorage.setItem("londoner.predictionTab", "hotNumber"); }} type="button">热门</button>
              {canUsePreferredNumber ? (
                <button className={predictionTab === "preferredNumber" ? "selected" : ""} onClick={() => { setPredictionTab("preferredNumber"); localStorage.setItem("londoner.predictionTab", "preferredNumber"); }} type="button">优选号</button>
              ) : null}
            </div>
            <div className="prediction-body">
              {predictionTab === "overview" ? (
                <div className={`overview-pane overview-pane-${predictionOverviewTab}`}>
                  <div className="overview-subtabs" aria-label="总览分类" role="tablist">
                    {[
                      ["repeat", "单号"],
                      ["other", "行组"],
                    ].map(([key, label]) => (
                      <button
                        aria-selected={predictionOverviewTab === key}
                        className={predictionOverviewTab === key ? "selected" : ""}
                        key={key}
                        onClick={() => { setPredictionOverviewTab(key); localStorage.setItem("londoner.predictionOverviewTab", key); }}
                        role="tab"
                        type="button"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="repeat-filter-panel" style={{ margin: "0 0 6px", padding: "6px 10px", fontSize: 13 }}>
                    <button className={`signal-toggle${entryMode200 ? " on" : ""}`} onClick={() => { const v = !entryMode200; setEntryMode200(v); localStorage.setItem("londoner.entryMode200", v ? "1" : "0"); }} type="button" />
                    <span>前200个数字为历史号码</span>
                  </div>
                  <div className="overview-cards">
                  {canUseQuality124 ? (
                  <div className="overview-card overview-quality124 overview-other-card" onClick={() => { setPredictionTab("quality124"); localStorage.setItem("londoner.predictionTab", "quality124"); }} role="button" tabIndex={0}>
                    <div className="overview-card-title">
                      <span>行组节奏</span>
                      <span className="signal-tier-group" onClick={(e) => e.stopPropagation()}>
                        <button className={`signal-toggle${showQuality124 ? " on" : ""}`} onClick={() => { const v = !showQuality124; setShowQuality124(v); localStorage.setItem("londoner.showQuality124", v ? "1" : "0"); }} type="button" />
                      </span>
                    </div>
                    <div className="prediction-roi-table" style={{ margin: 0 }}>
                      <div className="prediction-roi-row prediction-roi-header"><span>信号</span><span>总投入</span><span>总赢回</span><span>ROI</span></div>
                      <div className="prediction-roi-row">
                        <strong>{quality124Roi.signals}</strong><strong>{quality124Roi.bet}</strong><strong>{quality124Roi.win}</strong>
                        <strong className="roi-value" style={{ color: quality124Roi.roi >= 0 ? "#b85a3a" : "#5f9a70" }}>{quality124Roi.roi >= 0 ? "+" : ""}{quality124Roi.roi.toFixed(1)}%</strong>
                      </div>
                      <div className="prediction-roi-row">
                        <span className="prediction-roi-subheader">200后</span><span>{quality124RoiFrom201.bet}</span><span>{quality124RoiFrom201.win}</span>
                        <strong className="roi-value" style={{ color: quality124RoiFrom201.roi >= 0 ? "#b85a3a" : "#5f9a70" }}>{quality124RoiFrom201.roi >= 0 ? "+" : ""}{quality124RoiFrom201.roi.toFixed(1)}%</strong>
                      </div>
                      {QUALITY_124_TIER_ORDER.map((tier) => {
                        const meta = QUALITY_124_TIER_META[tier];
                        const roi = quality124.tierRois[tier];
                        const stars = meta.stars > 0 ? ` ${"★".repeat(meta.stars)}` : "";
                        return (
                          <div className="prediction-roi-row" key={tier}>
                            <span className="prediction-roi-subheader">{meta.label}{stars}</span><span>{roi.bet}</span><span>{roi.win}</span>
                            <strong className="roi-value" style={{ color: roi.roi >= 0 ? "#b85a3a" : "#5f9a70" }}>{roi.roi >= 0 ? "+" : ""}{roi.roi.toFixed(1)}%</strong>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  ) : null}
                  <div className="overview-card overview-cold overview-other-card" onClick={() => { setPredictionTab("cold"); localStorage.setItem("londoner.predictionTab", "cold"); }} role="button" tabIndex={0}>
                    <div className="overview-card-title">
                      <span>长套</span>
                      <span className="signal-tier-group" onClick={(e) => e.stopPropagation()}>
                        <button className={`signal-toggle${showCold ? " on" : ""}`} onClick={() => { const v = !showCold; setShowCold(v); localStorage.setItem("londoner.showCold", v ? "1" : "0"); }} type="button" />
                        {showCold ? (
                          <span className="signal-tier-opts">
                            {["不切换","自适应","自适应+默认行"].map(t => (
                              <button key={t} className={`signal-tier-btn${coldModeLabel === t ? " active" : ""}`} onClick={() => { const mode = t === "不切换" ? "off" : t === "自适应" ? "adaptive" : "adaptiveRow"; setColdAdaptiveMode(mode); localStorage.setItem("londoner.coldAdaptiveMode", mode); }} type="button">{t}</button>
                            ))}
                          </span>
                        ) : null}
                      </span>
                    </div>
                    <div className="prediction-roi-table" style={{ margin: 0 }}>
                      <div className="prediction-roi-row prediction-roi-header"><span>数据量</span><span>总投入</span><span>总赢回</span><span>ROI</span></div>
                      <div className="prediction-roi-row">
                        <strong>{numbers.length}</strong><strong>{coldActiveRoi.bet}</strong><strong>{coldActiveRoi.win}</strong>
                        <strong className="roi-value" style={{ color: coldActiveRoi.roi >= 0 ? "#b85a3a" : "#5f9a70" }}>{coldActiveRoi.roi >= 0 ? "+" : ""}{coldActiveRoi.roi.toFixed(1)}%</strong>
                      </div>
                      <div className="prediction-roi-row">
                        <span className="prediction-roi-subheader">ROI-仅行</span><span>{coldRowsOnlyRoi.bet}</span><span>{coldRowsOnlyRoi.win}</span>
                        <strong className="roi-value" style={{ color: coldRowsOnlyRoi.roi >= 0 ? "#b85a3a" : "#5f9a70" }}>{coldRowsOnlyRoi.roi >= 0 ? "+" : ""}{coldRowsOnlyRoi.roi.toFixed(1)}%</strong>
                      </div>
                    </div>
                  </div>
                  <div className="overview-card overview-chase6 overview-other-card" onClick={() => { setPredictionTab("chase6"); localStorage.setItem("londoner.predictionTab", "chase6"); }} role="button" tabIndex={0}>
                    <div className="overview-card-title">
                      <span>追6</span>
                      <span className="signal-tier-group" onClick={(e) => e.stopPropagation()}>
                        <button className={`signal-toggle${chase6Filter !== "全关" ? " on" : ""}`} onClick={() => { const v = chase6Filter === "全关" ? "全部" : "全关"; setChase6Filter(v); localStorage.setItem("londoner.chase6Filter", v); }} type="button" />
                        {chase6Filter !== "全关" ? (
                          <span className="signal-tier-opts">
                            {["全部","TOP2","TOP1"].map(t => (
                              <button key={t} className={`signal-tier-btn${chase6Filter === t ? " active" : ""}`} onClick={() => { setChase6Filter(t); localStorage.setItem("londoner.chase6Filter", t); }} type="button">{t}</button>
                            ))}
                          </span>
                        ) : null}
                      </span>
                    </div>
                    <div className="prediction-roi-table" style={{ margin: 0 }}>
                      <div className="prediction-roi-row prediction-roi-header"><span>数据量</span><span>总投入</span><span>总赢回</span><span>ROI</span></div>
                      <div className="prediction-roi-row">
                        <strong>{numbers.length}</strong><strong>{chaseSixRoi.bet}</strong><strong>{chaseSixRoi.win}</strong>
                        <strong className="roi-value" style={{ color: chaseSixRoi.roi >= 0 ? "#b85a3a" : "#5f9a70" }}>{chaseSixRoi.roi >= 0 ? "+" : ""}{chaseSixRoi.roi.toFixed(1)}%</strong>
                      </div>
                      <div className="prediction-roi-row">
                        <span className="prediction-roi-subheader">强信号 ★</span><span>{cs.strongRoi.bet}</span><span>{cs.strongRoi.win}</span>
                        <strong className="roi-value" style={{ color: cs.strongRoi.roi >= 0 ? "#b85a3a" : "#5f9a70" }}>{cs.strongRoi.roi >= 0 ? "+" : ""}{cs.strongRoi.roi.toFixed(1)}%</strong>
                      </div>
                      <div className="prediction-roi-row">
                        <span className="prediction-roi-subheader">波浪过滤 ★★</span><span>{cs.waveStrongRoi.bet}</span><span>{cs.waveStrongRoi.win}</span>
                        <strong className="roi-value" style={{ color: cs.waveStrongRoi.roi >= 0 ? "#b85a3a" : "#5f9a70" }}>{cs.waveStrongRoi.roi >= 0 ? "+" : ""}{cs.waveStrongRoi.roi.toFixed(1)}%</strong>
                      </div>
                    </div>
                  </div>
                  <div className="overview-card overview-hot overview-repeat-card" onClick={() => { setPredictionTab("hotNumber"); localStorage.setItem("londoner.predictionTab", "hotNumber"); }} role="button" tabIndex={0}>
                    <div className="overview-card-title">
                      <span>热门</span>
                      <span className="signal-tier-group" onClick={(e) => e.stopPropagation()}>
                        <button className={`signal-toggle${showHotNumber ? " on" : ""}`} onClick={() => { const v = !showHotNumber; setShowHotNumber(v); localStorage.setItem("londoner.showHotNumber", v ? "1" : "0"); }} type="button" />
                      </span>
                    </div>
                    <div className="prediction-roi-table" style={{ margin: 0 }}>
                      <div className="prediction-roi-row prediction-roi-header"><span>信号</span><span>总投入</span><span>总赢回</span><span>ROI</span></div>
                      <div className="prediction-roi-row">
                        <strong>{hotNumberRoi.signals}</strong><strong>{hotNumberRoi.bet}</strong><strong>{hotNumberRoi.win}</strong>
                        <strong className="roi-value" style={{ color: hotNumberRoi.roi >= 0 ? "#b85a3a" : "#5f9a70" }}>{hotNumberRoi.roi >= 0 ? "+" : ""}{hotNumberRoi.roi.toFixed(1)}%</strong>
                      </div>
                      <div className="prediction-roi-row">
                        <span className="prediction-roi-subheader">200后</span><span>{hotNumberRoiFrom201.bet}</span><span>{hotNumberRoiFrom201.win}</span>
                        <strong className="roi-value" style={{ color: hotNumberRoiFrom201.roi >= 0 ? "#b85a3a" : "#5f9a70" }}>{hotNumberRoiFrom201.roi >= 0 ? "+" : ""}{hotNumberRoiFrom201.roi.toFixed(1)}%</strong>
                      </div>
                      {hotNumberSignal ? (
                        <div className="prediction-roi-row">
                          <span className="prediction-roi-subheader">当前({hotNumberSignal.mode === "short" ? "短热" : "长热"})</span><span>{hotNumberSignal.number}</span><span>148:{hotNumberSignal.count148}</span><span>{hotNumberSignal.seg1}/{hotNumberSignal.seg2}/{hotNumberSignal.seg3}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  {canUsePreferredNumber ? (
                  <div className="overview-card overview-preferred overview-repeat-card" onClick={() => { setPredictionTab("preferredNumber"); localStorage.setItem("londoner.predictionTab", "preferredNumber"); }} role="button" tabIndex={0}>
                    <div className="overview-card-title">
                      <span>优选号</span>
                      <span className="signal-tier-group" onClick={(e) => e.stopPropagation()}>
                        <button className={`signal-toggle${showPreferredNumber ? " on" : ""}`} onClick={() => { const v = !showPreferredNumber; setShowPreferredNumber(v); localStorage.setItem("londoner.showPreferredNumber", v ? "1" : "0"); }} type="button" />
                      </span>
                    </div>
                    <div className="prediction-roi-table" style={{ margin: 0 }}>
                      <div className="prediction-roi-row prediction-roi-header"><span>数据量</span><span>总投入</span><span>总赢回</span><span>ROI</span></div>
                      <div className="prediction-roi-row">
                        <strong>{numbers.length}</strong><strong>{preferredNumberRoi.bet}</strong><strong>{preferredNumberRoi.win}</strong>
                        <strong className="roi-value" style={{ color: preferredNumberRoi.roi >= 0 ? "#b85a3a" : "#5f9a70" }}>{preferredNumberRoi.roi >= 0 ? "+" : ""}{preferredNumberRoi.roi.toFixed(1)}%</strong>
                      </div>
                      <div className="prediction-roi-row">
                        <span className="prediction-roi-subheader">200后</span><span>{preferredNumberRoiFrom201.bet}</span><span>{preferredNumberRoiFrom201.win}</span>
                        <strong className="roi-value" style={{ color: preferredNumberRoiFrom201.roi >= 0 ? "#b85a3a" : "#5f9a70" }}>{preferredNumberRoiFrom201.roi >= 0 ? "+" : ""}{preferredNumberRoiFrom201.roi.toFixed(1)}%</strong>
                      </div>
                    </div>
                  </div>
                  ) : null}
                  </div>
                </div>
              ) : predictionTab === "quality124" && canUseQuality124 ? (
                <>
                  <p className="prediction-desc">行组节奏：按每个行/组自己的频率、距离、集中度入场，并自适应追轮。一组=空4/近12/打1；二组=空4/近18高度集中/打1-2-4，二组短追=空3/打1-2；三组=空3-4/近18高度集中/排除fast/打1-2-3-5；1行=空3/近12中高速/打1；2行=空3/近24/打1-2-4；3行=空3/近37中慢/打1-2-4-8。</p>
                  <div className="prediction-roi-table">
                    <div className="prediction-roi-row prediction-roi-header"><span>信号</span><span>总投入</span><span>总赢回</span><span>ROI</span></div>
                    <div className="prediction-roi-row">
                      <strong>{quality124Roi.signals}</strong><strong>{quality124Roi.bet}</strong><strong>{quality124Roi.win}</strong>
                      <strong className="roi-value" style={{ color: quality124Roi.roi >= 0 ? "#b85a3a" : "#5f9a70" }}>{quality124Roi.roi >= 0 ? "+" : ""}{quality124Roi.roi.toFixed(1)}%</strong>
                    </div>
                    <div className="prediction-roi-row">
                      <span className="prediction-roi-subheader">200后</span><span>{quality124RoiFrom201.bet}</span><span>{quality124RoiFrom201.win}</span>
                      <strong className="roi-value" style={{ color: quality124RoiFrom201.roi >= 0 ? "#b85a3a" : "#5f9a70" }}>{quality124RoiFrom201.roi >= 0 ? "+" : ""}{quality124RoiFrom201.roi.toFixed(1)}%</strong>
                    </div>
                  </div>
                  <div className="detail-stats-table">
                    <div className="detail-stats-header"><span>档位</span><span>信号</span><span>命中</span><span>未中</span><span>ROI</span></div>
                    {QUALITY_124_TIER_ORDER.map((tier) => {
                      const meta = QUALITY_124_TIER_META[tier];
                      const item = quality124.tierRois[tier];
                      const stars = meta.stars > 0 ? ` ${"★".repeat(meta.stars)}` : "";
                      return (
                        <div className="detail-stats-row" key={tier}>
                          <strong className="detail-stats-label">{meta.label}{stars}</strong>
                          <span>{item.signals}</span><span>{item.hits}</span><span>{item.signals - item.hits}</span>
                          <span className="roi-value" style={{ color: item.roi >= 0 ? "#b85a3a" : "#5f9a70" }}>{item.roi >= 0 ? "+" : ""}{item.roi.toFixed(1)}%</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : predictionTab === "preferredNumber" && canUsePreferredNumber ? (
                <>
                  <p className="prediction-desc">Markov Top2 纸面过滤：最近37口纸面预测命中≥2次，且当前号轮盘半径4区域最近37口≥8次时触发；真实下注未中后冷却3口。</p>
                  <p className="prediction-desc">
                    当前区域：{preferredNumberSignals[0]
                      ? `通过（${preferredNumberSignals[0].zoneHits}/${preferredNumberSignals[0].zoneWindow}，半径${preferredNumberSignals[0].zoneRadius}）`
                      : "未触发"}
                  </p>
                  <div className="prediction-roi-table">
                    <div className="prediction-roi-row prediction-roi-header"><span>信号</span><span>总投入</span><span>总赢回</span><span>ROI</span></div>
                    <div className="prediction-roi-row">
                      <strong>优选号</strong><strong>{preferredNumberRoi.bet}</strong><strong>{preferredNumberRoi.win}</strong>
                      <strong className="roi-value" style={{ color: preferredNumberRoi.roi >= 0 ? "#b85a3a" : "#5f9a70" }}>{preferredNumberRoi.roi >= 0 ? "+" : ""}{preferredNumberRoi.roi.toFixed(1)}%</strong>
                    </div>
                    <div className="prediction-roi-row">
                      <span className="prediction-roi-subheader">200后</span><span>{preferredNumberRoiFrom201.bet}</span><span>{preferredNumberRoiFrom201.win}</span>
                      <strong className="roi-value" style={{ color: preferredNumberRoiFrom201.roi >= 0 ? "#b85a3a" : "#5f9a70" }}>{preferredNumberRoiFrom201.roi >= 0 ? "+" : ""}{preferredNumberRoiFrom201.roi.toFixed(1)}%</strong>
                    </div>
                  </div>
                  <div className="detail-stats-table">
                    <div className="detail-stats-header"><span>类型</span><span>信号</span><span>命中</span><span>未中</span><span>命中率</span></div>
                    <div className="detail-stats-row">
                      <strong className="detail-stats-label">优选号</strong>
                      <span>{preferredNumberRoi.signals}</span><span>{preferredNumberRoi.hits}</span><span>{preferredNumberRoi.signals - preferredNumberRoi.hits}</span>
                      <span>{preferredNumberRoi.signals > 0 ? `${(preferredNumberRoi.hits / preferredNumberRoi.signals * 100).toFixed(1)}%` : "0.0%"}</span>
                    </div>
                  </div>
                </>
              ) : predictionTab === "cold" ? (
                <>
                  <p className="prediction-desc">行组连续未出现超过历史92%分位+3轮缓冲时触发，1-2-4-8追打4轮。{coldAdaptiveMode !== "off" ? " 自适应"+ (coldAdaptiveMode === "adaptiveRow" ? "(冷启动押行)" : "") + "已启用" : ""}</p>
                  <div className="prediction-roi-table">
                    <div className="prediction-roi-row prediction-roi-header"><span>数据量</span><span>总投入</span><span>总赢回</span><span>ROI</span></div>
                    <div className="prediction-roi-row">
                      <strong>{numbers.length}</strong><strong>{coldActiveRoi.bet}</strong><strong>{coldActiveRoi.win}</strong>
                      <strong className="roi-value" style={{ color: coldActiveRoi.roi >= 0 ? "#b85a3a" : "#5f9a70" }}>{coldActiveRoi.roi >= 0 ? "+" : ""}{coldActiveRoi.roi.toFixed(1)}%</strong>
                    </div>
                    <div className="prediction-roi-row">
                      <span className="prediction-roi-subheader">ROI-仅行</span><span>{coldRowsOnlyRoi.bet}</span><span>{coldRowsOnlyRoi.win}</span>
                      <strong className="roi-value" style={{ color: coldRowsOnlyRoi.roi >= 0 ? "#b85a3a" : "#5f9a70" }}>{coldRowsOnlyRoi.roi >= 0 ? "+" : ""}{coldRowsOnlyRoi.roi.toFixed(1)}%</strong>
                    </div>
                    <div className="prediction-roi-row">
                      <span className="prediction-roi-subheader">ROI-仅组</span><span>{coldGroupsOnlyRoi.bet}</span><span>{coldGroupsOnlyRoi.win}</span>
                      <strong className="roi-value" style={{ color: coldGroupsOnlyRoi.roi >= 0 ? "#b85a3a" : "#5f9a70" }}>{coldGroupsOnlyRoi.roi >= 0 ? "+" : ""}{coldGroupsOnlyRoi.roi.toFixed(1)}%</strong>
                    </div>
                  </div>
                  <div className="detail-stats-table">
                    <div className="detail-stats-header"><span>行组</span><span>成功</span><span>失败</span><span>ROI</span><span>趋势</span></div>
                    {coldDetailStats.map((row) => (
                      <div className="detail-stats-row" key={row.ci}>
                        <strong className="detail-stats-label">{row.label}</strong>
                        <span>{row.successes}</span><span>{row.failures}</span>
                        <span className="roi-value" style={{ color: row.roi >= 0 ? "#b85a3a" : "#5f9a70" }}>{row.roi >= 0 ? "+" : ""}{row.roi.toFixed(0)}%</span>
                        <span className={`detail-trend trend-${row.trend}`}>{row.trend === "up" ? "↑" : row.trend === "down" ? "↓" : "→"}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : predictionTab === "chase6" ? (
                <>
                  <p className="prediction-desc">追6：行组冷波触发，1-2-4-8-16-32六级倍投追打6轮。波浪过滤排除弱信号。</p>
                  <div className="prediction-roi-table">
                    <div className="prediction-roi-row prediction-roi-header"><span>信号</span><span>总投入</span><span>总赢回</span><span>ROI</span></div>
                    <div className="prediction-roi-row">
                      <strong>{chase6Filter}</strong><strong>{chaseSixRoi.bet}</strong><strong>{chaseSixRoi.win}</strong>
                      <strong className="roi-value" style={{ color: chaseSixRoi.roi >= 0 ? "#b85a3a" : "#5f9a70" }}>{chaseSixRoi.roi >= 0 ? "+" : ""}{chaseSixRoi.roi.toFixed(1)}%</strong>
                    </div>
                    <div className="prediction-roi-row">
                      <span className="prediction-roi-subheader">强信号 ★</span><span>{cs.strongRoi.bet}</span><span>{cs.strongRoi.win}</span>
                      <strong className="roi-value" style={{ color: cs.strongRoi.roi >= 0 ? "#b85a3a" : "#5f9a70" }}>{cs.strongRoi.roi >= 0 ? "+" : ""}{cs.strongRoi.roi.toFixed(1)}%</strong>
                    </div>
                    <div className="prediction-roi-row">
                      <span className="prediction-roi-subheader">波浪过滤 ★★</span><span>{cs.waveStrongRoi.bet}</span><span>{cs.waveStrongRoi.win}</span>
                      <strong className="roi-value" style={{ color: cs.waveStrongRoi.roi >= 0 ? "#b85a3a" : "#5f9a70" }}>{cs.waveStrongRoi.roi >= 0 ? "+" : ""}{cs.waveStrongRoi.roi.toFixed(1)}%</strong>
                    </div>
                  </div>
                </>
              ) : predictionTab === "hotNumber" ? (
                <>
                  <p className="prediction-desc">自适应双模：默认长热148加速（S1-S2-S3递增+burst&lt;4）；短热DS三窗（37/74/111共识+趋势+burst&lt;4）。111口纸面复盘：短热信号&gt;=5且ROI&gt;=0且比长热高20%则优先短热。信号不减，优先档无信号回落另一档。</p>
                  <div className="prediction-roi-table">
                    <div className="prediction-roi-row prediction-roi-header"><span>信号</span><span>总投入</span><span>总赢回</span><span>命中</span><span>ROI</span></div>
                    <div className="prediction-roi-row">
                      <strong>{hotNumberRoi.signals}</strong><strong>{hotNumberRoi.bet}</strong><strong>{hotNumberRoi.win}</strong><strong>{hotNumberRoi.hits}</strong>
                      <strong className="roi-value" style={{ color: hotNumberRoi.roi >= 0 ? "#b85a3a" : "#5f9a70" }}>{hotNumberRoi.roi >= 0 ? "+" : ""}{hotNumberRoi.roi.toFixed(1)}%</strong>
                    </div>
                    <div className="prediction-roi-row">
                      <span className="prediction-roi-subheader">200后</span><span>{hotNumberRoiFrom201.bet}</span><span>{hotNumberRoiFrom201.win}</span><span>{hotNumberRoiFrom201.hits}</span>
                      <strong className="roi-value" style={{ color: hotNumberRoiFrom201.roi >= 0 ? "#b85a3a" : "#5f9a70" }}>{hotNumberRoiFrom201.roi >= 0 ? "+" : ""}{hotNumberRoiFrom201.roi.toFixed(1)}%</strong>
                    </div>
                    {hotNumberSignal ? (
                      <>
                        <div className="prediction-roi-row">
                          <span className="prediction-roi-subheader">当前({hotNumberSignal.mode === "short" ? "短热" : "长热"})</span><strong>{hotNumberSignal.number}</strong><span>148={hotNumberSignal.count148}</span><span>S1={hotNumberSignal.seg1}</span><span>S2={hotNumberSignal.seg2}</span><span>S3={hotNumberSignal.seg3}</span>
                        </div>
                      </>
                    ) : (
                      <div className="prediction-roi-row">
                        <span className="prediction-roi-subheader">当前</span><span>暂无信号</span>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <p className="prediction-desc">请选择一个预测方法查看详情。</p>
              )}
            </div>
          </section>
      ) : null}

      {statsViewOpen ? (
        <section className="data-screen" aria-label="统计数据">
          <header className="data-screen-head">
            <strong>{statsTab==="game"?"打法统计":statsTab==="colrow"?"行组距离数据":statsTab==="freq"?"频率统计图":statsTab==="dist"?"距离统计图":statsTab==="refine"?"行组细化数据":"其它统计数据"}</strong>
            <button className="close-button title-close-button" onClick={() => setStatsViewOpen(false)} type="button">x</button>
          </header>
          <div className="stats-tab-body">
            {statsTab === "game" && (
              <div className="data-table-wrap">
                <table className="data-table game-table">
                  <thead><tr>
                    <th onClick={() => sortGameView("name")}>名称 <SortMark active={gameSortField==="name"} direction={gameSortDirection} /></th>
                    <th>完成</th><th onClick={() => sortGameView("won")}>赢 <SortMark active={gameSortField==="won"} direction={gameSortDirection} /></th>
                    <th>平</th><th>输</th>
                    <th onClick={() => sortGameView("balance")}>结算 <SortMark active={gameSortField==="balance"} direction={gameSortDirection} /></th>
                    <th onClick={() => sortGameView("live")}>实时 <SortMark active={gameSortField==="live"} direction={gameSortDirection} /></th>
                  </tr></thead>
                  <tbody>
                    {numbers.length===0 ? <tr><td className="data-empty" colSpan={7}>暂无可统计的数据</td></tr> :
                     gameStats.map((item)=>(<tr key={item.name}><td>{item.name}</td><td>{item.completed}</td><td className="td-won">{item.won}</td><td className="td-drew">{item.drew}</td><td className="td-lost">{item.lost}</td><td>{item.balance}</td><td>{item.live}</td></tr>))}
                  </tbody>
                </table>
              </div>
            )}
            {statsTab === "colrow" && <StatsColRowTab />}
            {statsTab === "freq" && <StatsFrequencyTab />}
            {statsTab === "dist" && <StatsDistanceTab />}
            {statsTab === "wave" && <StatsWaveTab />}
            {statsTab === "other" && <StatsOtherTab />}
          </div>
          {statsTab === "colrow" && colRowTab !== "detail" ? (
            <div className="data-screen-actions colrow-scope-actions" aria-label="行组统计范围" style={{borderTop:0,padding:"0 0 8px"}}>
              {colRowScopes.map((value) => (<button className={value===colRowScope?"selected":""} key={value} onClick={()=>setColRowScope(value)} type="button">{value<0?"全部":value}</button>))}
            </div>
          ) : null}
          {statsTab === "freq" && frequencyDetailKey === null ? (
            <div className="data-screen-actions frequency-scope-actions" aria-label="频率统计范围" style={{borderTop:0,padding:"0 0 8px"}}>
              {frequencyScopes.map((value, index) => (<button className={index === frequencyScopeIndex ? "selected" : ""} key={value} onClick={() => setFrequencyScopeIndex(index)} type="button">{value}</button>))}
            </div>
          ) : null}
          {statsTab === "other" ? (
            <div className="data-screen-actions colrow-scope-actions" aria-label="其它统计范围" style={{borderTop:0,padding:"0 0 8px"}}>
              {colRowScopes.map((value) => (<button className={value===otherScope?"selected":""} key={value} onClick={()=>setOtherScope(value)} type="button">{value<0?"全部":value}</button>))}
            </div>
          ) : null}
          <footer className="data-screen-actions stats-nav-actions" aria-label="统计标签">
            <button className={statsTab==="game"?"selected":""} onClick={()=>setStatsTab("game")} type="button">打法</button>
            <button className={statsTab==="colrow"?"selected":""} onClick={()=>{ setStatsTab("colrow"); setStatsGroupTab("colrow"); localStorage.setItem("londoner.statsGroupTab","colrow"); }} type="button">行组</button>
            <button className={statsTab==="freq"?"selected":""} onClick={()=>{ setStatsTab("freq"); setStatsGroupTab("freq"); localStorage.setItem("londoner.statsGroupTab","freq"); }} type="button">频率</button>
            <button className={statsTab==="dist"?"selected":""} onClick={()=>{ setStatsTab("dist"); setStatsGroupTab("dist"); localStorage.setItem("londoner.statsGroupTab","dist"); }} type="button">距离</button>
            <button className={statsTab==="wave"?"selected":""} onClick={()=>{ setStatsTab("wave"); setStatsGroupTab("wave"); localStorage.setItem("londoner.statsGroupTab","wave"); }} type="button">波浪</button>
            <button className={statsTab==="other"?"selected":""} onClick={()=>setStatsTab("other")} type="button">其它</button>
          </footer>
        </section>
      ) : null}

      {configViewOpen ? (
        <div className="config-backdrop" role="dialog" aria-modal="true" aria-label="配置">
          <section className="config-dialog">
            <header className="config-dialog-head">
              <strong>配置</strong>
              <button className="close-button" onClick={() => setConfigViewOpen(false)} type="button">x</button>
            </header>
            <div className="stats-tabs">
              <button className={configTab === "game" ? "selected" : ""} onClick={() => setConfigTab("game")} type="button">打法</button>
              <button className={configTab === "other" ? "selected" : ""} onClick={() => setConfigTab("other")} type="button">其它</button>
            </div>
            {configTab === "other" ? (
              <div className="config-body" style={{ gridTemplateColumns: "1fr" }}>
                <section className="config-card config-bets">
                  <h2><span>统计窗口</span></h2>
                  <div style={{ padding: "10px 0" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "8px", padding: "3px 0 3px 12px", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={draftWindowMode === "classic"}
                        onChange={() => setDraftWindowMode("classic")}
                        style={{ width: "18px", height: "18px", accentColor: "#8a6b2e" }}
                      />
                      <span>传统数字序列</span>
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "8px", padding: "3px 0 3px 12px", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={draftWindowMode === "fibonacci"}
                        onChange={() => setDraftWindowMode("fibonacci")}
                        style={{ width: "18px", height: "18px", accentColor: "#8a6b2e" }}
                      />
                      <span>斐波那契数字序列</span>
                    </label>
                  </div>
                </section>
              </div>
            ) : (
            <div className="config-body">
              <section className="config-card config-bets">
                <h2>
                  <button
                    aria-label="全选打法"
                    className={`config-select-all ${
                      allGameBets.length > 0 && selectedBetKeys.length === allGameBets.length ? "selected" : ""
                    }`}
                    onClick={toggleAllBets}
                    type="button"
                  />
                  <span>打法</span>
                </h2>
                <div className="config-check-list">
                  {allGameBets.map((bet) => {
                    const key = formatGameBet(bet);
                    return (
                      <button
                        className={`${selectedBetKeys.includes(key) ? "selected" : ""} ${
                          isDefaultGameBet(bet) ? "default-item" : ""
                        }`}
                        key={key}
                        onClick={() => toggleBetSelection(bet)}
                        type="button"
                      >
                        <span>{key}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="config-card config-rounds">
                <h2>
                  <button
                    aria-label="全选轮"
                    className={`config-select-all ${
                      gameRounds.length > 0 && selectedRounds.length === gameRounds.length ? "selected" : ""
                    }`}
                    onClick={toggleAllRounds}
                    type="button"
                  />
                  <span>轮</span>
                </h2>
                <div className="config-check-list compact">
                  {gameRounds.map((round) => (
                    <button
                      className={selectedRounds.includes(round) ? "selected" : ""}
                      key={round}
                      onClick={() => toggleRoundSelection(round)}
                      type="button"
                    >
                      <span>{round}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="config-card config-acr">
                <h2>
                  <button
                    aria-label="全选行组选项"
                    className={`config-select-all ${
                      gameAcrOptions.length > 0 && selectedAcrModes.length === gameAcrOptions.length ? "selected" : ""
                    }`}
                    onClick={toggleAllAcrModes}
                    type="button"
                  />
                  <span>行组选项</span>
                </h2>
                <div className="config-check-list">
                  {gameAcrOptions.map((mode) => (
                    <button
                      className={selectedAcrModes.includes(mode) ? "selected" : ""}
                      key={mode}
                      onClick={() => toggleAcrSelection(mode)}
                      type="button"
                    >
                      <span>{mode}</span>
                    </button>
                  ))}
                </div>
              </section>
            </div>
            )}
            <footer className="config-actions">
              <button onClick={saveConfigView} type="button">确定</button>
              <button onClick={() => setConfigViewOpen(false)} type="button">取消</button>
              {configTab === "game" ? <button onClick={openBetsManage} type="button">管理</button> : null}
            </footer>
          </section>
        </div>
      ) : null}

      {betsManageOpen ? (
        <div className="config-backdrop manage-backdrop" role="dialog" aria-modal="true" aria-label="打法管理">
          <section className="config-dialog manage-dialog">
            <header className="config-dialog-head">
              <strong>打法管理</strong>
              <button className="close-button" onClick={() => setBetsManageOpen(false)} type="button">x</button>
            </header>
            <div className="config-body manage-body">
              <section className="manage-list-panel">
                <div className="manage-list">
                  {allGameBets.map((bet) => {
                    const key = formatGameBet(bet);
                    return (
                      <button
                        className={`${selectedManageBetKeys.includes(key) ? "selected" : ""} ${
                          isDefaultGameBet(bet) ? "default-item" : ""
                        }`}
                        key={key}
                        onClick={() => toggleManageBetSelection(bet)}
                        type="button"
                      >
                        <span>{key}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
              <aside className="manage-side-actions">
                <button onClick={addManagedBet} type="button">添加</button>
                <button
                  disabled={selectedManageBetKeys.length < 1 || selectedManageBetKeys.length >= allGameBets.length}
                  onClick={deleteManagedBets}
                  type="button"
                >
                  删除
                </button>
                <button onClick={restoreManagedBets} type="button">预定义回归</button>
                <button onClick={() => setBetsManageOpen(false)} type="button">完成</button>
              </aside>
            </div>
          </section>
        </div>
      ) : null}

      {toolsOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-panel tools-panel">
            <div className="modal-head">
              <strong>数据文本整理工具</strong>
              <button className="close-button" onClick={() => setToolsOpen(false)} type="button">X</button>
            </div>
            <div className="tools-stack">
              <textarea
                className="data-textarea tools-textarea"
                onChange={(event) => setToolsText(event.target.value)}
                value={toolsText}
              />
              <label className="tools-check">
                <input
                  checked={toolsKeepBreaks}
                  onChange={(event) => setToolsKeepBreaks(event.target.checked)}
                  type="checkbox"
                />
                保留换行
              </label>
              <div className="modal-actions tools-actions">
                <button onClick={normalizeToolsText} type="button">整理</button>
                <button onClick={reverseToolsText} type="button">反序</button>
                <button onClick={() => void copyToolsText()} type="button">复制</button>
                <button onClick={() => setToolsOpen(false)} type="button">退出</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {activeDialog ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-panel">
            <div className="modal-head">
              <strong>{activeDialog === "save" ? "保存" : activeDialog === "connect" ? "接上" : "导入"}</strong>
              <button className="close-button" onClick={() => setActiveDialog(null)} type="button">X</button>
            </div>

            {dialogMessage ? <div className="modal-message">{dialogMessage}</div> : null}

            {activeDialog === "save" ? (
              <div className="modal-stack">
                <label className="field-label">
                  名称
                  <input value={saveName} onChange={(event) => setSaveName(event.target.value)} />
                </label>
                <button className="primary-action" onClick={saveSession} type="button">保存当前数据</button>
              </div>
            ) : null}

            {activeDialog === "import" || activeDialog === "connect" ? (
              <div className="modal-stack">
                <textarea
                  className="data-textarea"
                  onChange={(event) => setDataText(event.target.value)}
                  value={dataText}
                />
                <div className={activeDialog === "connect" ? "modal-actions single-action" : "modal-actions"}>
                  <button
                    className="primary-action"
                    onClick={activeDialog === "connect" ? connectInputData : importMode === "files" ? importFilesFromText : importData}
                    type="button"
                  >
                    {activeDialog === "connect" ? "接上" : "导入"}
                  </button>
                  {activeDialog === "import" && importMode === "files" ? (
                    <>
                      <button className="primary-action" onClick={() => fileInputRef.current?.click()} type="button">从文件导入</button>
                      <input
                        accept=".json"
                        onChange={importFromFile}
                        ref={fileInputRef}
                        style={{ display: "none" }}
                        type="file"
                      />
                    </>
                  ) : null}
                </div>
              </div>
            ) : null}

          </div>
        </div>
      ) : null}

      {noticeDialog ? (
        <MessageDialog title={noticeDialog.title} onClose={() => setNoticeDialog(null)}>
          {noticeDialog.message}
        </MessageDialog>
      ) : null}

      {confirmDialog ? (
        <MessageDialog
          title={confirmDialog.title}
          onClose={() => setConfirmDialog(null)}
          actions={
            (() => {
              const cancelButton = confirmDialog.cancelText ? (
                <button
                  onClick={() => {
                    const action = confirmDialog.onCancel;
                    setConfirmDialog(null);
                    if (action) void action();
                  }}
                  type="button"
                >
                  {confirmDialog.cancelText}
                </button>
              ) : (
                <button onClick={() => setConfirmDialog(null)} type="button">取消</button>
              );
              const confirmButton = (
              <button
                className="primary-action"
                onClick={() => {
                  const action = confirmDialog.onConfirm;
                  setConfirmDialog(null);
                  void action();
                }}
                type="button"
              >
                {confirmDialog.confirmText ?? "确定"}
              </button>
              );
              return confirmDialog.confirmFirst || !confirmDialog.cancelText ? (
                <>
                  {confirmButton}
                  {cancelButton}
                </>
              ) : (
                <>
                  {cancelButton}
                  {confirmButton}
                </>
              );
            })()
          }
        >
          {confirmDialog.message}
        </MessageDialog>
      ) : null}

      {sessionMergeDialog ? (() => {
        const { left, right, result } = sessionMergeDialog;
        const target = sessionMergeDialog.targetId === left.id ? left : right;
        const removed = target.id === left.id ? right : left;
        const conflicts = result.alignment?.conflicts ?? [];
        const tolerant = result.tolerantAlignment;
        const allIssueA = tolerant ? sessionMergeDialog.issueChoices.every((choice) => choice === "a") : sessionMergeDialog.conflictChoice === "a";
        const allIssueB = tolerant ? sessionMergeDialog.issueChoices.every((choice) => choice === "b") : sessionMergeDialog.conflictChoice === "b";
        const mergedLength = result.safeToMerge
          ? result.merged?.length
          : tolerant
            ? buildNumberMergeV2TolerantUnionWithChoices(tolerant, sessionMergeDialog.issueChoices).length
          : result.alignment
            ? buildNumberMergeV2Union(left.numbers, right.numbers, result.alignment, sessionMergeDialog.conflictChoice).length
            : undefined;
        const issueCount = tolerant ? tolerant.issues.length : conflicts.length;
        return (
          <MessageDialog
            actions={
              <>
                <button className="primary-action" onClick={() => void applySessionMerge()} type="button">确认合并</button>
                <button onClick={() => setSessionMergeDialog(null)} type="button">取消</button>
              </>
            }
            onClose={() => setSessionMergeDialog(null)}
            panelClassName="merge-message-panel"
            title="合并本地数据"
          >
            <div className="merge-dialog-stack">
              <div className="merge-analysis-summary">
                <strong>{formatSessionMergeRelationship(result)}</strong>
                <span>
                  重叠 {tolerant?.overlapLength ?? result.alignment?.overlapLength ?? 0} 个
                  {issueCount > 0 ? `，${tolerant ? formatMergeIssueSummary(tolerant.issues) : `发现 ${issueCount} 个冲突`}` : "，没有冲突"}
                  {tolerant ? `；匹配率 ${(tolerant.matchRate * 100).toFixed(1)}%` : ""}
                  {mergedLength !== undefined ? `；合并后 ${mergedLength} 个` : ""}
                </span>
              </div>

              {issueCount > 0 ? (
                <section className="merge-choice-section">
                  <span>{tolerant ? "问题位置采用哪条数据" : "冲突位置采用哪条数据"}</span>
                  <div className="merge-choice-buttons">
                    <button
                      aria-pressed={allIssueA}
                      className={allIssueA ? "selected" : ""}
                      onClick={() => setSessionMergeDialog((current) => current ? {
                        ...current,
                        conflictChoice: "a",
                        issueChoices: current.result.tolerantAlignment?.issues.map(() => "a") ?? current.issueChoices,
                      } : current)}
                      type="button"
                    >
                      采用 A
                    </button>
                    <button
                      aria-pressed={allIssueB}
                      className={allIssueB ? "selected" : ""}
                      onClick={() => setSessionMergeDialog((current) => current ? {
                        ...current,
                        conflictChoice: "b",
                        issueChoices: current.result.tolerantAlignment?.issues.map(() => "b") ?? current.issueChoices,
                      } : current)}
                      type="button"
                    >
                      采用 B
                    </button>
                  </div>
                  <div className={`merge-conflict-list ${tolerant ? "merge-issue-list" : ""}`}>
                    {tolerant ? (
                      <>
                        {tolerant.issues.map((issue, index) => (
                          <div className="merge-issue-item" key={`${issue.kind}-${issue.indexA}-${issue.indexB}-${index}`}>
                            <strong>{formatMergeEditIssue(issue, "A", "B")}</strong>
                            <span>{formatMergeIssueContext(issue, "A", left.numbers, "B", right.numbers)}</span>
                            <div className="merge-issue-actions">
                              <button
                                aria-pressed={(sessionMergeDialog.issueChoices[index] ?? sessionMergeDialog.conflictChoice) === "a"}
                                className={(sessionMergeDialog.issueChoices[index] ?? sessionMergeDialog.conflictChoice) === "a" ? "selected" : ""}
                                onClick={() => setSessionMergeDialog((current) => current ? {
                                  ...current,
                                  issueChoices: current.issueChoices.map((choice, choiceIndex) => choiceIndex === index ? "a" : choice),
                                } : current)}
                                type="button"
                              >
                                采用 A
                              </button>
                              <button
                                aria-pressed={(sessionMergeDialog.issueChoices[index] ?? sessionMergeDialog.conflictChoice) === "b"}
                                className={(sessionMergeDialog.issueChoices[index] ?? sessionMergeDialog.conflictChoice) === "b" ? "selected" : ""}
                                onClick={() => setSessionMergeDialog((current) => current ? {
                                  ...current,
                                  issueChoices: current.issueChoices.map((choice, choiceIndex) => choiceIndex === index ? "b" : choice),
                                } : current)}
                                type="button"
                              >
                                采用 B
                              </button>
                            </div>
                          </div>
                        ))}
                      </>
                    ) : (
                      <>
                        {conflicts.slice(0, 6).map((conflict) => (
                          <span key={`${conflict.indexA}-${conflict.indexB}`}>
                            A 第 {conflict.indexA + 1} 个：{conflict.valueA}；B 第 {conflict.indexB + 1} 个：{conflict.valueB}
                          </span>
                        ))}
                        {conflicts.length > 6 ? <span>另有 {conflicts.length - 6} 个冲突未展开。</span> : null}
                      </>
                    )}
                  </div>
                </section>
              ) : null}

              <section className="merge-choice-section">
                <span>合并结果保存到哪条数据</span>
                <div className="merge-target-grid">
                  {([
                    { label: "A", session: left },
                    { label: "B", session: right },
                  ] satisfies Array<{ label: string; session: SavedSession }>).map(({ label, session: item }) => {
                    const selected = sessionMergeDialog.targetId === item.id;
                    return (
                      <button
                        aria-pressed={selected}
                        className={selected ? "selected" : ""}
                        key={item.id}
                        onClick={() => setSessionMergeDialog((current) => current ? { ...current, targetId: item.id } : current)}
                        type="button"
                      >
                        <span>{label} · {item.numbers.length} 个</span>
                        <strong>{item.name}</strong>
                      </button>
                    );
                  })}
                </div>
              </section>

              <p className="merge-delete-warning">
                确认后将更新“{target.name}”，并删除“{removed.name}”。此操作会直接修改本地数据。
              </p>
            </div>
          </MessageDialog>
        );
      })() : null}

      {transferConnectDialog ? (() => {
        const { incoming, result } = transferConnectDialog;
        const tolerant = result.tolerantAlignment;
        const conflicts = result?.alignment?.conflicts ?? [];
        const mergedLength = tolerant
          ? buildNumberMergeV2TolerantUnionWithChoices(tolerant, transferConnectDialog.issueChoices).length
          : result?.alignment
            ? buildNumberMergeV2Union(numbers, incoming.numbers, result.alignment, transferConnectDialog.conflictChoice).length
            : undefined;
        const summaryTitle = tolerant
          ? "发现输入数据可容错接上"
          : result ? formatSessionMergeRelationship(result) : "发现接上冲突";
        const overlapLength = tolerant?.overlapLength ?? result?.alignment?.overlapLength ?? 0;
        const conflictCount = tolerant ? tolerant.issues.length : conflicts.length;
        const allIssueCurrent = tolerant ? transferConnectDialog.issueChoices.every((choice) => choice === "a") : transferConnectDialog.conflictChoice === "a";
        const allIssueIncoming = tolerant ? transferConnectDialog.issueChoices.every((choice) => choice === "b") : transferConnectDialog.conflictChoice === "b";
        return (
          <MessageDialog
            actions={
              <>
                <button className="primary-action" onClick={applyTransferConnectConflict} type="button">确认接上</button>
                <button onClick={() => setTransferConnectDialog(null)} type="button">取消</button>
              </>
            }
            onClose={() => setTransferConnectDialog(null)}
            panelClassName="merge-message-panel"
            title="接上输入数据"
          >
            <div className="merge-dialog-stack">
              <div className="merge-analysis-summary">
                <strong>{summaryTitle}</strong>
                <span>
                  当前 {numbers.length} 个，输入 {incoming.numbers.length} 个；
                  重叠 {overlapLength} 个
                  {conflictCount > 0 ? `，${tolerant ? formatMergeIssueSummary(tolerant.issues, "当前", "输入") : `发现 ${conflictCount} 个冲突`}` : "，没有冲突"}
                  {tolerant ? `；匹配率 ${(tolerant.matchRate * 100).toFixed(1)}%` : ""}
                  {mergedLength !== undefined ? `；接上后 ${mergedLength} 个` : ""}
                </span>
              </div>

              <section className="merge-choice-section">
                <span>{tolerant ? "问题位置采用哪边数据" : "冲突位置采用哪边数据"}</span>
                <div className="merge-choice-buttons">
                  <button
                    aria-pressed={allIssueCurrent}
                    className={allIssueCurrent ? "selected" : ""}
                    onClick={() => setTransferConnectDialog((current) => current ? {
                      ...current,
                      conflictChoice: "a",
                      issueChoices: current.result.tolerantAlignment?.issues.map(() => "a") ?? current.issueChoices,
                    } : current)}
                    type="button"
                  >
                    采用当前
                  </button>
                  <button
                    aria-pressed={allIssueIncoming}
                    className={allIssueIncoming ? "selected" : ""}
                    onClick={() => setTransferConnectDialog((current) => current ? {
                      ...current,
                      conflictChoice: "b",
                      issueChoices: current.result.tolerantAlignment?.issues.map(() => "b") ?? current.issueChoices,
                    } : current)}
                    type="button"
                  >
                    采用输入
                  </button>
                </div>
                <div className={`merge-conflict-list ${tolerant ? "merge-issue-list" : ""}`}>
                  {tolerant ? (
                    <>
                      {tolerant.issues.map((issue, index) => (
                        <div className="merge-issue-item" key={`${issue.kind}-${issue.indexA}-${issue.indexB}-${index}`}>
                          <strong>{formatMergeEditIssue(issue, "当前", "输入")}</strong>
                          <span>{formatMergeIssueContext(issue, "当前", numbers, "输入", incoming.numbers)}</span>
                          <div className="merge-issue-actions">
                            <button
                              aria-pressed={(transferConnectDialog.issueChoices[index] ?? transferConnectDialog.conflictChoice) === "a"}
                              className={(transferConnectDialog.issueChoices[index] ?? transferConnectDialog.conflictChoice) === "a" ? "selected" : ""}
                              onClick={() => setTransferConnectDialog((current) => current ? {
                                ...current,
                                issueChoices: current.issueChoices.map((choice, choiceIndex) => choiceIndex === index ? "a" : choice),
                              } : current)}
                              type="button"
                            >
                              采用当前
                            </button>
                            <button
                              aria-pressed={(transferConnectDialog.issueChoices[index] ?? transferConnectDialog.conflictChoice) === "b"}
                              className={(transferConnectDialog.issueChoices[index] ?? transferConnectDialog.conflictChoice) === "b" ? "selected" : ""}
                              onClick={() => setTransferConnectDialog((current) => current ? {
                                ...current,
                                issueChoices: current.issueChoices.map((choice, choiceIndex) => choiceIndex === index ? "b" : choice),
                              } : current)}
                              type="button"
                            >
                              采用输入
                            </button>
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    <>
                      {conflicts.slice(0, 6).map((conflict) => (
                        <span key={`${conflict.indexA}-${conflict.indexB}`}>
                          当前第 {conflict.indexA + 1} 个：{conflict.valueA}；输入第 {conflict.indexB + 1} 个：{conflict.valueB}
                        </span>
                      ))}
                      {conflicts.length > 6 ? <span>另有 {conflicts.length - 6} 个冲突未展开。</span> : null}
                    </>
                  )}
                </div>
              </section>

              <p className="merge-delete-warning">
                确认后只更新当前正在打的数据；如当前数据已保存，本次接上会成为未保存修改。
              </p>
            </div>
          </MessageDialog>
        );
      })() : null}

      {sharedLoginOpen ? (
        <MessageDialog
          title="共享数据登录"
          onClose={() => { setSharedLoginOpen(false); postLoginAction.current = null; }}
          actions={
            <>
              <button
                className="primary-action"
                disabled={sharedLoading || !sharedUsername.trim() || !sharedPassword}
                onClick={() => void connectSharedData()}
                type="button"
              >
                {sharedLoading ? "连接中" : "连接"}
              </button>
              <button onClick={() => { setSharedLoginOpen(false); postLoginAction.current = null; }} type="button">取消</button>
            </>
          }
        >
          <div className="modal-stack">
            <label className="field-label">
              用户名
              <input
                autoComplete="username"
                onChange={(event) => setSharedUsername(event.target.value)}
                value={sharedUsername}
              />
            </label>
            <label className="field-label">
              密码
              <input
                autoComplete="current-password"
                onChange={(event) => setSharedPassword(event.target.value)}
                type="password"
                value={sharedPassword}
              />
            </label>
          </div>
        </MessageDialog>
      ) : null}

      {promptDialog ? (
        <MessageDialog
          title={promptDialog.title}
          onClose={() => setPromptDialog(null)}
          actions={
            <>
              <button
                className="primary-action"
                onClick={() => {
                  const action = promptDialog.onConfirm;
                  const value = promptValue;
                  setPromptDialog(null);
                  void action(value);
                }}
                type="button"
              >
                {promptDialog.confirmText ?? "确定"}
              </button>
              <button onClick={() => setPromptDialog(null)} type="button">取消</button>
            </>
          }
        >
          <label className="field-label">
            {promptDialog.message}
            <input value={promptValue} onChange={(event) => setPromptValue(event.target.value)} />
          </label>
        </MessageDialog>
      ) : null}
      {editDialogOpen ? (
        <MessageDialog
          title="编辑数据"
          onClose={() => setEditDialogOpen(false)}
          actions={
            <>
              <button
                className="primary-action"
                onClick={() => { setEditDialogOpen(false); void saveEditSession(); }}
                type="button"
              >
                确定
              </button>
              <button onClick={() => setEditDialogOpen(false)} type="button">取消</button>
            </>
          }
        >
          <label className="field-label">
            名称
            <input value={editName} onChange={(event) => setEditName(event.target.value)} />
          </label>
          <label className="field-label">
            ID（上传者）
            <input value={editUploader} onChange={(event) => setEditUploader(event.target.value)} />
          </label>
          <label className="field-label">
            保存时间
            <input type="datetime-local" value={editTime} onChange={(event) => setEditTime(event.target.value)} />
          </label>
        </MessageDialog>
      ) : null}
      <div className="key-pop-overlay" aria-hidden="true">
        {keyPops.map((pop, i) => (
          <span
            key={pop.id}
            className="key-pop"
            style={{ zIndex: i }}
            onAnimationEnd={() => setKeyPops(prev => prev.filter(p => p.id !== pop.id))}
          >{pop.value}</span>
        ))}
      </div>
    </main>
  );
}

interface SegmentedStatGroupProps {
  items: Array<{ label: string; value: number }>;
  max: number;
}

function SegmentedStatGroup({ items, max }: SegmentedStatGroupProps) {
  return (
    <div className="segmented-stat">
      <div className="segmented-labels" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
        {items.map((item) => (
          <span className="segmented-stat-item" key={item.label}>
            <b>{item.label}</b>
            <strong>{item.value}</strong>
          </span>
        ))}
      </div>
      <div className="segmented-bars" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
        {items.map((item) => (
          <span className="segmented-bar-cell" key={item.label}>
            <em className="stat-bar" style={{ width: `${(item.value / max) * 100}%` }} />
          </span>
        ))}
      </div>
    </div>
  );
}

function SortMark({ active, direction }: { active: boolean; direction: SortDirection }) {
  return <span className={`sort-mark ${active ? "active" : ""}`}>{direction === "asc" ? "▲" : "▼"}</span>;
}

function OtherNumberCells({ item }: { item?: OtherNumberItem }) {
  if (!item) {
    return (
      <>
        <td />
        <td />
        <td />
      </>
    );
  }

  return (
    <>
      <td className={`other-number-cell ${item.number === 0 ? "zero" : ""} ${item.isAverage ? "average" : ""}`}>
        {item.isAverage ? "平均" : item.number}
      </td>
      <td>{formatStatNumber(item.distance, item.isAverage)}</td>
      <td>{formatStatNumber(item.frequency, item.isAverage)}</td>
    </>
  );
}

function formatStatNumber(value: number, isAverage?: boolean) {
  return isAverage ? value.toFixed(1) : Math.round(value);
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

function formatSessionMergeRelationship(result: NumberMergeV2Result): string {
  if (result.tolerantAlignment) {
    switch (result.tolerantAlignment.relationship) {
      case "identical": return "两条数据可容错视为相同";
      case "a-contains-b": return "A 可以容错包含 B";
      case "b-contains-a": return "B 可以容错包含 A";
      case "a-then-b": return "B 可以容错接在 A 后面";
      case "b-then-a": return "A 可以容错接在 B 后面";
    }
  }

  const relationship = result.relationship === "conflict"
    ? result.alignment?.relationship
    : result.relationship;

  switch (relationship) {
    case "identical": return result.relationship === "conflict" ? "两条数据几乎相同，但存在冲突" : "两条数据完全相同";
    case "a-contains-b": return result.relationship === "conflict" ? "A 基本包含 B，但存在冲突" : "A 完整包含 B";
    case "b-contains-a": return result.relationship === "conflict" ? "B 基本包含 A，但存在冲突" : "B 完整包含 A";
    case "a-then-b": return result.relationship === "conflict" ? "B 可以接在 A 后面，但存在冲突" : "B 可以接在 A 后面";
    case "b-then-a": return result.relationship === "conflict" ? "A 可以接在 B 后面，但存在冲突" : "A 可以接在 B 后面";
    default: return "无法确定合并关系";
  }
}

function formatMergeEditIssue(issue: NumberMergeEditIssue, labelA: string, labelB: string): string {
  if (issue.kind === "a-extra") {
    return `${labelA} 第 ${issue.indexA + 1} 个多出：${issue.valueA}`;
  }
  if (issue.kind === "b-extra") {
    return `${labelB} 第 ${issue.indexB + 1} 个多出：${issue.valueB}`;
  }
  return `${labelA} 第 ${issue.indexA + 1} 个：${issue.valueA}；${labelB} 第 ${issue.indexB + 1} 个：${issue.valueB}`;
}

function formatMergeIssueContext(
  issue: NumberMergeEditIssue,
  labelA: string,
  valuesA: readonly number[],
  labelB: string,
  valuesB: readonly number[],
): string {
  return `${labelA}附近：${formatNumberContext(valuesA, issue.indexA)}；${labelB}附近：${formatNumberContext(valuesB, issue.indexB)}`;
}

function formatNumberContext(values: readonly number[], index: number): string {
  if (values.length === 0) return "无";
  const clamped = Math.min(Math.max(index, 0), values.length - 1);
  const start = Math.max(0, clamped - 2);
  const end = Math.min(values.length, clamped + 3);
  const position = index >= values.length ? "末尾后" : `第 ${index + 1} 个`;
  const text = values.slice(start, end).map((value, offset) => {
    const actualIndex = start + offset;
    return actualIndex === clamped ? `[${value}]` : String(value);
  }).join(" ");
  return `${position}：${text}`;
}

function formatMergeIssueSummary(
  issues: readonly NumberMergeEditIssue[],
  labelA = "A",
  labelB = "B",
): string {
  const aExtra = issues.filter((issue) => issue.kind === "a-extra").length;
  const bExtra = issues.filter((issue) => issue.kind === "b-extra").length;
  const substitutions = issues.filter((issue) => issue.kind === "substitution").length;
  const parts = [
    aExtra > 0 ? `${labelA}多 ${aExtra}` : "",
    bExtra > 0 ? `${labelB}多 ${bExtra}` : "",
    substitutions > 0 ? `不同 ${substitutions}` : "",
  ].filter(Boolean);
  return `发现 ${issues.length} 个问题${parts.length > 0 ? `（${parts.join("，")}）` : ""}`;
}

interface MessageDialogProps {
  actions?: ReactNode;
  children: ReactNode;
  onClose: () => void;
  panelClassName?: string;
  title: string;
}

function MessageDialog({ actions, children, onClose, panelClassName = "", title }: MessageDialogProps) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className={`message-panel ${panelClassName}`.trim()}>
        <div className="modal-head">
          <strong>{title}</strong>
          <button className="close-button" onClick={onClose} type="button">X</button>
        </div>
        <div className="message-body">{children}</div>
        <div className="message-actions">
          {actions ?? <button className="primary-action" onClick={onClose} type="button">确定</button>}
        </div>
      </div>
    </div>
  );
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size));
  }
  return rows;
}

function areSameNumbers(left: RouletteNumber[], right: RouletteNumber[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function sortSessions(sessions: SavedSession[], field: DataSortField, direction: SortDirection): SavedSession[] {
  const multiplier = direction === "asc" ? 1 : -1;
  return [...sessions].sort((left, right) => {
    let result = 0;
    if (field === "count") {
      result = left.numbers.length - right.numbers.length;
    } else if (field === "time") {
      result = new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime();
    } else if (field === "sharedUploader") {
      result = (left.sharedUploader ?? "").localeCompare(right.sharedUploader ?? "");
    } else {
      result = left.name.localeCompare(right.name, "zh-Hans-CN");
    }
    return result * multiplier;
  });
}

function makeUniqueSessionName(baseName: string, sessions: SavedSession[]): string {
  const names = new Set(sessions.map((session) => session.name));
  if (!names.has(baseName)) return baseName;

  let index = 2;
  let next = `${baseName} (${index})`;
  while (names.has(next)) {
    index += 1;
    next = `${baseName} (${index})`;
  }
  return next;
}

function formatSharedError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("Invalid shared access code")) return "访问密码不正确。";
  if (message.includes("Invalid shared user")) return "用户名或密码不正确。";
  if (message.includes("Delete permission denied")) return "当前用户没有删除权限。";
  if (message.includes("Failed to fetch")) return "无法连接共享库，请检查网络或 Supabase 配置。";
  if (message.includes("Could not find the function")) return "共享库尚未初始化，请先在 Supabase 执行建表 SQL。";
  return message || "共享数据操作失败。";
}

function getRawErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  try {
    return typeof error === "string" ? error : JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function formatSharedLoginError(message: string, raw: string): string {
  const rawText = raw.trim();
  return rawText ? `${message}\n原始错误：${rawText}` : message;
}

function sortRefineRows(
  rows: ReturnType<typeof calculateColRowCompare>,
  field: RefineSortField,
  direction: SortDirection,
) {
  const multiplier = direction === "asc" ? 1 : -1;
  return [...rows].sort((left, right) => {
    let result = 0;
    if (field === "succeeded") {
      result = left.succeeded - right.succeeded;
    } else if (field === "failureRate") {
      result = left.failureRate - right.failureRate;
    } else {
      result = left.key - right.key;
    }
    return result * multiplier;
  });
}

function buildColRowCompareRows(
  rawDistances: readonly number[][],
  scopeValue: number,
  roundStart: number,
  roundBet: number,
  sortField: RefineSortField,
  sortDirection: SortDirection,
) {
  const scope = scopeValue < 0 ? Number.POSITIVE_INFINITY : scopeValue;
  const rows = calculateColRowCompare(rawDistances, scope, roundStart, roundBet);
  return sortRefineRows(rows, sortField, sortDirection);
}

function validateSessionName(name: string, sessions: SavedSession[], currentId?: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "名称不能为空";

  const logicalLength = Array.from(trimmed).reduce(
    (length, char) => length + (char.charCodeAt(0) > 255 ? 2 : 1),
    0,
  );
  if (logicalLength > 24) return "名称不能超过24个字符（1个中文占2个字符）";

  if (!/^[\w\-\u0100-\uffff]+$/u.test(trimmed)) {
    return "名称中有非法字符（名称只能包含英文字母、数字、减号、下划线、中文）";
  }

  const duplicated = sessions.some(
    (session) => session.id !== currentId && session.name.toLowerCase() === trimmed.toLowerCase(),
  );
  return duplicated ? "该名称已经存在，请重新输入" : null;
}

function parseSessionImport(text: string, existingSessions: SavedSession[]): { imported: SavedSession[]; skipped: number } {
  const raw = JSON.parse(text) as unknown;
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error("数据格式不正确，请检查。");
  }

  const names = new Set(existingSessions.map((session) => session.name.toLowerCase()));
  const incomingNames = new Set<string>();
  const imported: SavedSession[] = [];
  let skipped = 0;

  for (let index = 0; index < raw.length; index += 1) {
    const item = raw[index];
    if (!isImportItem(item)) throw new Error("数据格式不正确，请检查。");

    const name = item.Name.trim();
    const nameError = validateSessionName(name, existingSessions);
    if (nameError && nameError !== "该名称已经存在，请重新输入") {
      throw new Error(nameError);
    }

    const normalizedName = name.toLowerCase();
    if (names.has(normalizedName) || incomingNames.has(normalizedName)) {
      skipped += 1;
      continue;
    }
    incomingNames.add(normalizedName);

    const parsed = parseNumbersText(item.Numbers);
    if (parsed.invalidTokens.length > 0 || parsed.numbers.length === 0) {
      throw new Error("号码数据有问题，请检查。");
    }

    const time = typeof item.tms === "number" && Number.isFinite(item.tms) ? item.tms : Date.now() + index;
    const importIdx = typeof (item as { ImportIndex?: number }).ImportIndex === "number"
      ? (item as { ImportIndex?: number }).ImportIndex : index;
    const sharedUploader = typeof (item as { SharedUploader?: string }).SharedUploader === "string"
      ? (item as { SharedUploader?: string }).SharedUploader
      : typeof (item as { SharedId?: string }).SharedId === "string"
      ? (item as { SharedId?: string }).SharedId
      : "";
    imported.push({
      id: crypto.randomUUID?.() ?? `${Date.now()}-${index}`,
      name,
      numbers: parsed.numbers,
      updatedAt: new Date(time).toISOString(),
      importIndex: importIdx,
      sharedUploader,
    });
  }

  return { imported, skipped };
}

function isImportItem(item: unknown): item is { Name: string; Numbers: string; tms?: number } {
  return (
    typeof item === "object" &&
    item !== null &&
    "Name" in item &&
    "Numbers" in item &&
    typeof (item as { Name?: unknown }).Name === "string" &&
    typeof (item as { Numbers?: unknown }).Numbers === "string"
  );
}

function formatSessionTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (item: number) => item.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`;
}

/** Convert ISO date string to datetime-local input format (YYYY-MM-DDTHH:MM). */
function isoToDatetimeLocal(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

interface NumberButtonProps {
  className?: string;
  value: RouletteNumber;
  onClick: (value: RouletteNumber) => void;
}

function NumberButton({ className = "", value, onClick }: NumberButtonProps) {
  return (
    <button
      className={`number-key number-${getNumberColor(value)} ${className}`}
      onClick={() => onClick(value)}
      type="button"
    >
      {value}
    </button>
  );
}

function ColRowDetailView({ items }: { items: readonly ColRowWave[] }) {
  return (
    <div className="colrow-detail">
      {items.map((item) => (
        <div className="colrow-detail-row" key={item.key}>
          <strong>{item.label}</strong>
          <p>
            <span className={`colrow-current ${item.current === 0 ? "zero" : ""}`}>{item.current}</span>
            {item.distances.length > 0 ? `, ${item.distances.join(", ")}` : <span className="muted-text">暂无距离数据</span>}
          </p>
        </div>
      ))}
    </div>
  );
}

function ColRowChartView({ items, scope }: { items: readonly ColRowWave[]; scope: number }) {
  const orderedItems = [0, 4, 1, 5, 2, 6, 3, 7]
    .map((key) => items.find((item) => item.key === key))
    .filter((item): item is ColRowWave => Boolean(item));
  const rows = chunk(orderedItems, 2);

  return (
    <div className="colrow-chart-grid">
      {rows.map((row, rowIndex) => (
        <div className="colrow-chart-row" key={rowIndex}>
          {row.map((item) => (
            <section className="colrow-chart-cell" key={item.key}>
              <strong>{item.label}</strong>
              <ColRowMiniChart item={item} scope={scope} />
            </section>
          ))}
        </div>
      ))}
    </div>
  );
}

function ColRowMiniChart({ item, scope }: { item: ColRowWave; scope: number }) {
  const isAggregate = item.key === 3 || item.key === 7;
  const base = Math.max(1, Math.max(1, scope) * (isAggregate ? 0.5 : 0.5 / 3));
  const chart = { x: 10, y: 2, width: 360, height: 216 };
  const step = chart.width / (colRowSummaryHeaders.length + 1);

  return (
    <svg className="colrow-chart-svg" viewBox="0 0 380 270" role="img" aria-label={`${item.label}统计图`}>
      <rect x={chart.x} y={chart.y} width={chart.width} height={chart.height} fill="#fff" stroke="#7f7f7f" strokeWidth="1" />
      {[0, 1, 2, 3, 4, 5].map((line) => {
        const y = chart.y + (chart.height / 5) * line;
        return (
          <line
            key={line}
            x1={chart.x}
            x2={chart.x + chart.width}
            y1={y}
            y2={y}
            stroke={line === 0 || line === 5 ? "#1f1f1f" : "#9f9f9f"}
            strokeWidth="1"
          />
        );
      })}
      {item.summary.map((value, index) => {
        const x = chart.x + step * (index + 1);
        const rawHeight = (value / base) * chart.height;
        const isOverflow = rawHeight > chart.height;
        const height = Math.max(1, Math.min(chart.height, rawHeight));
        const width = isOverflow ? 20 * (rawHeight / chart.height) : 20;
        return (
          <rect
            fill={isOverflow ? "#cfa999" : isAggregate ? "#ff9977" : "#a9cf99"}
            height={height}
            key={colRowSummaryHeaders[index]}
            rx="1.5"
            width={width}
            x={x - width / 2}
            y={chart.y + chart.height - height}
          />
        );
      })}
      {colRowSummaryHeaders.map((header, index) => {
        const x = chart.x + step * (index + 1);
        return (
          <text
            fill="#20241f"
            fontFamily="var(--ui-font-family)"
            fontSize="31"
            key={header}
            textAnchor="middle"
            x={x}
            y={chart.y + chart.height + 38}
          >
            {header}
          </text>
        );
      })}
    </svg>
  );
}

interface ColRowSummaryViewProps {
  items: readonly ColRowWave[];
  results: readonly ColRowExploreResult[];
  selectedRounds: readonly number[];
  selectedRows: readonly number[];
  toggleRound: (round: number) => void;
  toggleRow: (index: number) => void;
}

function ColRowSummaryView({
  items,
  results,
  selectedRounds,
  selectedRows,
  toggleRound,
  toggleRow,
}: ColRowSummaryViewProps) {
  const selectableItems = items.filter((item) => item.key !== 3 && item.key !== 7);
  return (
    <div className="colrow-summary-stack">
      <table className="colrow-summary-table">
        <thead>
          <tr>
            <th aria-label="行组" />
            {colRowSummaryHeaders.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.key}>
              <th>{item.label}</th>
              {item.summary.map((value, index) => (
                <td key={colRowSummaryHeaders[index]}>{value}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <section className="colrow-explore" aria-label="行组探索">
        <div className="colrow-explore-panel colrow-explore-rows">
          <header>行组</header>
          <div>
            {selectableItems.map((item) => (
              <button
                className={selectedRows.includes(item.key) ? "selected" : ""}
                key={item.key}
                onClick={() => toggleRow(item.key)}
                type="button"
              >
                <span className="checkmark" />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="colrow-explore-panel colrow-explore-rounds">
          <header>轮次</header>
          <div>
            {colRowExploreRoundOptions.map((round) => (
              <button
                className={selectedRounds.includes(round) ? "selected" : ""}
                key={round}
                onClick={() => toggleRound(round)}
                type="button"
              >
                <span className="checkmark" />
                <span>{round}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="colrow-explore-panel colrow-explore-results">
          <header>筹码10元输赢</header>
          <div>
            {results.length > 0 ? (
              results.map((result) => (
                <p className={result.value > 0 ? "win" : result.value < 0 ? "lose" : "draw"} key={result.key}>
                  <span>{result.label}</span>
                  <strong>{result.value}元</strong>
                </p>
              ))
            ) : (
              <p className="muted-text">请选择行组和轮次</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

interface FrequencyOverviewChartProps {
  frequencyStats: FrequencyStats;
  onSelect: (key: number) => void;
  scopeIndex: number;
}

interface DistanceChartProps {
  detail: 1 | 8;
  distances: readonly number[][];
  onSelect?: (key: number) => void;
  selectedKey: number;
}

function DistanceOverviewChart({
  distances,
  onSelect,
}: {
  distances: readonly number[][];
  onSelect: (key: number) => void;
}) {
  return (
    <div className="distance-overview">
      {Array.from({ length: 8 }, (_, key) => (
        <button className="distance-overview-item" key={key} onClick={() => onSelect(key)} type="button">
          <DistanceChart detail={8} distances={distances} selectedKey={key} />
        </button>
      ))}
    </div>
  );
}

function DistanceSingleChart({
  distances,
  selectedKey,
}: {
  distances: readonly number[][];
  selectedKey: number;
}) {
  return (
    <div className="distance-detail-panel">
      <DistanceChart detail={1} distances={distances} selectedKey={selectedKey} />
    </div>
  );
}

function DistanceChart({ detail, distances, selectedKey }: DistanceChartProps) {
  const width = 1080;
  const height = detail === 1 ? 1000 : 190;
  const x0 = detail !== 8 ? 60 : 0;
  const rectX = detail === 1 ? 30 : 10;
  const rectY = detail === 1 ? 50 : 15;
  const rectW = width - rectX * 2 - x0;
  const rectH = height - rectY * 2;
  const maxPoints = selectedKey % 4 === 3 ? 216 : 72;
  const values = distances[selectedKey] ?? [];
  const startIndex = Math.max(0, values.length - maxPoints);
  const points = values.slice(startIndex).map((distance, index) => {
    const displayed = Math.min(Math.max(distance - 1, 0), 15);
    const x = x0 + rectX + (index * rectW) / (maxPoints - 1);
    const y = height - rectY - (displayed * rectH) / 15;
    return { x, y };
  });
  const seriesColor = selectedKey % 4 === 3 ? "#ee9274" : "#a9cf99";
  const seriesPoints = points.map((point) => `${point.x},${point.y}`).join(" ");
  const label = colRowLongLabels[selectedKey] ?? "";
  const labelX = detail === 8 ? 30 : x0 + rectX + (detail === 1 ? 30 : 20);
  const labelY = detail === 8 ? 70 : rectY + (detail === 1 ? 43 : 30) + rectH / 15;

  return (
    <svg
      className={`distance-svg distance-svg-${detail}`}
      role="img"
      aria-label={`${label}距离统计图`}
      viewBox={`0 0 ${width} ${height}`}
    >
      <g className="distance-grid">
        <line x1={x0 + rectX} x2={x0 + rectX} y1={rectY} y2={height - rectY} />
        <line x1={x0 + rectX + rectW} x2={x0 + rectX + rectW} y1={rectY} y2={height - rectY} />
        {Array.from({ length: 16 }, (_, index) => {
          const y = rectY + (index * rectH) / 15;
          const shouldDraw = detail !== 8 || index % 5 === 0;
          if (!shouldDraw) return null;
          const labelValue = 15 - index;
          return (
            <g key={index}>
              <line className={index % 5 === 0 ? "major" : ""} x1={x0 + rectX} x2={x0 + rectX + rectW} y1={y} y2={y} />
              {detail !== 8 && (detail === 1 || index % 5 === 0) ? (
                <text className="distance-axis-label" x={rectX} y={y - 6}>
                  {labelValue}
                </text>
              ) : null}
            </g>
          );
        })}
      </g>
      {seriesPoints ? (
        <polyline className="distance-series" fill="none" points={seriesPoints} stroke={seriesColor} />
      ) : null}
      {selectedKey % 4 !== 3
        ? points.map((point, index) => (
            <g className="distance-marker" key={index} stroke={seriesColor}>
              <line x1={point.x - 5} x2={point.x + 5} y1={point.y - 5} y2={point.y + 5} />
              <line x1={point.x - 5} x2={point.x + 5} y1={point.y + 5} y2={point.y - 5} />
            </g>
          ))
        : null}
      <text className="distance-band-label" x={labelX} y={labelY}>
        {label}
      </text>
    </svg>
  );
}

function FrequencyOverviewChart({ frequencyStats, onSelect, scopeIndex }: FrequencyOverviewChartProps) {
  const chart = {
    height: 1900,
    maxPoints: 180,
    width: 935,
    x0: 18,
    x1: 917,
    y0: 20,
  };
  const height100 = chart.height / 20;
  const height50 = height100 / 2;
  const bases = Array.from({ length: 8 }, (_, index) => chart.y0 + height100 * (2 * index + 1));
  const seriesLength = frequencyStats.frequencies[0]?.[scopeIndex]?.length ?? 0;
  const startIndex = Math.max(0, seriesLength - chart.maxPoints);

  return (
    <svg className="frequency-svg frequency-overview-svg" viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-label="频率统计图">
      <FrequencyGrid
        horizontalCount={31}
        verticalCount={10}
        x0={chart.x0}
        x1={chart.x1}
        y0={chart.y0}
        y1={chart.y0 + height50 * 31}
      />
      {frequencyStats.frequencies.map((item, bandIndex) => {
        const isAggregate = bandIndex === 3 || bandIndex === 7;
        const base = bases[bandIndex];
        const values = item[scopeIndex] ?? [];
        return (
          <g key={bandIndex}>
            <FrequencySeries
              base={base}
              colorMode={isAggregate ? "aggregate" : "signed"}
              height100={height100}
              maxPoints={chart.maxPoints}
              startIndex={startIndex}
              values={values}
            />
            <text className="frequency-band-label" x="25" y={base - height50 - 5}>
              {frequencyBandLabels[bandIndex]}
            </text>
            {!isAggregate ? (
              <rect
                aria-label={`${frequencyBandLabels[bandIndex]}明细`}
                className="frequency-hit-area"
                height={height100 * 2}
                onClick={() => onSelect(bandIndex)}
                role="button"
                tabIndex={0}
                width={chart.width}
                x="0"
                y={base - height100}
              />
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

interface FrequencyDetailChartProps {
  frequencyScopes: readonly FrequencyScope[];
  frequencyStats: FrequencyStats;
  onBack: () => void;
  selectedKey: number;
}

function FrequencyDetailChart({ frequencyScopes, frequencyStats, onBack, selectedKey }: FrequencyDetailChartProps) {
  const chart = {
    height: 1840,
    maxPoints: 180,
    width: 935,
    x0: 18,
    x1: 917,
    y0: 8,
  };
  const height100 = chart.height / (frequencyScopes.length * 2 + 4);
  const height50 = height100 / 2;
  const bases = frequencyScopes.map((_, index) => chart.y0 + height100 * (2 * index + 1));

  return (
    <svg
      aria-label={`${frequencyBandLabels[selectedKey]}各区间频率图`}
      className="frequency-svg frequency-detail-svg"
      onClick={onBack}
      role="img"
      viewBox={`0 0 ${chart.width} ${chart.height}`}
    >
      <FrequencyGrid
        horizontalCount={4 * frequencyScopes.length}
        verticalCount={10}
        x0={chart.x0}
        x1={chart.x1}
        y0={chart.y0}
        y1={chart.y0 + height50 * 4 * frequencyScopes.length}
      />
      {frequencyScopes.map((scope, scopeIndex) => {
        const values = frequencyStats.frequencies[selectedKey]?.[scopeIndex] ?? [];
        const startIndex = Math.max(0, values.length - chart.maxPoints);
        const base = bases[scopeIndex];
        return (
          <g key={scope}>
            <FrequencySeries
              base={base}
              colorMode="signed"
              height100={height100}
              maxPoints={chart.maxPoints}
              startIndex={startIndex}
              values={values}
            />
            <text className="frequency-band-label" x="25" y={base - height50 - 5}>
              {scope}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

interface FrequencyGridProps {
  horizontalCount: number;
  verticalCount: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

function FrequencyGrid({ horizontalCount, verticalCount, x0, x1, y0, y1 }: FrequencyGridProps) {
  return (
    <g className="frequency-grid">
      {Array.from({ length: horizontalCount + 1 }, (_, index) => {
        const y = y0 + ((y1 - y0) / horizontalCount) * index;
        return <line key={`h-${index}`} x1={x0} x2={x1} y1={y} y2={y} />;
      })}
      {Array.from({ length: verticalCount + 1 }, (_, index) => {
        const x = x0 + ((x1 - x0) / verticalCount) * index;
        return <line key={`v-${index}`} x1={x} x2={x} y1={y0} y2={y1} />;
      })}
    </g>
  );
}

interface FrequencySeriesProps {
  base: number;
  colorMode: "aggregate" | "signed";
  height100: number;
  maxPoints: number;
  startIndex: number;
  values: readonly number[];
}

function FrequencySeries({ base, colorMode, height100, maxPoints, startIndex, values }: FrequencySeriesProps) {
  const padLeft = values.length < maxPoints ? maxPoints - values.length : 0;
  return (
    <g>
      {values.slice(startIndex).map((value, index) => {
        const x = 20 + (padLeft + index) * 5;
        const color = colorMode === "aggregate" ? "#999999" : value >= 0 ? "#a9cf99" : "#eeaf9f";
        return (
          <line
            className="frequency-line"
            key={`${index}-${value}`}
            stroke={color}
            x1={x}
            x2={x}
            y1={base}
            y2={base - (value * height100) / 100}
          />
        );
      })}
    </g>
  );
}
