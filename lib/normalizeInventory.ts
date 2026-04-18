import type { InventoryRow } from "./inventoryTypes";

function trimStr(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function formatPrecio(v: unknown): string {
  if (typeof v === "number" && Number.isFinite(v)) {
    return String(v);
  }
  return trimStr(v);
}

/** Normaliza un ítem del API ListSaldosBodegaMaestra al modelo de la UI. */
export function normalizeInventoryItem(raw: Record<string, unknown>): InventoryRow {
  return {
    referencia: trimStr(raw.Referencia ?? raw.referencia),
    nombreReferencia: trimStr(raw.NombreReferencia ?? raw.nombreReferencia),
    plu: trimStr(raw.Plu ?? raw.plu),
    precio: formatPrecio(raw.Precio ?? raw.precio),
    talla: trimStr(raw.Talla ?? raw.talla),
    imagen: trimStr(raw.Imagen ?? raw.imagen),
  };
}

export function normalizeInventoryPayload(data: unknown): InventoryRow[] {
  if (!Array.isArray(data)) {
    throw new Error("El API no devolvió un arreglo");
  }
  return data.map((item) => {
    if (item && typeof item === "object") {
      return normalizeInventoryItem(item as Record<string, unknown>);
    }
    throw new Error("Elemento inválido en la lista");
  });
}
