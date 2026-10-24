import assert from "node:assert/strict";
import test from "node:test";
import { createBlindTenderServer } from "../src/server.js";

test("server exposes event rules and no-store API state", async (context) => {
  const server = createBlindTenderServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => server.close());
  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/state`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.match(response.headers.get("content-security-policy"), /default-src 'self'/);
  const state = await response.json();
  assert.equal(state.phase, "open");
  assert.equal(state.event.eventId, "medical-supplies-2026");
  assert.match(state.rulesHash, /^[a-f0-9]{64}$/);
});

test("server rejects unknown API routes", async (context) => {
  const server = createBlindTenderServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => server.close());
  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/nope`);
  assert.equal(response.status, 404);
});

test("server rejects malformed audit verification packages", async (context) => {
  const server = createBlindTenderServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => server.close());
  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/verify-audit-package`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /operatorSigningKey|Cannot read/);
});

test("server requires JSON content type for state-changing routes", async (context) => {
  const server = createBlindTenderServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => server.close());
  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/bids`, {
    method: "POST",
    body: "{}",
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, "Content-Type must be application/json");
});
