import type { RouletteNumber } from "../core/roulette";

const supabaseUrl = "https://hspjxwyyyxcuneksuudt.supabase.co";
const supabaseKey = "sb_publishable_pe9BMGuDN6XpS8XVS0oXYQ_OaUjpbjp";

export interface SharedSession {
  id: string;
  name: string;
  numbers: RouletteNumber[];
  uploader: string;
  createdAt: string;
  updatedAt: string;
}

export interface TransferSession {
  id: string;
  numbers: RouletteNumber[];
  uploader: string;
  createdAt: string;
}

interface SharedSessionRow {
  id: string;
  name: string;
  numbers: number[];
  uploader: string;
  created_at: string;
  updated_at: string;
}

interface TransferSessionRow {
  id: string;
  numbers: number[];
  uploader: string;
  created_at: string;
}

async function rpc<T>(functionName: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${functionName}`, {
    body: JSON.stringify(body),
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Supabase request failed: ${response.status}`);
  }

  const text = await response.text();
  return text ? (JSON.parse(text) as T) : (undefined as unknown as T);
}

function normalizeRow(row: SharedSessionRow): SharedSession {
  return {
    id: row.id,
    name: row.name,
    numbers: normalizeNumbers(row.numbers),
    uploader: row.uploader,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeTransferRow(row: TransferSessionRow): TransferSession {
  return {
    id: row.id,
    numbers: normalizeNumbers(row.numbers),
    uploader: row.uploader,
    createdAt: row.created_at,
  };
}

function normalizeNumbers(values: readonly number[]): RouletteNumber[] {
  return values.filter((value): value is RouletteNumber => Number.isInteger(value) && value >= 0 && value <= 36);
}

export async function checkSharedAccess(username: string, password: string): Promise<boolean> {
  return rpc<boolean>("londoner_check_access", {
    p_password: password,
    p_username: username,
  });
}

export async function listSharedSessions(username: string, password: string): Promise<SharedSession[]> {
  const rows = await rpc<SharedSessionRow[]>("londoner_list_sessions", {
    p_password: password,
    p_username: username,
  });
  return rows.map(normalizeRow);
}

export async function upsertSharedSession(input: {
  id?: string;
  name: string;
  numbers: readonly RouletteNumber[];
  password: string;
  updatedAt: string;
  username: string;
}): Promise<string> {
  return rpc<string>("londoner_upsert_session", {
    p_id: input.id ?? null,
    p_name: input.name,
    p_numbers: input.numbers,
    p_password: input.password,
    p_updated_at: input.updatedAt,
    p_username: input.username,
  });
}

export async function deleteSharedSession(username: string, password: string, id: string): Promise<void> {
  await rpc<null>("londoner_delete_session", {
    p_id: id,
    p_password: password,
    p_username: username,
  });
}

export async function deleteTransferSession(username: string, password: string, id: string): Promise<void> {
  await rpc<null>("londoner_delete_transfer_buffer", {
    p_id: id,
    p_password: password,
    p_username: username,
  });
}

export async function listTransferSessions(username: string, password: string): Promise<TransferSession[]> {
  const rows = await rpc<TransferSessionRow[]>("londoner_list_transfer_buffer", {
    p_password: password,
    p_username: username,
  });
  return rows.map(normalizeTransferRow);
}

export async function uploadTransferSession(input: {
  numbers: readonly RouletteNumber[];
  password: string;
  username: string;
}): Promise<string> {
  return rpc<string>("londoner_upload_transfer_buffer", {
    p_numbers: input.numbers,
    p_password: input.password,
    p_username: input.username,
  });
}
