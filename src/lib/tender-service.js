import { randomUUID } from "node:crypto";
import { bidCommitment, createOperatorKeys, decryptBidEnvelope, signObject, verifyObject } from "./crypto.js";
import { sha256Hex } from "./encoding.js";
import { evaluateLowestPrice } from "./evaluate.js";
import { buildMerkleTree, verifyMerkleProof } from "./merkle.js";
import { canonicalBid, canonicalEventConfig, canonicalReceipt, validateCommitment } from "./schema.js";

const SIGNING_KEY_ID = "operator-key-2026";

export class TenderService {
  constructor({ clock = () => new Date(), keys = createOperatorKeys() } = {}) {
    this.clock = clock;
    this.keys = keys;
    this.submissions = [];
    this.phase = "open";
    this.closure = null;
    this.award = null;
    this.settlement = null;
    this.settlementHistory = [];
    this.eventConfig = {
      awardRule: "lowest-valid-price",
      canonicalizationVersion: "blindtender.c14n.v1",
      currency: "USD",
      deadline: "2026-10-27T18:00:00.000Z",
      eligibilityPolicy: "Synthetic suppliers with complete USD bids are eligible.",
      encryptionPublicKey: keys.encryptionPublicKey,
      eventId: "medical-supplies-2026",
      operatorSigningKey: keys.signingPublicKey,
      tieBreakRule: "earliest-acknowledged-receipt",
    };
    canonicalEventConfig(this.eventConfig);
    this.rulesHash = sha256Hex("blindtender:event-rules:v1", this.eventConfig);
  }

  publicState() {
    return {
      award: this.award,
      closure: this.closure ? { manifest: this.closure.manifest, signature: this.closure.signature } : null,
      event: { ...this.eventConfig, encryptionPublicKey: undefined, operatorSigningKey: undefined },
      operatorSigningKey: this.keys.signingPublicKey,
      phase: this.phase,
      receiptCount: this.submissions.length,
      rulesHash: this.rulesHash,
      settlement: this.settlement,
      settlementHistory: this.settlementHistory,
    };
  }

  submit({ bidId, commitment, envelope }) {
    if (this.phase !== "open") throw new Error("Tender is closed");
    validateCommitment(commitment);
    if (this.submissions.some((entry) => entry.bidId === bidId)) throw new Error("Duplicate bidId");
    if (this.submissions.some((entry) => entry.commitment === commitment)) throw new Error("Duplicate commitment");
    const payload = {
      bidId,
      commitment,
      eventId: this.eventConfig.eventId,
      receivedAt: this.clock().toISOString(),
      sequence: this.submissions.length + 1,
      signingKeyId: SIGNING_KEY_ID,
    };
    canonicalReceipt(payload);
    const receipt = {
      payload,
      signature: signObject("blindtender:receipt:v1", payload, this.keys.signingPrivateKey),
    };
    this.submissions.push({ bidId, commitment, envelope, receipt });
    return receipt;
  }

  verifyReceipt(receipt) {
    canonicalReceipt(receipt.payload);
    return verifyObject("blindtender:receipt:v1", receipt.payload, receipt.signature, this.keys.signingPublicKey);
  }

  close({ omitBidId = null } = {}) {
    if (this.phase !== "open") throw new Error("Tender is already closed");
    const opened = this.submissions.map((submission) => {
      const decrypted = decryptBidEnvelope(submission.envelope, this.keys.encryptionPrivateKey);
      const canonical = canonicalBid(decrypted.bid);
      if (decrypted.bid.bidId !== submission.bidId) throw new Error(`Bid ID mismatch for ${submission.bidId}`);
      if (decrypted.bid.eventId !== this.eventConfig.eventId) throw new Error(`Event mismatch for ${submission.bidId}`);
      const actual = bidCommitment(JSON.parse(canonical), decrypted.salt);
      if (actual !== submission.commitment) throw new Error(`Commitment mismatch for ${submission.bidId}`);
      return { ...submission, bid: decrypted.bid, salt: decrypted.salt };
    });
    const declared = opened.filter((entry) => entry.bidId !== omitBidId);
    if (declared.length === 0) throw new Error("Cannot close with an empty accepted set");
    const tree = buildMerkleTree(declared.map((entry) => entry.commitment));
    const manifest = {
      acceptedBidCount: declared.length,
      acceptedBidMerkleRoot: tree.root,
      closedAt: this.clock().toISOString(),
      deadline: this.eventConfig.deadline,
      eventConfigHash: this.rulesHash,
      eventId: this.eventConfig.eventId,
      operatorSigningKeyId: SIGNING_KEY_ID,
      rulesHash: this.rulesHash,
    };
    const manifestSignature = signObject("blindtender:closure-manifest:v1", manifest, this.keys.signingPrivateKey);
    const proofs = Object.fromEntries([...tree.proofs.entries()]);
    const evaluation = evaluateLowestPrice(declared);
    const closureManifestHash = sha256Hex("blindtender:closure-manifest:v1", { manifest, signature: manifestSignature });
    const awardDecision = {
      closureManifestHash,
      eligibleBidCommitments: evaluation.rankedCommitments,
      eventId: this.eventConfig.eventId,
      evaluation: { rule: evaluation.rule, tieBreak: evaluation.tieBreak },
      issuedAt: this.clock().toISOString(),
      rulesHash: this.rulesHash,
      winnerCommitment: evaluation.winnerCommitment,
      winningAmountMinor: evaluation.winningAmountMinor,
    };
    const awardSignature = signObject("blindtender:award-decision:v1", awardDecision, this.keys.signingPrivateKey);
    const awardDecisionHash = sha256Hex("blindtender:award-decision:v1", { payload: awardDecision, signature: awardSignature });
    this.phase = "awarded";
    this.closure = { manifest, signature: manifestSignature, proofs };
    this.award = { payload: awardDecision, signature: awardSignature, awardDecisionHash };
    this.opened = opened;
    return { award: this.award, closure: this.closure };
  }

