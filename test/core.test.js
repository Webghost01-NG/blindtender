import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";
import { bidCommitment, createOperatorKeys, encryptBidForOperator, signObject, verifyObject } from "../src/lib/crypto.js";
import { buildMerkleTree, verifyMerkleProof } from "../src/lib/merkle.js";
import { canonicalBid } from "../src/lib/schema.js";
import { TenderService } from "../src/lib/tender-service.js";
import { verifyAuditPackage } from "../src/lib/verify.js";

function bid(bidId, amountMinor, supplierAlias = "Atlas Medical") {
  return { amountMinor, bidId, currency: "USD", deliveryDays: 14, eventId: "medical-supplies-2026", schemaVersion: "blindtender.bid.v1", supplierAlias };
}

function submit(service, value) {
  const salt = randomBytes(32).toString("hex");
  const commitment = bidCommitment(value, salt);
  return { commitment, receipt: service.submit({ bidId: value.bidId, commitment, envelope: encryptBidForOperator(value, salt, service.keys.encryptionPublicKey) }) };
}

test("canonicalization is stable and rejects floating point and unknown fields", () => {
  const value = bid("atlas-001", 4_820_000);
  assert.equal(canonicalBid(value), canonicalBid({ ...value }));
  assert.throws(() => canonicalBid({ ...value, amountMinor: 48.2 }), /Invalid amountMinor|safe integers/);
  assert.throws(() => canonicalBid({ ...value, note: "surprise" }), /fields must be exactly/);
});

test("receipt signatures bind every acknowledged field", () => {
  const keys = createOperatorKeys();
  const payload = { bidId: "atlas-001", commitment: "a".repeat(64), eventId: "medical-supplies-2026", receivedAt: "2026-10-24T10:00:00.000Z", sequence: 1, signingKeyId: "operator-key-2026" };
  const signature = signObject("blindtender:receipt:v1", payload, keys.signingPrivateKey);
  assert.equal(verifyObject("blindtender:receipt:v1", payload, signature, keys.signingPublicKey), true);
  for (const [field, replacement] of [["bidId", "atlas-002"], ["commitment", "b".repeat(64)], ["eventId", "another-event"], ["receivedAt", "2026-10-24T10:00:01.000Z"], ["sequence", 2], ["signingKeyId", "operator-key-2027"]]) {
    assert.equal(verifyObject("blindtender:receipt:v1", { ...payload, [field]: replacement }, signature, keys.signingPublicKey), false, field);
  }
});

test("Merkle proofs survive sorting and fail after modification", () => {
  const commitments = ["c".repeat(64), "a".repeat(64), "b".repeat(64)];
  const tree = buildMerkleTree(commitments);
  assert.deepEqual(tree.sortedCommitments, [...commitments].sort());
  for (const commitment of commitments) assert.equal(verifyMerkleProof(commitment, tree.proofs.get(commitment), tree.root), true);
  assert.equal(verifyMerkleProof("d".repeat(64), tree.proofs.get(commitments[0]), tree.root), false);
  assert.notEqual(buildMerkleTree(commitments.slice(0, 2)).root, tree.root);
});

test("award is deterministic and earliest receipt breaks exact tie", () => {
  let tick = 0;
  const service = new TenderService({ clock: () => new Date(1_760_000_000_000 + tick++ * 1000) });
  const atlas = submit(service, bid("atlas-001", 4_820_000, "Atlas Medical"));
  submit(service, bid("cedar-001", 4_820_000, "Cedar Supply"));
  submit(service, bid("north-001", 5_050_000, "Northstar Labs"));
  const result = service.close();
  assert.equal(result.award.payload.winnerCommitment, atlas.commitment);
  assert.equal(result.award.payload.winningAmountMinor, 4_820_000);
});

test("tampered encrypted bid is rejected at opening", () => {
  const service = new TenderService();
  const value = bid("atlas-001", 4_820_000);
  const salt = randomBytes(32).toString("hex");
  const envelope = encryptBidForOperator({ ...value, amountMinor: 4_810_000 }, salt, service.keys.encryptionPublicKey);
  service.submit({ bidId: value.bidId, commitment: bidCommitment(value, salt), envelope });
  assert.throws(() => service.close(), /Commitment mismatch/);
});

