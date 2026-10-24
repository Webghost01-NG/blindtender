import { bidCommitment, verifyObject } from "./crypto.js";
import { sha256Hex } from "./encoding.js";
import { evaluateLowestPrice } from "./evaluate.js";
import { verifyMerkleProof } from "./merkle.js";

export function verifyAuditPackage(audit) {
  const signingKey = audit.operatorSigningKey;
  const checks = {
    awardDecisionHash: sha256Hex("blindtender:award-decision:v1", {
      payload: audit.award.payload,
      signature: audit.award.signature,
    }) === audit.award.awardDecisionHash,
    awardSignature: verifyObject("blindtender:award-decision:v1", audit.award.payload, audit.award.signature, signingKey),
    closureSignature: verifyObject("blindtender:closure-manifest:v1", audit.closure.manifest, audit.closure.signature, signingKey),
    commitments: true,
    inclusionProofs: true,
    receipts: true,
    reproducibleAward: false,
    rulesHash: sha256Hex("blindtender:event-rules:v1", audit.rules) === audit.award.payload.rulesHash,
  };

  const opened = audit.disclosedEligibleBids.map((entry) => {
    checks.commitments &&= bidCommitment(entry.bid, entry.salt) === entry.commitment;
    checks.inclusionProofs &&= verifyMerkleProof(entry.commitment, entry.inclusionProof, audit.closure.manifest.acceptedBidMerkleRoot);
    checks.receipts &&= verifyObject("blindtender:receipt:v1", entry.receipt.payload, entry.receipt.signature, signingKey);
    return { bid: entry.bid, commitment: entry.commitment, receipt: entry.receipt.payload };
  });

  const result = evaluateLowestPrice(opened);
  checks.reproducibleAward = result.winnerCommitment === audit.award.payload.winnerCommitment
    && result.winningAmountMinor === audit.award.payload.winningAmountMinor
    && JSON.stringify(result.rankedCommitments) === JSON.stringify(audit.award.payload.eligibleBidCommitments);

  return {
    checks,
    valid: Object.values(checks).every(Boolean),
  };
}
