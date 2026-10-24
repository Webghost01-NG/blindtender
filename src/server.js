import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { TenderService } from "./lib/tender-service.js";
import { verifyAuditPackage } from "./lib/verify.js";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const publicRoot = join(projectRoot, "public");
let service = new TenderService();

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

const securityHeaders = {
  "Content-Security-Policy": "default-src 'self'; connect-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

function writeHeaders(response, status, headers = {}) {
  response.writeHead(status, { ...securityHeaders, ...headers });
}

function sendJson(response, status, value) {
  writeHeaders(response, status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(value));
}

async function readJson(request) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > 128_000) throw new Error("Request body is too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function api(request, response, url) {
  if (request.method === "GET" && url.pathname === "/api/state") {
    sendJson(response, 200, service.publicState());
    return true;
  }
  if (request.method === "GET" && url.pathname === "/api/event-keys") {
    sendJson(response, 200, {
      encryptionPublicKey: service.keys.encryptionPublicKey,
      operatorSigningKey: service.keys.signingPublicKey,
      rulesHash: service.rulesHash,
    });
    return true;
  }
  if (request.method === "GET" && url.pathname === "/api/public-evidence") {
    sendJson(response, 200, service.publicEvidence());
    return true;
  }
  if (request.method === "POST" && url.pathname === "/api/reset") {
    service = new TenderService();
    sendJson(response, 200, service.publicState());
    return true;
  }
  if (request.method === "POST" && url.pathname === "/api/bids") {
    sendJson(response, 201, service.submit(await readJson(request)));
    return true;
  }
  if (request.method === "POST" && url.pathname === "/api/close") {
    sendJson(response, 200, service.close(await readJson(request)));
    return true;
  }
  const evidenceMatch = url.pathname.match(/^\/api\/evidence\/([a-z0-9-]+)$/);
  if (request.method === "GET" && evidenceMatch) {
    sendJson(response, 200, service.supplierEvidence(evidenceMatch[1]));
    return true;
  }
  const challengeMatch = url.pathname.match(/^\/api\/challenges\/omission\/([a-z0-9-]+)$/);
  if (request.method === "GET" && challengeMatch) {
    sendJson(response, 200, service.omissionChallenge(challengeMatch[1]));
    return true;
  }
  if (request.method === "GET" && url.pathname === "/api/audit-package") {
    sendJson(response, 200, service.auditPackage());
    return true;
  }
  if (request.method === "POST" && url.pathname === "/api/verify-audit-package") {
    sendJson(response, 200, verifyAuditPackage(await readJson(request)));
    return true;
  }
  if (request.method === "POST" && url.pathname === "/api/challenges/tamper") {
    sendJson(response, 200, service.verifyOpening(await readJson(request)));
    return true;
  }
  if (request.method === "POST" && url.pathname === "/api/settlement") {
    sendJson(response, 201, service.recordSettlement(await readJson(request)));
    return true;
  }
  return false;
}

async function staticFile(response, pathname) {
  const relative = pathname === "/" ? "index.html" : normalize(pathname).replace(/^[/\\]+/, "");
  const target = resolve(publicRoot, relative);
  if (!target.startsWith(`${publicRoot}/`) && target !== publicRoot) return false;
  try {
    const body = await readFile(target);
    writeHeaders(response, 200, { "Content-Type": contentTypes[extname(target)] ?? "application/octet-stream" });
    response.end(body);
    return true;
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "EISDIR") return false;
    throw error;
  }
}

export function createBlindTenderServer() {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://127.0.0.1");
      if (url.pathname.startsWith("/api/")) {
        if (!(await api(request, response, url))) sendJson(response, 404, { error: "API route not found" });
        return;
      }
      if (!(await staticFile(response, url.pathname))) sendJson(response, 404, { error: "Not found" });
    } catch (error) {
      sendJson(response, error instanceof SyntaxError || error instanceof TypeError ? 400 : 409, { error: error.message });
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 4173);
  createBlindTenderServer().listen(port, "127.0.0.1", () => {
    console.log(`BlindTender listening at http://127.0.0.1:${port}`);
  });
}
