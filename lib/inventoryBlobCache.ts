import { BlobNotFoundError, get, put } from "@vercel/blob";
import type { InventoryRow } from "./inventoryTypes";

const BLOB_PATH = "inventario/saldos-cache.json";

export type CachedInventoryPayload = {
  items: InventoryRow[];
  savedAt: string;
};

function streamToString(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  return (async () => {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    return Buffer.concat(chunks).toString("utf8");
  })();
}

/** Lee el JSON guardado en Vercel Blob (privado, solo servidor). */
export async function loadInventoryFromBlob(): Promise<CachedInventoryPayload | null> {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) return null;

  try {
    const res = await get(BLOB_PATH, { access: "private", token });
    if (!res || res.statusCode !== 200 || !res.stream) return null;
    const raw = await streamToString(res.stream);
    const parsed = JSON.parse(raw) as CachedInventoryPayload;
    if (!parsed?.items || !Array.isArray(parsed.items) || !parsed.savedAt) {
      return null;
    }
    return parsed;
  } catch (e) {
    if (e instanceof BlobNotFoundError) return null;
    throw e;
  }
}

/** Guarda el inventario completo en Blob (sustituye el archivo anterior). */
export async function saveInventoryToBlob(payload: CachedInventoryPayload): Promise<void> {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) {
    throw new Error("Falta BLOB_READ_WRITE_TOKEN");
  }

  const body = JSON.stringify(payload);
  const useMultipart = body.length > 4_000_000;

  await put(BLOB_PATH, body, {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    token,
    multipart: useMultipart,
  });
}
