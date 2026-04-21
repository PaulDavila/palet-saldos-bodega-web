import { NextResponse } from "next/server";
import {
  loadInventoryFromBlob,
  saveInventoryToBlob,
} from "@/lib/inventoryBlobCache";
import { httpsGetJson } from "@/lib/httpsGetJson";
import { normalizeInventoryPayload } from "@/lib/normalizeInventory";

export const runtime = "nodejs";

/** Evita que Vercel corte la función antes de que termine el GET al API (lista grande). */
export const maxDuration = 60;

const DEFAULT_URL =
  "https://apiservices.lineadirectaec.com/APiPalet/api/Admin/ListSaldosBodegaMaestra";

export async function GET(request: Request) {
  const url = process.env.INVENTORY_API_URL?.trim() || DEFAULT_URL;
  const username = process.env.INVENTORY_API_USERNAME?.trim();
  const password = process.env.INVENTORY_API_PASSWORD?.trim();
  const tlsInsecure = process.env.INVENTORY_TLS_INSECURE === "1";
  const hasBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());

  const { searchParams } = new URL(request.url);
  const refresh = searchParams.get("refresh") === "1";

  if (!username || !password) {
    return NextResponse.json(
      {
        error:
          "Faltan variables de entorno INVENTORY_API_USERNAME / INVENTORY_API_PASSWORD",
      },
      { status: 500 }
    );
  }

  const headers = {
    Username: username,
    Password: password,
  };

  if (refresh) {
    try {
      const raw = await httpsGetJson(url, headers, {
        rejectUnauthorized: !tlsInsecure,
      });
      const items = normalizeInventoryPayload(raw);
      const savedAt = new Date().toISOString();

      let blobWarning: string | undefined;
      if (hasBlob) {
        try {
          await saveInventoryToBlob({ items, savedAt });
        } catch (e) {
          blobWarning =
            e instanceof Error
              ? e.message
              : "No se pudo guardar en Vercel Blob";
        }
      }

      return NextResponse.json({
        items,
        savedAt,
        source: "upstream" as const,
        storage: hasBlob && !blobWarning ? ("blob" as const) : ("none" as const),
        ...(blobWarning ? { warning: blobWarning } : {}),
        ...(!hasBlob
          ? {
              hint: "Configure BLOB_READ_WRITE_TOKEN en Vercel (Storage → Blob) para persistir entre visitas.",
            }
          : {}),
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Error desconocido";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  /* Sin refresh: servir copia desde Vercel Blob */
  if (!hasBlob) {
    return NextResponse.json({
      items: [],
      savedAt: null,
      source: "empty" as const,
      message:
        "Sin almacenamiento Blob. Pulse Actualizar información (requiere BLOB_READ_WRITE_TOKEN en Vercel).",
    });
  }

  try {
    const cached = await loadInventoryFromBlob();
    if (cached && cached.items.length > 0) {
      return NextResponse.json({
        items: cached.items,
        savedAt: cached.savedAt,
        source: "blob" as const,
      });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error leyendo Blob";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({
    items: [],
    savedAt: null,
    source: "empty" as const,
    message: "Aún no hay datos en el servidor. Pulse Actualizar información.",
  });
}
