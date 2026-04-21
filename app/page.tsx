"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { InventoryRow } from "@/lib/inventoryTypes";

const GLOD_MSG = "Contactar con Glod para Revisar el Problema";

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function Home() {
  const [items, setItems] = useState<InventoryRow[]>([]);
  const [lastOkAt, setLastOkAt] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const [serverHint, setServerHint] = useState<string | null>(null);

  /** Carga desde Vercel Blob vía GET /api/inventario (sin refresh). */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBootLoading(true);
      setApiError(null);
      try {
        const res = await fetch("/api/inventario", { cache: "no-store" });
        let data: {
          items?: InventoryRow[];
          savedAt?: string | null;
          error?: string;
          message?: string;
        };
        try {
          data = (await res.json()) as {
            items?: InventoryRow[];
            savedAt?: string | null;
            error?: string;
            message?: string;
          };
        } catch {
          if (!cancelled) {
            setApiError("Respuesta inválida (no JSON).");
          }
          return;
        }
        if (cancelled) return;
        if (!res.ok) {
          setApiError(data.error || `Error HTTP ${res.status}`);
          return;
        }
        if (data.items && Array.isArray(data.items) && data.items.length > 0) {
          setItems(data.items);
          setLastOkAt(data.savedAt ?? null);
        }
        if (data.message) {
          setServerHint(data.message);
        }
      } catch (e) {
        if (!cancelled) {
          const detail = e instanceof Error ? e.message : String(e);
          setApiError(`Fallo al cargar datos: ${detail}`);
        }
      } finally {
        if (!cancelled) setBootLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    setServerHint(null);
    setCopyHint(null);
    try {
      const res = await fetch("/api/inventario?refresh=1", { cache: "no-store" });
      let data: {
        items?: InventoryRow[];
        savedAt?: string | null;
        error?: string;
        warning?: string;
        hint?: string;
      };
      try {
        data = (await res.json()) as {
          items?: InventoryRow[];
          savedAt?: string | null;
          error?: string;
          warning?: string;
          hint?: string;
        };
      } catch {
        setApiError("Respuesta inválida (no JSON).");
        return;
      }
      if (!res.ok) {
        setApiError(
          data.error ||
            `Error HTTP ${res.status}. Compruebe variables de entorno en Vercel.`
        );
        return;
      }
      if (!data.items || !Array.isArray(data.items)) {
        setApiError("Respuesta inválida del servidor");
        return;
      }
      setItems(data.items);
      setLastOkAt(data.savedAt ?? null);
      if (data.warning) {
        setServerHint(`Aviso: ${data.warning}`);
      } else if (data.hint) {
        setServerHint(data.hint);
      }
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      setApiError(
        `Fallo al llamar a /api/inventario: ${detail}. Revise la pestaña Red (F12).`
      );
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
          Los datos completos se guardan en <strong>Vercel Blob</strong> (servidor). Esta
          página solo mantiene una copia en memoria para buscar y copiar. Pulse{" "}
          <strong>Actualizar información</strong> para volver a descargar desde el API y
          actualizar el almacenamiento.
        </p>
      </header>

      {apiError ? (
        <div className="alert" role="alert">
          <strong>{GLOD_MSG}</strong>
          <p className="alert-detail">{apiError}</p>
        </div>
      ) : null}

      {serverHint && !apiError ? (
        <p className="muted small" style={{ marginBottom: "0.75rem" }}>
          {serverHint}
        </p>
      ) : null}

      <section className="toolbar">
        <button
          type="button"
          className="btn primary"
          onClick={() => void refresh()}
          disabled={loading || bootLoading}
        >
          {loading || bootLoading ? "Cargando…" : "Actualizar información"}
        </button>
        {lastOkAt ? (
          <span className="muted small">
            Última actualización guardada en servidor:{" "}
            {new Date(lastOkAt).toLocaleString("es-EC")}
          </span>
        ) : (
          <span className="muted small">Sin datos en servidor aún.</span>
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
            ? `${items.length} registros en memoria (según última carga).`
            : "Sin registros: pulse Actualizar información o espere la carga inicial."}
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
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
}
