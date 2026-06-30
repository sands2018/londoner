export interface HistoryTimeRow {
  DataTime?: unknown;
  DataTms?: unknown;
  Name?: unknown;
  SaveTime?: unknown;
  dataTime?: unknown;
  dataTms?: unknown;
  date?: unknown;
  name?: unknown;
  tms?: unknown;
}

function makeLocalDateTms(year: number, month: number, day: number, hour = 12, minute = 0): number | null {
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
    || date.getHours() !== hour
    || date.getMinutes() !== minute
  ) {
    return null;
  }
  return date.getTime();
}

export function parseLooseHistoryTms(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Number.isNaN(new Date(value).getTime()) ? null : value;
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d+$/u.test(trimmed)) return parseLooseHistoryTms(Number(trimmed));

  const compact = trimmed.match(/^(\d{4})(\d{2})(\d{2})[-_ ]?(\d{2})(\d{2})$/u);
  if (compact) {
    return makeLocalDateTms(
      Number(compact[1]),
      Number(compact[2]),
      Number(compact[3]),
      Number(compact[4]),
      Number(compact[5]),
    );
  }

  const loose = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[ T]+(\d{1,2})(?::(\d{2}))?)?/u);
  if (loose) {
    return makeLocalDateTms(
      Number(loose[1]),
      Number(loose[2]),
      Number(loose[3]),
      loose[4] === undefined ? 12 : Number(loose[4]),
      loose[5] === undefined ? 0 : Number(loose[5]),
    );
  }

  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

export function inferHistoryNameTms(name: unknown): number | null {
  if (typeof name !== "string") return null;

  const compact = name.match(/(?:^|[^\d])(\d{4})(\d{2})(\d{2})[-_ ]?(\d{2})(\d{2})(?:[^\d]|$)/u);
  if (compact) {
    return makeLocalDateTms(
      Number(compact[1]),
      Number(compact[2]),
      Number(compact[3]),
      Number(compact[4]),
      Number(compact[5]),
    );
  }

  const dashedFourDigits = name.match(/(?:^|[^\d])(\d{4})[-.](\d{1,2})[-.](\d{1,2})[-_ ]+(\d{2})(\d{2})(?:[^\d]|$)/u);
  if (dashedFourDigits) {
    return makeLocalDateTms(
      Number(dashedFourDigits[1]),
      Number(dashedFourDigits[2]),
      Number(dashedFourDigits[3]),
      Number(dashedFourDigits[4]),
      Number(dashedFourDigits[5]),
    );
  }

  const withColon = name.match(/(?:^|[^\d])(\d{4})[-.](\d{1,2})[-.](\d{1,2})[-_ ]+(\d{1,2}):(\d{2})(?:[^\d]|$)/u);
  if (withColon) {
    return makeLocalDateTms(
      Number(withColon[1]),
      Number(withColon[2]),
      Number(withColon[3]),
      Number(withColon[4]),
      Number(withColon[5]),
    );
  }

  return null;
}

export function inferHistoryNameDateTms(name: unknown): number | null {
  if (typeof name !== "string") return null;
  const compact = name.match(/(?:^|[^\d])(\d{4})(\d{2})(\d{2})(?:[^\d]|$)/u);
  if (compact) return makeLocalDateTms(Number(compact[1]), Number(compact[2]), Number(compact[3]));
  const dashed = name.match(/(?:^|[^\d])(\d{4})[-.](\d{1,2})[-.](\d{1,2})(?:[^\d]|$)/u);
  if (dashed) return makeLocalDateTms(Number(dashed[1]), Number(dashed[2]), Number(dashed[3]));
  return null;
}

export function getHistoryDataTms(row: HistoryTimeRow, fallbackOrdinal = 0): number {
  return parseLooseHistoryTms(row.DataTms)
    ?? parseLooseHistoryTms(row.dataTms)
    ?? parseLooseHistoryTms(row.DataTime)
    ?? parseLooseHistoryTms(row.dataTime)
    ?? inferHistoryNameTms(row.Name ?? row.name)
    ?? parseLooseHistoryTms(row.tms)
    ?? parseLooseHistoryTms(row.SaveTime)
    ?? parseLooseHistoryTms(row.date)
    ?? inferHistoryNameDateTms(row.Name ?? row.name)
    ?? fallbackOrdinal;
}

export function getHistorySaveTms(row: HistoryTimeRow, fallbackOrdinal = 0): number {
  return parseLooseHistoryTms(row.tms)
    ?? parseLooseHistoryTms(row.SaveTime)
    ?? parseLooseHistoryTms(row.DataTms)
    ?? parseLooseHistoryTms(row.dataTms)
    ?? parseLooseHistoryTms(row.date)
    ?? inferHistoryNameDateTms(row.Name ?? row.name)
    ?? fallbackOrdinal;
}

export function getHistoryDataIso(row: HistoryTimeRow, fallbackOrdinal = 0): string {
  return new Date(getHistoryDataTms(row, fallbackOrdinal)).toISOString();
}

export function getHistorySortInfo(
  row: HistoryTimeRow,
  sourceIndex = 0,
): { date: string; minute: number; tie: number; tms: number } {
  const tms = getHistoryDataTms(row, sourceIndex);
  const date = new Date(tms);
  if (Number.isNaN(date.getTime())) {
    return { date: "9999-12-31", minute: 12 * 60, tie: sourceIndex, tms };
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const wzsTie = typeof row.Name === "string" || typeof row.name === "string"
    ? String(row.Name ?? row.name).match(/^wzs-\d{4}-\d{2}-\d{2}-(\d+)/u)
    : null;
  return {
    date: `${year}-${month}-${day}`,
    minute: date.getHours() * 60 + date.getMinutes(),
    tie: wzsTie ? Number(wzsTie[1]) : sourceIndex,
    tms,
  };
}
