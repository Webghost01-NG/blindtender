import assert from "node:assert/strict";
import test from "node:test";
import { validateSettlementEvidence } from "../src/lib/settlement-evidence.js";

const hash = "a".repeat(64);
const txid = "b".repeat(64);

test("recipient evidence binds memo to the exact award", () => {
  const evidence = {
    awardDecisionHash: hash,
    memoMatched: true,
    network: "regtest",
    recipient: { detected: true, memo: `BlindTender:v1:${hash}` },
    state: "detected-by-recipient",
    transactionId: txid,
  };
  assert.equal(validateSettlementEvidence(evidence), evidence);
  assert.throws(() => validateSettlementEvidence({ ...evidence, recipient: { ...evidence.recipient, memo: `BlindTender:v1:${"c".repeat(64)}` } }), /different award/);
});

test("public identifiers cannot impersonate recipient detection", () => {
  assert.throws(() => validateSettlementEvidence({
    awardDecisionHash: hash,
    memoMatched: false,
    network: "testnet",
    recipient: { detected: false, memo: null },
    state: "detected-by-recipient",
    transactionId: txid,
  }), /memoMatched/);
});
