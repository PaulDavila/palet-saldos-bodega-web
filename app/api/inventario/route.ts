import { NextResponse } from "next/server";
import { httpsGetJson } from "@/lib/httpsGetJson";
import { normalizeInventoryPayload } from "@/lib/normalizeInventory";

export const runtime = "nodejs";

/** Evita que Vercel corte la función antes de que termine el GET al API (lista grande). */
export const maxDuration = 60;

const DEFAULT_URL =
  "https://apiservices.lineadirectaec.com/APiPalet/api/Admin/ListSaldosBodegaMaestra";

export async function GET() {
  const url = process.env.INVENTORY_API_URL?.trim() || DEFAULT_URL;
  const username = process.env.INVENTORY_API_USERNAME?.trim();
  const password = process.env.INVENTORY_API_PASSWORD?.trim();
  const tlsInsecure = process.env.INVENTORY_TLS_INSECURE === "1";

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

  try {
    const raw = await httpsGetJson(url, headers, {
      rejectUnauthorized: !tlsInsecure,
    });
    const items = normalizeInventoryPayload(raw);
    return NextResponse.json({ items });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
