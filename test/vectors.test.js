import assert from "node:assert/strict";
import test from "node:test";
import { bidCommitment } from "../src/lib/crypto.js";
import { canonicalBid } from "../src/lib/schema.js";

const bid = {
  amountMinor: 4_820_000,
  bidId: "atlas-001",
  currency: "USD",
  deliveryDays: 14,
  eventId: "medical-supplies-2026",
  schemaVersion: "blindtender.bid.v1",
  supplierAlias: "Atlas Medical",
};

test("canonical bid vector remains stable across implementations", () => {
  assert.equal(canonicalBid(bid), "{\"amountMinor\":4820000,\"bidId\":\"atlas-001\",\"currency\":\"USD\",\"deliveryDays\":14,\"eventId\":\"medical-supplies-2026\",\"schemaVersion\":\"blindtender.bid.v1\",\"supplierAlias\":\"Atlas Medical\"}");
});

test("bid commitment vector remains stable across implementations", () => {
  assert.equal(
    bidCommitment(bid, "00".repeat(32)),
    "b3e9c6703982a9ced3eda945bb4856fcbf68ce61e6d1ea14318173f1316ba984",
  );
});