  supplierEvidence(bidId) {
    const submission = this.submissions.find((entry) => entry.bidId === bidId);
    if (!submission) throw new Error("Unknown bid");
    const proof = this.closure?.proofs[submission.commitment] ?? null;
    return {
      commitment: submission.commitment,
      included: Boolean(proof),
      inclusionProof: proof,
      manifest: this.closure?.manifest ?? null,
      manifestSignature: this.closure?.signature ?? null,
      receipt: submission.receipt,
      receiptValid: this.verifyReceipt(submission.receipt),
      proofValid: proof ? verifyMerkleProof(submission.commitment, proof, this.closure.manifest.acceptedBidMerkleRoot) : false,
    };
  }

  omissionChallenge(bidId) {
    if (!this.closure) throw new Error("Tender must be closed before challenging inclusion");
    const evidence = this.supplierEvidence(bidId);
    return {
      bidId,
      conclusion: evidence.receiptValid && !evidence.included ? "acknowledged-but-not-included" : "no-omission-detected",
      eventId: this.eventConfig.eventId,
      included: evidence.included,
      manifestRoot: evidence.manifest.acceptedBidMerkleRoot,
      proofValid: evidence.proofValid,
      receipt: evidence.receipt,
      receiptValid: evidence.receiptValid,
      warning: "This report demonstrates an inconsistency; it does not automatically enforce inclusion.",
    };
  }

  auditPackage() {
    if (!this.award || !this.closure) throw new Error("Tender must be awarded before an audit package can be produced");
    return {
      award: this.award,
      closure: {
        manifest: this.closure.manifest,
        signature: this.closure.signature,
      },
      disclosedEligibleBids: this.opened
        .filter((entry) => this.award.payload.eligibleBidCommitments.includes(entry.commitment))
        .map((entry) => ({
          bid: entry.bid,
          commitment: entry.commitment,
          inclusionProof: this.closure.proofs[entry.commitment],
          receipt: entry.receipt,
          salt: entry.salt,
        })),
      generatedAt: this.clock().toISOString(),
      operatorSigningKey: this.keys.signingPublicKey,
      purpose: "authorized-award-recomputation",
      rules: this.eventConfig,
      settlement: this.settlement,
      warning: "Restricted package: disclosedEligibleBids contains confidential supplier terms.",
    };
  }

  recordSettlement(input) {
    if (!this.award) throw new Error("Award decision is required before settlement");
    const states = ["created", "broadcast", "mined", "confirmed", "detected-by-recipient"];
    if (!states.includes(input.state)) throw new TypeError("Invalid settlement state");
    if (!['testnet', 'regtest'].includes(input.network)) throw new TypeError("Settlement network must be testnet or regtest");
    if (!/^[a-f0-9]{64}$/.test(input.transactionId ?? "")) throw new TypeError("Invalid settlement transaction ID");
    if (input.state === "detected-by-recipient" && input.memoMatched !== true) throw new Error("Recipient detection requires a matching private memo");
    const previousState = this.settlement?.payload.state ?? null;
    const expectedState = states[previousState === null ? 0 : states.indexOf(previousState) + 1];
    if (input.state !== expectedState) {
      throw new Error(`Settlement transition must be ${previousState ?? "not-started"} → ${expectedState ?? "complete"}`);
    }
    if (input.awardDecisionHash !== this.award.awardDecisionHash) throw new Error("Settlement references a different award");
    const payload = {
      awardDecisionHash: input.awardDecisionHash,
      evidenceId: input.evidenceId ?? randomUUID(),
      memoMatched: input.memoMatched === true,
      network: input.network,
      recordedAt: this.clock().toISOString(),
      state: input.state,
      transactionId: input.transactionId,
    };
    this.settlement = {
      payload,
      signature: signObject("blindtender:settlement-record:v1", payload, this.keys.signingPrivateKey),
    };
    this.settlementHistory.push(this.settlement);
    return this.settlement;
  }
}
