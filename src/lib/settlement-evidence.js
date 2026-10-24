export function validateSettlementEvidence(evidence) {
  if (!evidence || typeof evidence !== "object") throw new TypeError("Settlement evidence must be an object");
  if (!/^[a-f0-9]{64}$/.test(evidence.awardDecisionHash ?? "")) throw new TypeError("Invalid awardDecisionHash");
  if (!/^[a-f0-9]{64}$/.test(evidence.transactionId ?? "")) throw new TypeError("Invalid transactionId");
  if (!['testnet', 'regtest'].includes(evidence.network)) throw new TypeError("Invalid settlement network");
  if (evidence.state === "detected-by-recipient") {
    if (evidence.memoMatched !== true) throw new TypeError("Recipient detection requires memoMatched");
    if (evidence.recipient?.detected !== true) throw new TypeError("Recipient detection evidence is missing");
    if (evidence.recipient.memo !== `BlindTender:v1:${evidence.awardDecisionHash}`) throw new TypeError("Recipient memo references a different award");
  }
  return evidence;
}
