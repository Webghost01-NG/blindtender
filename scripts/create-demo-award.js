import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { bidCommitment, encryptBidForOperator } from "../src/lib/crypto.js";
import { TenderService } from "../src/lib/tender-service.js";

const service = new TenderService();
const bids = [
  { amountMinor: 4_820_000, bidId: "atlas-001", currency: "USD", deliveryDays: 14, eventId: "medical-supplies-2026", schemaVersion: "blindtender.bid.v1", supplierAlias: "Atlas Medical" },
  { amountMinor: 4_930_000, bidId: "cedar-001", currency: "USD", deliveryDays: 18, eventId: "medical-supplies-2026", schemaVersion: "blindtender.bid.v1", supplierAlias: "Cedar Supply" },
  { amountMinor: 5_050_000, bidId: "northstar-001", currency: "USD", deliveryDays: 12, eventId: "medical-supplies-2026", schemaVersion: "blindtender.bid.v1", supplierAlias: "Northstar Labs" },
];

for (const bid of bids) {
  const salt = randomBytes(32).toString("hex");
  const commitment = bidCommitment(bid, salt);
  service.submit({
    bidId: bid.bidId,
    commitment,
    envelope: encryptBidForOperator(bid, salt, service.keys.encryptionPublicKey),
  });
}

service.close();
const evidenceDirectory = resolve(".evidence");
mkdirSync(evidenceDirectory, { recursive: true });
writeFileSync(resolve(evidenceDirectory, "demo-award.json"), `${JSON.stringify(service.auditPackage(), null, 2)}\n`, { mode: 0o600 });
console.log(service.award.awardDecisionHash);
