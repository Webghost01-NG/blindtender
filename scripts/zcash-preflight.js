import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const image = "ghcr.io/webghost01-ng/nivyr-zcash-devtool@sha256:42d7cd27f6c133543f90bfa6558598c2bc4a0da42a3ff17f1ad1476f2246edb9";
const root = resolve(".runtime/testnet");
const evidenceDir = resolve(".evidence");
const command = process.argv[2] ?? "status";
const ansi = /\u001b\[[0-9;]*m/g;

mkdirSync(root, { recursive: true, mode: 0o700 });
mkdirSync(evidenceDir, { recursive: true });

function run(args, timeout = 300_000) {
  return execFileSync("docker", [
    "run", "--rm", "--platform", "linux/amd64",
    "--user", `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`,
    "--mount", `type=bind,source=${root},target=/wallets`,
    image,
    ...args,
  ], { encoding: "utf8", timeout }).replace(ansi, "").trim();
}

function wallet(name, args, timeout) {
  return run(["wallet", "-w", `/wallets/${name}`, ...args], timeout);
}

function walletExists(name) {
  return existsSync(resolve(root, name, "data.sqlite"));
}

function initWallet(name, displayName) {
  if (!walletExists(name)) {
    wallet(name, ["init", "--name", displayName, "--identity", `/wallets/${name}.age`, "--network", "test", "--server", "zecrocks"]);
  }
  const output = wallet(name, ["list-addresses"]);
  const address = output.match(/Default Address:\s*(utest1\S+)/)?.[1];
  if (!address) throw new Error(`Could not parse ${name} Unified Address`);
  return address;
}

function sync(name) {
  return wallet(name, ["sync", "--server", "zecrocks"], 600_000);
}

function balance(name) {
  try {
    return JSON.parse(wallet(name, ["balance", "--json"]));
  } catch (error) {
    return { unavailable: true, detail: error.message };
  }
}

function initialize() {
  const senderAddress = initWallet("sender", "BlindTenderSender");
  const recipientAddress = initWallet("recipient", "BlindTenderRecipient");
  sync("sender");
  const status = {
    checkedAt: new Date().toISOString(),
    network: "testnet",
    recipientAddress,
    senderAddress,
    senderBalance: balance("sender"),
    server: JSON.parse(wallet("sender", ["get-info", "--server", "zecrocks"])),
    state: "wallets-ready-needs-funding",
  };
  writeFileSync(resolve(evidenceDir, "zcash-preflight.json"), `${JSON.stringify(status, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify(status, null, 2));
}

function sendSettlement() {
  const awardDecisionHash = process.argv[3];
  if (!/^[a-f0-9]{64}$/.test(awardDecisionHash ?? "")) throw new Error("Usage: npm run zcash:preflight -- send <64-character-award-hash>");
  const senderAddress = initWallet("sender", "BlindTenderSender");
  const recipientAddress = initWallet("recipient", "BlindTenderRecipient");
  sync("sender");
  const memo = `BlindTender:v1:${awardDecisionHash}`;
  const output = wallet("sender", [
    "send", "--identity", "/wallets/sender.age", "--address", recipientAddress,
    "--value", "100000", "--memo", memo, "--server", "zecrocks",
  ], 600_000);
  const transactionId = output.match(/\b[a-f0-9]{64}\b/)?.[0];
  if (!transactionId) throw new Error(`Wallet returned no transaction ID: ${output}`);
  const evidence = {
    awardDecisionHash,
    createdAt: new Date().toISOString(),
    memo,
    network: "testnet",
    recipientAddress,
    senderAddress,
    state: "broadcast",
    transactionId,
  };
  writeFileSync(resolve(evidenceDir, "zcash-settlement.json"), `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify(evidence, null, 2));
}

function verifySettlement() {
  const evidencePath = resolve(evidenceDir, "zcash-settlement.json");
  if (!existsSync(evidencePath)) throw new Error("No broadcast evidence exists; run send first");
  const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
  sync("recipient");
  wallet("recipient", ["enhance", "--server", "zecrocks"], 600_000);
  const transactions = JSON.parse(wallet("recipient", ["list-tx", "--json"]));
  const transaction = transactions.find((entry) => entry.txid === evidence.transactionId);
  const details = wallet("recipient", ["list-tx", "--mode", "text"]);
  const memoMatched = details.includes(evidence.memo);
  const result = {
    ...evidence,
    checkedAt: new Date().toISOString(),
    memoMatched,
    minedHeight: transaction?.mined_height ?? null,
    recipientDetected: Boolean(transaction),
    state: transaction && memoMatched ? "detected-by-recipient" : transaction ? "mined" : "broadcast",
  };
  writeFileSync(evidencePath, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify(result, null, 2));
}

if (command === "init" || command === "status") initialize();
else if (command === "send") sendSettlement();
else if (command === "verify") verifySettlement();
else throw new Error("Commands: init, status, send <award-hash>, verify");
