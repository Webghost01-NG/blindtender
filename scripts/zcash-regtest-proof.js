import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createNivyr } from "/home/web-ghost/nivyr/dist/packages/test/src/index.js";

const awardDecisionHash = process.argv[2];
if (!/^[a-f0-9]{64}$/.test(awardDecisionHash ?? "")) {
  throw new Error("Usage: node scripts/zcash-regtest-proof.js <64-character-award-hash>");
}

const runtimeRoot = resolve(".nivyr");
const recipientDirectory = resolve(runtimeRoot, "wallets", "blindtender-recipient");
const recipientIdentity = resolve(runtimeRoot, "wallets", "blindtender-recipient.age");
const evidenceDirectory = resolve(".evidence");
mkdirSync(evidenceDirectory, { recursive: true });

const nivyr = createNivyr({ timeoutMs: 60_000 });
const sender = await nivyr.managedSender();
const recipient = existsSync(resolve(recipientDirectory, "data.sqlite"))
  ? await nivyr.openWallet("BlindTenderRecipient", recipientDirectory, recipientIdentity)
  : await nivyr.wallet({ name: "blindtender-recipient", directory: recipientDirectory, identityFile: recipientIdentity });

const memo = `BlindTender:v1:${awardDecisionHash}`;
const transactionId = await nivyr.pay({
  amount: "0.01000000",
  from: sender,
  memo,
  minConfirmations: 1,
  to: recipient,
});
const broadcast = await nivyr.transaction(transactionId);
await nivyr.mine(2);
const mined = await nivyr.waitForTransaction(transactionId, (transaction) => transaction.mined && transaction.confirmations >= 1);
await nivyr.waitForIndexer(mined.height);
await nivyr.sync(recipient);
await nivyr.enhance(recipient);
const received = await nivyr.observeWallet(recipient, transactionId);

if (!received.detected || !received.payment) throw new Error("Recipient did not detect the shielded payment");
if (received.payment.memo !== memo) throw new Error("Recipient memo did not match the award reference");
if (received.payment.amountZatoshi !== 1_000_000n) throw new Error("Recipient amount did not match 0.01 ZEC");

const evidence = {
  awardDecisionHash,
  broadcast,
  createdAt: new Date().toISOString(),
  memoMatched: true,
  network: "regtest",
  recipient: {
    amountZatoshi: received.payment.amountZatoshi.toString(),
    detected: received.detected,
    memo: received.payment.memo,
    minedHeight: received.minedHeight,
    pool: received.payment.pool,
    scanHeight: received.scanHeight,
  },
  state: "detected-by-recipient",
  transaction: mined,
  transactionId,
  warning: "Local regtest evidence; this is not public-testnet settlement.",
};

writeFileSync(resolve(evidenceDirectory, "zcash-regtest-settlement.json"), `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify(evidence, null, 2));
