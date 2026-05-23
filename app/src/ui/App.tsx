import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  getNumberColor,
  getNumberColRows,
  isRouletteNumber,
  type ColRowIndex,
  type RouletteNumber,
} from "../core/roulette";
import { Keyboard } from "lucide-react";
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
  frequencyScopes,
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
import type { SavedSession } from "../storage/storage";
import {
  CHASE_LENGTH,
  ColdReversalEngine,
  computeRoi,
  EXTREME_PCT,
  GAP_WINDOW,
  MIN_GAP,
  PredictionTracker,
  PROGRESSION,
  type ColdSignal,
} from "../core/prediction";

const storage = new LocalStorageAdapter();
const keyboardModeKey = "londoner.keyboardMode";
const currentSessionIdKey = "londoner.currentSessionId";
const colRowScopeKey = "londoner.colRowScope";
const refineScopeKey = "londoner.refineScope";
const otherScopeKey = "londoner.otherScope";
const statScopes = [8, 13, 21, 40, 60, 100, -1];
const colRowScopes = [18, 36, 72, 144, 288, -1];
const columnMinimums = [3, 4, 5, 6, 7];
const boardRows: RouletteNumber[][] = [
  [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
  [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
  [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
];
const keypadRows: RouletteNumber[][] = [
  [1, 2, 3, 4, 5, 6, 7, 8, 9],
  [10, 11, 12, 13, 14, 15, 16, 17, 18],
  [19, 20, 21, 22, 23, 24, 25, 26, 27],
  [28, 29, 30, 31, 32, 33, 34, 35, 36],
];

type DialogName = "import" | "save" | null;
type DataSortField = "name" | "count" | "time";
type SortDirection = "asc" | "desc";
type ColRowTab = "detail" | "chart" | "summary";
type RefineTab = "compare" | "detail";
type OtherTab = "longs" | "numbers" | "rounds";
type OtherRoundTab = "bet" | "summary";
type RefineSortField = "name" | "succeeded" | "failureRate";

interface NoticeDialog {
  message: string;
  title: string;
}

interface ConfirmDialog extends NoticeDialog {
  confirmText?: string;
  onConfirm: () => Promise<void> | void;
}

interface PromptDialog {
  confirmText?: string;
  defaultValue: string;
  message: string;
  onConfirm: (value: string) => Promise<void> | void;
  title: string;
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
  const [statsScope, setStatsScope] = useState(21);
  const [colRowScope, setColRowScope] = useState(() => {
    const stored = Number.parseInt(localStorage.getItem(colRowScopeKey) ?? "", 10);
    return colRowScopes.includes(stored) ? stored : 72;
  });
  const [columnMinimum, setColumnMinimum] = useState(5);
  const [loaded, setLoaded] = useState(false);
  const [activeDialog, setActiveDialog] = useState<DialogName>(null);
  const [dataViewOpen, setDataViewOpen] = useState(false);
  const [gameViewOpen, setGameViewOpen] = useState(false);
  const [colRowViewOpen, setColRowViewOpen] = useState(false);
  const [frequencyViewOpen, setFrequencyViewOpen] = useState(false);
  const [distanceViewOpen, setDistanceViewOpen] = useState(false);
  const [refineViewOpen, setRefineViewOpen] = useState(false);
  const [otherViewOpen, setOtherViewOpen] = useState(false);
  const [predictionViewOpen, setPredictionViewOpen] = useState(false);
  const [colRowTab, setColRowTab] = useState<ColRowTab>("detail");
  const [refineTab, setRefineTab] = useState<RefineTab>("compare");
  const [otherTab, setOtherTab] = useState<OtherTab>("longs");
  const [otherRoundTab, setOtherRoundTab] = useState<OtherRoundTab>("bet");
  const [otherLongBetCount, setOtherLongBetCount] = useState(4);
  const [otherLongRound, setOtherLongRound] = useState(5);
  const [otherNumberSortField, setOtherNumberSortField] = useState<OtherNumberSortField>("number");
  const [otherNumberSortDirection, setOtherNumberSortDirection] = useState<SortDirection>("desc");
  const [refineRoundStart, setRefineRoundStart] = useState(0);
  const [refineRoundBet, setRefineRoundBet] = useState(1);
  const [refineSortField, setRefineSortField] = useState<RefineSortField>("succeeded");
  const [refineSortDirection, setRefineSortDirection] = useState<SortDirection>("desc");
  const [refineScope, setRefineScope] = useState(() => {
    const stored = Number.parseInt(localStorage.getItem(refineScopeKey) ?? "", 10);
    return colRowScopes.includes(stored) ? stored : 72;
  });
  const [otherScope, setOtherScope] = useState(() => {
    const stored = Number.parseInt(localStorage.getItem(otherScopeKey) ?? "", 10);
    return colRowScopes.includes(stored) ? stored : 72;
  });
  const [frequencyScopeIndex, setFrequencyScopeIndex] = useState(0);
  const [frequencyDetailKey, setFrequencyDetailKey] = useState<number | null>(null);
  const [distanceDetailKey, setDistanceDetailKey] = useState<number | null>(null);
  const [colRowExploreRows, setColRowExploreRows] = useState<number[]>(() => loadColRowExploreSelections().rows);
  const [colRowExploreRounds, setColRowExploreRounds] = useState<number[]>(() => loadColRowExploreSelections().rounds);
  const [configViewOpen, setConfigViewOpen] = useState(false);
  const [betsManageOpen, setBetsManageOpen] = useState(false);
  const [dataText, setDataText] = useState("");
  const [toolsOpen, setToolsOpen] = useState(false);
  const [toolsText, setToolsText] = useState("");
  const [toolsKeepBreaks, setToolsKeepBreaks] = useState(false);
  const [importMode, setImportMode] = useState<"current" | "files">("current");
  const [dialogMessage, setDialogMessage] = useState("");
  const [noticeDialog, setNoticeDialog] = useState<NoticeDialog | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null);
  const [promptDialog, setPromptDialog] = useState<PromptDialog | null>(null);
  const [promptValue, setPromptValue] = useState("");
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
  const [sessionSortField, setSessionSortField] = useState<DataSortField>("name");
  const [sessionSortDirection, setSessionSortDirection] = useState<SortDirection>("desc");
  const [gameSortField, setGameSortField] = useState<GameSortField>("won");
  const [gameSortDirection, setGameSortDirection] = useState<GameSortDirection>("desc");
  const [gameSettingsRevision, setGameSettingsRevision] = useState(0);

  // 预测引擎初始化
  const predictionEngine = useMemo(() => new ColdReversalEngine(), []);
  const predictionTracker = useMemo(() => new PredictionTracker(), []);

  const predictions = useMemo(() => {
    if (numbers.length < 10) return [];
    return predictionEngine.analyze(numbers);
  }, [numbers, predictionEngine]);

  const predictionAccuracy = predictionTracker.getFormattedAccuracy();
  const predictionRecordCount = predictionTracker.count;

  const sessionRoi = useMemo(() => computeRoi(numbers), [numbers]);

  // 直接从号码推算追号状态 — 不存独立state, 永远同步
  const signalDisplay = useMemo(() => {
    const items: Array<{ ci: ColRowIndex; label: string; round: number; betAmt: number; isNew: boolean; currentGap: number; threshold: number }> = [];
    if (predictions.length === 0) return items;

    for (const s of predictions) {
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
        items.push({ ci: s.index, label: s.label, round: 1, betAmt: 1, isNew: true, currentGap: s.currentGap, threshold: s.threshold });
      } else if (done < chaseLen) {
        const nr = done + 1;
        items.push({ ci: s.index, label: s.label, round: nr, betAmt: [1,2,4,8][nr-1]??8, isNew: false, currentGap: s.currentGap, threshold: s.threshold });
      }
    }
    return items;
  }, [predictions, numbers]);

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
  }, []);

  useEffect(() => {
    if (loaded && numbers.length >= 10) {
      predictionTracker.backfill(predictionEngine, numbers);
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

  function getPredictionRank(predictions: ColdSignal[], item: ColdSignal): number {
    const sorted = [...predictions].sort((a, b) => b.excess - a.excess);
    const index = sorted.findIndex((p) => p.index === item.index);
    return Math.min(3, index);
  }

  function addNumber(value: RouletteNumber) {
    if (predictions.length > 0 && value !== 0) {
      predictionTracker.record(predictions, value);
    }

    setNumbers([...numbers, value]);
    setRedoNumbers([]);
  }

  function undo() {
    const removed = numbers.at(-1);
    if (removed === undefined) return;

    setNumbers(numbers.slice(0, -1));
    setRedoNumbers([...redoNumbers, removed]);
  }
      const newLen = numbers.length - 1;
  function redo() {
    const restored = redoNumbers.at(-1);
    if (restored === undefined) return;

    setNumbers([...numbers, restored]);
    setRedoNumbers(redoNumbers.slice(0, -1));
  }

  async function refreshSessions() {
    setSessions(await storage.listSessions());
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
    });
    await refreshSessions();
    setLastSavedNumbers(numbers);
    setNoticeDialog({ title: "保存成功", message: `保存"${currentSession.name}"成功。` });
  }

  async function persistSession(name: string, existingId?: string) {
    const id = existingId ?? crypto.randomUUID?.() ?? `${Date.now()}`;
    await storage.saveSession({
      id,
      name,
      numbers,
      updatedAt: new Date().toISOString(),
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
    setDataViewOpen(true);
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
    clearCurrentSession();
    setActiveDialog(null);
    setNoticeDialog({ title: "导入数据", message: `已导入 ${parsed.numbers.length} 个数字。` });
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
      })),
    );

    const copied = await copyTextToClipboard(text);
    setNoticeDialog({
      title: "导出数据",
      message: copied ? "数据已经用 JSON 格式导出到剪贴板。" : "数据复制失败，请检查浏览器剪贴板权限。",
    });
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
      setSessionSortDirection(field === "name" ? "desc" : "asc");
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

  const visibleQueueRows = [queueItems];
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
  const frequencyStats = useMemo(() => calculateFrequencyStats(numbers), [numbers]);
  const distanceStats = colRowStats.rawDistances;
  const refineCompareRows = useMemo(() => {
    const scope = refineScope < 0 ? Number.POSITIVE_INFINITY : refineScope;
    const rows = calculateColRowCompare(colRowStats.rawDistances, scope, refineRoundStart, refineRoundBet);
    return sortRefineRows(rows, refineSortField, refineSortDirection);
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

  function openPredictionView() {
    setGameViewOpen(false);
    setColRowViewOpen(false);
    setFrequencyViewOpen(false);
    setDistanceViewOpen(false);
    setRefineViewOpen(false);
    setOtherViewOpen(false);
    setPredictionViewOpen(true);
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

  return (
    <main className={`app-shell theme-${themeMode} ${keyboardVisible ? "" : "keyboard-hidden"}`}>
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
        {visibleQueueRows.map((row, rowIndex) => (
          <div className="queue-row" key={rowIndex}>
            {row.map((value, index) => (
              <span
                className={`queue-chip number-${getNumberColor(value)}`}
                key={`${rowIndex}-${index}-${numbers.length}`}
              >
                {value}
              </span>
            ))}
          </div>
        ))}
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

      {signalDisplay.length > 0 ? (
        <section className="prediction-signal-area" aria-label="预测信号">
          {signalDisplay.map((item) => (
            <div
              className={`prediction-signal-item ${item.isNew ? "" : "chase-active"}`}
              key={item.ci}
              onClick={openPredictionView}
              role="button"
              tabIndex={0}
            >
              <strong className="prediction-signal-label">{item.label}</strong>
              <span className="prediction-chase">
                <span className="prediction-dots">
                  {[1,2,3,4].map((n) => (
                    <span key={n} className={`prediction-dot ${n <= item.round ? "filled" : ""}`} />
                  ))}
                </span>
                <span style={{ color: "#555", fontSize: 14, fontWeight: 500 }}>{item.betAmt}</span>
              </span>
            </div>
          ))}
        </section>
      ) : null}

      {keyboardVisible ? (
      <section className="input-dock" aria-label="号码输入">
        <div className="dock-actions">
          <div className="dock-brand" aria-label="SANDS">
            S<span>A</span>NDS
          </div>
          <button onClick={() => void exportCurrentData()} type="button">导出</button>
          <button onClick={openImportDialog} type="button">导入</button>
          <button disabled={!hasUnsavedChanges} onClick={openSaveDialog} type="button">保存</button>
          <button onClick={openSaveAsDialog} type="button">另存</button>
          <button onClick={openDataDialog} type="button">数据</button>
          <button onClick={openConfigView} type="button">配置</button>
          <button onClick={openPredictionView} type="button">预测</button>
          <button onClick={openGameView} type="button">打法</button>
          <button onClick={openColRowView} type="button">行组</button>
          <button onClick={openFrequencyView} type="button">频率</button>
          <button onClick={openDistanceView} type="button">距离</button>
          <button onClick={openRefineView} type="button">细化</button>
          <button onClick={openOtherView} type="button">其它</button>
        </div>

        {keyboardMode === "keypad" ? (
          <div className="keypad-grid portrait-keypad">
            {keypadRows.flat().map((value) => (
              <NumberButton key={value} value={value} onClick={addNumber} />
            ))}
            <NumberButton className="zero-key keypad-zero" value={0} onClick={addNumber} />
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
            <button className="control-button" onClick={() => setKeyboardVisible(false)}>
              X
            </button>
          </div>
        ) : (
          <div className="board-grid">
            {boardRows.flat().map((value) => (
              <NumberButton key={value} value={value} onClick={addNumber} />
            ))}
            <NumberButton className="board-wide-4 zero-key" value={0} onClick={addNumber} />
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
              className="control-button board-wide-3"
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
                  <th onClick={() => sortDataView("time")}>
                    时间 <SortMark active={sessionSortField === "time"} direction={sessionSortDirection} />
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedSessions.length === 0 ? (
                  <tr>
                    <td className="data-empty" colSpan={3}>暂无保存的数据</td>
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
                    <td>{formatSessionTime(session.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <footer className="data-screen-actions">
            <button disabled={selectedSessions.length !== 1} onClick={() => openSession(selectedSessions[0])} type="button">
              打开
            </button>
            <button disabled={selectedSessions.length !== 1} onClick={() => renameSession(selectedSessions[0])} type="button">
              更名
            </button>
            <button
              disabled={selectedSessions.length < 1}
              onClick={() =>
                setConfirmDialog({
                  title: "请确认",
                  message: "确定要删除当前选中的数据吗？",
                  confirmText: "删除",
                  onConfirm: () => deleteSessions(selectedSessions),
                })
              }
              type="button"
            >
              删除
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
            <button disabled={sortedSessions.length === 0} onClick={() => void exportSessions(selectedSessions)} type="button">
              导出
            </button>
            <button onClick={openToolsDialog} type="button">工具</button>
          </footer>
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
              <button onClick={openPredictionView} type="button">预测</button>
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
              <button onClick={openPredictionView} type="button">预测</button>
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

      {predictionViewOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <section className="prediction-screen" aria-label="冷门反转">
            <div className="modal-head">
              <strong>冷门反转</strong>
              <button className="close-button" onClick={() => setPredictionViewOpen(false)} type="button">x</button>
            </div>
            <div className="prediction-body">
              <p className="prediction-desc">当某个行组太久没出、超出历史常规范围时触发信号</p>
            {signalDisplay.length === 0 ? (
              <div className="prediction-empty">
                <p>暂无冷门信号</p>
                <p className="muted-text">当前数据: {numbers.length} 轮</p>
                <p className="muted-text">当某个行组连续未出现超过历史{Math.round(EXTREME_PCT * 100)}%分位时触发</p>
              </div>
            ) : (
              <>
                <div className="prediction-roi-table">
                  <div className="prediction-roi-row">
                    <span>数据量</span>
                    <span>总投入</span>
                    <span>总赢回</span>
                    <span>ROI</span>
                  </div>
                  <div className="prediction-roi-row">
                    <strong>{numbers.length}</strong>
                    <strong>{sessionRoi.bet}</strong>
                    <strong>{sessionRoi.win}</strong>
                    <strong style={{ color: sessionRoi.roi >= 0 ? "#5f9a70" : "#b85a3a" }}>{sessionRoi.roi >= 0 ? "+" : ""}{sessionRoi.roi.toFixed(1)}%</strong>
                  </div>
                </div>

                <div className="cold-strategy-bar">
                  <span>追{CHASE_LENGTH}轮</span>
                  <span>翻倍 {PROGRESSION.join(" → ")}</span>
                  <span>基准 {GAP_WINDOW}次 {Math.round(EXTREME_PCT * 100)}%分位</span>
                </div>

                <div className="cold-signal-list">
                  {signalDisplay.map((item) => (
                    <div className="cold-signal-card" key={item.ci}>
                      <strong className="cold-signal-label">{item.label}</strong>
                      <div className="cold-signal-body">
                        <div className="cold-signal-row">
                          <span>历史{Math.round(EXTREME_PCT * 100)}%上限 <strong>{item.threshold}</strong> 轮</span>
                        </div>
                        <div className="cold-signal-row">
                          <span>已 <strong>{item.currentGap}</strong> 轮未出</span>
                          <span className="prediction-dots">
                            {[1,2,3,4].map((n) => (
                              <span key={n} className={`prediction-dot ${n <= item.round ? "filled" : ""}`} />
                            ))}
                          </span>
                          <span>押<strong>{item.betAmt}</strong></span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

              </>
            )}
          </div>
          </section>
        </div>
      ) : null}

      {configViewOpen ? (
        <div className="config-backdrop" role="dialog" aria-modal="true" aria-label="打法配置">
          <section className="config-dialog">
            <header className="config-dialog-head">
              <strong>打法配置</strong>
              <button className="close-button" onClick={() => setConfigViewOpen(false)} type="button">x</button>
            </header>
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
            <footer className="config-actions">
              <button onClick={saveConfigView} type="button">确定</button>
              <button onClick={() => setConfigViewOpen(false)} type="button">取消</button>
              <button onClick={openBetsManage} type="button">管理</button>
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
              <strong>{activeDialog === "save" ? "保存" : "导入"}</strong>
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

            {activeDialog === "import" ? (
              <div className="modal-stack">
                <textarea
                  className="data-textarea"
                  onChange={(event) => setDataText(event.target.value)}
                  value={dataText}
                />
                <div className="modal-actions single-action">
                  <button className="primary-action" onClick={importMode === "files" ? importFilesFromText : importData} type="button">
                    导入
                  </button>
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
            <>
              <button onClick={() => setConfirmDialog(null)} type="button">取消</button>
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
            </>
          }
        >
          {confirmDialog.message}
        </MessageDialog>
      ) : null}

      {promptDialog ? (
        <MessageDialog
          title={promptDialog.title}
          onClose={() => setPromptDialog(null)}
          actions={
            <>
              <button onClick={() => setPromptDialog(null)} type="button">取消</button>
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
            </>
          }
        >
          <label className="field-label">
            {promptDialog.message}
            <input value={promptValue} onChange={(event) => setPromptValue(event.target.value)} />
          </label>
        </MessageDialog>
      ) : null}
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

interface MessageDialogProps {
  actions?: ReactNode;
  children: ReactNode;
  onClose: () => void;
  title: string;
}

function MessageDialog({ actions, children, onClose, title }: MessageDialogProps) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="message-panel">
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
    } else {
      result = left.name.localeCompare(right.name, "zh-Hans-CN");
    }
    return result * multiplier;
  });
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
    imported.push({
      id: crypto.randomUUID?.() ?? `${Date.now()}-${index}`,
      name,
      numbers: parsed.numbers,
      updatedAt: new Date(time).toISOString(),
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
  frequencyStats: FrequencyStats;
  onBack: () => void;
  selectedKey: number;
}

function FrequencyDetailChart({ frequencyStats, onBack, selectedKey }: FrequencyDetailChartProps) {
  const chart = {
    height: 1840,
    maxPoints: 180,
    width: 935,
    x0: 18,
    x1: 917,
    y0: 8,
  };
  const height100 = chart.height / 16;
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
