import { assertExactKeys, assertInteger, assertString, stableJson } from "./encoding.js";

const idPattern = /^[a-z0-9][a-z0-9-]{2,63}$/;
const hex64Pattern = /^[a-f0-9]{64}$/;

export const BID_FIELDS = ["amountMinor", "bidId", "currency", "deliveryDays", "eventId", "schemaVersion", "supplierAlias"];

export function canonicalBid(input) {
  assertExactKeys(input, BID_FIELDS, "bid");
  if (input.schemaVersion !== "blindtender.bid.v1") throw new TypeError("Unsupported bid schemaVersion");
  assertString(input.eventId, "eventId", idPattern);
  assertString(input.bidId, "bidId", idPattern);
  assertString(input.supplierAlias, "supplierAlias", /^[A-Z][A-Za-z0-9 ]{1,31}$/);
  if (input.currency !== "USD") throw new TypeError("currency must be USD");
  assertInteger(input.amountMinor, "amountMinor", 1, 1_000_000_000_00);
  assertInteger(input.deliveryDays, "deliveryDays", 1, 365);
  return stableJson(input);
}

export function validateCommitment(value) {
  assertString(value, "commitment", hex64Pattern, 64);
  return value;
}

export function validateSalt(value) {
  assertString(value, "salt", hex64Pattern, 64);
  return value;
}

export function canonicalReceipt(input) {
  const fields = ["bidId", "commitment", "eventId", "receivedAt", "sequence", "signingKeyId"];
  assertExactKeys(input, fields, "receipt payload");
  assertString(input.eventId, "eventId", idPattern);
  assertString(input.bidId, "bidId", idPattern);
  validateCommitment(input.commitment);
  assertString(input.receivedAt, "receivedAt", /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/, 24);
  assertInteger(input.sequence, "sequence", 1);
  assertString(input.signingKeyId, "signingKeyId", idPattern);
  return stableJson(input);
}

export function canonicalEventConfig(input) {
  const fields = ["awardRule", "canonicalizationVersion", "currency", "deadline", "eligibilityPolicy", "encryptionPublicKey", "eventId", "operatorSigningKey", "tieBreakRule"];
  assertExactKeys(input, fields, "event config");
  assertString(input.eventId, "eventId", idPattern);
  if (input.awardRule !== "lowest-valid-price") throw new TypeError("Unsupported award rule");
  if (input.tieBreakRule !== "earliest-acknowledged-receipt") throw new TypeError("Unsupported tie-break rule");
  if (input.currency !== "USD") throw new TypeError("Unsupported currency");
  if (input.canonicalizationVersion !== "blindtender.c14n.v1") throw new TypeError("Unsupported canonicalization version");
  assertString(input.deadline, "deadline", undefined, 64);
  assertString(input.eligibilityPolicy, "eligibilityPolicy", undefined, 256);
  assertString(input.encryptionPublicKey, "encryptionPublicKey", undefined, 4096);
  assertString(input.operatorSigningKey, "operatorSigningKey", undefined, 2048);
  return stableJson(input);
}