test("omitted acknowledged bid has a valid receipt but no inclusion proof", () => {
  const service = new TenderService();
  const omitted = submit(service, bid("atlas-001", 4_820_000));
  submit(service, bid("cedar-001", 4_930_000, "Cedar Supply"));
  service.close({ omitBidId: "atlas-001" });
  const evidence = service.supplierEvidence("atlas-001");
  assert.equal(evidence.receipt.signature, omitted.receipt.signature);
  assert.equal(evidence.receiptValid, true);
  assert.equal(evidence.included, false);
  assert.equal(evidence.proofValid, false);
  const challenge = service.omissionChallenge("atlas-001");
  assert.equal(challenge.conclusion, "acknowledged-but-not-included");
  assert.match(challenge.warning, /does not automatically enforce inclusion/);
});

test("settlement must reference the exact immutable award hash", () => {
  const service = new TenderService();
  submit(service, bid("atlas-001", 4_820_000));
  const { award } = service.close();
  assert.throws(() => service.recordSettlement({ awardDecisionHash: "0".repeat(64), memoMatched: false, network: "testnet", state: "created", transactionId: "1".repeat(64) }), /different award/);
  for (const state of ["created", "broadcast", "mined", "confirmed"]) {
    service.recordSettlement({ awardDecisionHash: award.awardDecisionHash, memoMatched: false, network: "testnet", state, transactionId: "1".repeat(64) });
  }
  const record = service.recordSettlement({ awardDecisionHash: award.awardDecisionHash, memoMatched: true, network: "testnet", state: "detected-by-recipient", transactionId: "1".repeat(64) });
  assert.equal(record.payload.awardDecisionHash, award.awardDecisionHash);
  assert.equal(service.settlementHistory.length, 5);
});

test("settlement lifecycle refuses skipped or regressed states", () => {
  const service = new TenderService();
  submit(service, bid("atlas-001", 4_820_000));
  const { award } = service.close();
  const input = { awardDecisionHash: award.awardDecisionHash, memoMatched: false, network: "regtest", transactionId: "1".repeat(64) };
  assert.throws(() => service.recordSettlement({ ...input, state: "broadcast" }), /not-started → created/);
  service.recordSettlement({ ...input, state: "created" });
  assert.throws(() => service.recordSettlement({ ...input, state: "created" }), /created → broadcast/);
});

test("restricted audit package contains sufficient inputs to recompute the award", () => {
  const service = new TenderService();
  submit(service, bid("atlas-001", 4_820_000));
  submit(service, bid("cedar-001", 4_930_000, "Cedar Supply"));
  service.close();
  const audit = service.auditPackage();
  assert.equal(audit.purpose, "authorized-award-recomputation");
  assert.equal(audit.disclosedEligibleBids.length, 2);
  assert.match(audit.warning, /confidential/);
  assert.equal(audit.award.payload.winningAmountMinor, 4_820_000);
  assert.deepEqual(verifyAuditPackage(audit), {
    checks: {
      awardDecisionHash: true,
      awardSignature: true,
      closureSignature: true,
      commitments: true,
      inclusionProofs: true,
      receipts: true,
      reproducibleAward: true,
      rulesHash: true,
    },
    valid: true,
  });
});

test("audit verification identifies a modified losing bid", () => {
  const service = new TenderService();
  submit(service, bid("atlas-001", 4_820_000));
  submit(service, bid("cedar-001", 4_930_000, "Cedar Supply"));
  service.close();
  const audit = service.auditPackage();
  audit.disclosedEligibleBids[1].bid.amountMinor = 4_700_000;
  const verification = verifyAuditPackage(audit);
  assert.equal(verification.valid, false);
  assert.equal(verification.checks.commitments, false);
  assert.equal(verification.checks.reproducibleAward, false);
});
