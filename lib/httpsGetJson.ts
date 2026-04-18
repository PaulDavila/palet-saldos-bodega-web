import https from "node:https";

const REQUEST_MS = 90_000;

export async function httpsGetJson(
  urlString: string,
  headers: Record<string, string>,
  tls: { rejectUnauthorized: boolean }
): Promise<unknown> {
  const url = new URL(urlString);
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: url.hostname,
        port: url.port || 443,
        path: `${url.pathname}${url.search}`,
        method: "GET",
        headers,
        rejectUnauthorized: tls.rejectUnauthorized,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");
          const code = res.statusCode ?? 0;
          if (code < 200 || code >= 300) {
            reject(new Error(`HTTP ${code}: ${body.slice(0, 500)}`));
            return;
          }
          try {
            resolve(JSON.parse(body) as unknown);
          } catch {
            reject(new Error("La respuesta no es JSON válido"));
          }
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(REQUEST_MS, () => {
      req.destroy();
      reject(new Error("Tiempo de espera agotado al consultar el inventario"));
    });
    req.end();
  });
}
