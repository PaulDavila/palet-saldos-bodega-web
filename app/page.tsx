"use client";

import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import type { InventoryRow } from "@/lib/inventoryTypes";

const STORAGE_KEY = "inventario_saldos_v1";
const CACHE_EVENT = "inventory-cache-updated";

const GLOD_MSG = "Contactar con Glod para Revisar el Problema";

type StoredShape = { items: InventoryRow[]; savedAt?: string };

type CacheSnapshot = { items: InventoryRow[]; savedAt: string | null };

const serverEmpty: CacheSnapshot = { items: [], savedAt: null };

let lastRawKey = "\u0000";
let lastSnapshot: CacheSnapshot = serverEmpty;

/** Misma referencia si el contenido de localStorage no cambió (evita bucles con useSyncExternalStore). */
function getClientSnapshot(): CacheSnapshot {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? "";
    if (raw === lastRawKey) return lastSnapshot;
    lastRawKey = raw;
    if (!raw) {
      lastSnapshot = { items: [], savedAt: null };
      return lastSnapshot;
    }
    const parsed = JSON.parse(raw) as StoredShape;
    if (parsed && Array.isArray(parsed.items)) {
      lastSnapshot = { items: parsed.items, savedAt: parsed.savedAt ?? null };
    } else {
      lastSnapshot = { items: [], savedAt: null };
    }
    return lastSnapshot;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    lastRawKey = "";
    lastSnapshot = { items: [], savedAt: null };
    return lastSnapshot;
  }
}

function notifyCache() {
  window.dispatchEvent(new Event(CACHE_EVENT));
}

function saveToStorage(items: InventoryRow[]) {
  const payload: StoredShape = {
    items,
    savedAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  notifyCache();
}

function clearStorageCache() {
  localStorage.removeItem(STORAGE_KEY);
  notifyCache();
}

function subscribe(onStoreChange: () => void) {
  const fn = () => onStoreChange();
  window.addEventListener(CACHE_EVENT, fn);
  window.addEventListener("storage", fn);
  return () => {
    window.removeEventListener(CACHE_EVENT, fn);
    window.removeEventListener("storage", fn);
  };
}

function getServerSnapshot(): CacheSnapshot {
  return serverEmpty;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function Home() {
  const { items, savedAt: lastOkAt } = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot
  );

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [copyHint, setCopyHint] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      clearStorageCache();
      const res = await fetch("/api/inventario", { cache: "no-store" });
      let data: { items?: InventoryRow[]; error?: string };
      try {
        data = (await res.json()) as { items?: InventoryRow[]; error?: string };
      } catch {
        setApiError("Respuesta inválida (no JSON)");
        return;
      }
      if (!res.ok) {
        setApiError(data.error || `Error HTTP ${res.status}`);
        return;
      }
      if (!data.items || !Array.isArray(data.items)) {
        setApiError("Respuesta inválida del servidor");
        return;
      }
      saveToStorage(data.items);
      setApiError(null);
    } catch {
      setApiError("No se pudo conectar con el servidor");
    } finally {
      setLoading(false);
    }
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim();
    if (!q) return [];
    const ql = q.toLowerCase();
    return items.filter((r) => r.referencia.toLowerCase() === ql);
  }, [items, search]);

  const onCopyPlus = useCallback(async () => {
    const text = filtered.map((r) => r.plu).join("\n");
    if (!text) return;
    const ok = await copyText(text);
    setCopyHint(ok ? "PLUs copiados al portapapeles." : "No se pudo copiar (permiso del navegador).");
    setTimeout(() => setCopyHint(null), 3000);
  }, [filtered]);

  const onCopyRow = useCallback(async (row: InventoryRow) => {
    const cells = [
      row.referencia,
      row.nombreReferencia,
      row.plu,
      row.precio,
      row.talla,
      row.imagen,
    ];
    const ok = await copyText(cells.join("\t"));
    setCopyHint(ok ? "Fila copiada (TSV)." : "No se pudo copiar.");
    setTimeout(() => setCopyHint(null), 3000);
  }, []);

  const onCopyTableTsv = useCallback(async () => {
    const header = [
      "Referencia",
      "Nombre de referencia",
      "Plu",
      "Precio",
      "Talla",
      "Imagen",
    ].join("\t");
    const lines = filtered.map((r) =>
      [r.referencia, r.nombreReferencia, r.plu, r.precio, r.talla, r.imagen].join(
        "\t"
      )
    );
    const ok = await copyText([header, ...lines].join("\n"));
    setCopyHint(ok ? "Tabla copiada (TSV, pega en Excel)." : "No se pudo copiar.");
    setTimeout(() => setCopyHint(null), 3000);
  }, [filtered]);

  return (
    <div className="wrap">
      <header className="head">
        <h1>Inventario — saldos bodega</h1>
        <p className="muted">
          Datos en este equipo (local). Use &quot;Actualizar información&quot; para
          volver a descargar desde el servidor.
        </p>
      </header>

      {apiError ? (
        <div className="alert" role="alert">
          <strong>{GLOD_MSG}</strong>
          <p className="alert-detail">{apiError}</p>
        </div>
      ) : null}

      <section className="toolbar">
        <button
          type="button"
          className="btn primary"
          onClick={() => void refresh()}
          disabled={loading}
        >
          {loading ? "Actualizando…" : "Actualizar información"}
        </button>
        {lastOkAt ? (
          <span className="muted small">
            Última carga correcta: {new Date(lastOkAt).toLocaleString("es-EC")}
          </span>
        ) : (
          <span className="muted small">Sin datos guardados aún.</span>
        )}
      </section>

      <section className="search-block">
        <label htmlFor="ref-search">Buscar por referencia (coincidencia exacta)</label>
        <div className="search-row">
          <input
            id="ref-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ej: 286001"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <p className="muted small">
          {items.length > 0
            ? `${items.length} registros en caché.`
            : "No hay caché: pulse Actualizar información."}
        </p>
      </section>

      {copyHint ? <p className="hint">{copyHint}</p> : null}

      {search.trim() && filtered.length === 0 && items.length > 0 ? (
        <p className="muted">No hay filas con esa referencia.</p>
      ) : null}

      {search.trim() && filtered.length > 0 ? (
        <section className="table-wrap">
          <div className="table-actions">
            <button type="button" className="btn" onClick={() => void onCopyPlus()}>
              Copiar PLUs visibles
            </button>
            <button type="button" className="btn" onClick={() => void onCopyTableTsv()}>
              Copiar tabla (Excel)
            </button>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Referencia</th>
                <th>Nombre de referencia</th>
                <th className="col-plu">Plu</th>
                <th>Precio</th>
                <th>Talla</th>
                <th>Imagen</th>
                <th className="col-copy">Copiar</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={`${row.referencia}-${row.plu}-${row.talla}`}>
                  <td>{row.referencia}</td>
                  <td>{row.nombreReferencia}</td>
                  <td className="col-plu mono">{row.plu}</td>
                  <td>{row.precio}</td>
                  <td>{row.talla}</td>
                  <td className="cell-img">
                    {row.imagen ? (
                      <a href={row.imagen} target="_blank" rel="noreferrer">
                        {/* URLs dinámicas del API: <img> nativo para miniaturas */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={row.imagen} alt="" width={48} height={48} />
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="col-copy">
                    <button
                      type="button"
                      className="btn tiny"
                      onClick={() => void onCopyRow(row)}
                    >
                      Fila
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
}
