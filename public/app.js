import { commitBid, sealBidForOperator } from "/crypto.js";
import { createPrivateReceiptBundle, downloadPrivateReceipt } from "/receipt.js";

const stages = ["rules", "submissions", "closure", "award", "settlement"];
const stageLabels = { rules: "Published rules", submissions: "Sealed bids", closure: "Frozen bid set", award: "Award decision", settlement: "Shielded settlement" };
const roleLabels = { supplier: "Supplier", buyer: "Buyer", auditor: "Auditor" };
const sampleBids = [
  { amountMinor: 4_820_000, bidId: "atlas-001", deliveryDays: 14, supplierAlias: "Atlas Medical" },
  { amountMinor: 4_930_000, bidId: "cedar-001", deliveryDays: 18, supplierAlias: "Cedar Supply" },
  { amountMinor: 5_050_000, bidId: "north-001", deliveryDays: 21, supplierAlias: "Northstar Labs" },
];

const elements = {
  content: document.querySelector("#stage-content"),
  description: document.querySelector("#page-description"),
  eventTitle: document.querySelector("#event-title"),
  flash: document.querySelector("#flash-message"),
  heading: document.querySelector("#page-title"),
  progress: document.querySelector(".stage-progress"),
};

const runtime = {
  role: "buyer",
  stage: "submissions",
  state: null,
  keys: null,
  submissions: [],
  latestAward: null,
  latestClosure: null,
  animateStageChange: false,
  omittedBidId: null,
  supplierEvidence: null,
  auditResult: null,
  busy: false,
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  })[character]);
}

function formatMoney(amountMinor) {
  return new Intl.NumberFormat("en-US", { currency: "USD", maximumFractionDigits: 2, style: "currency" }).format(amountMinor / 100);
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(date) + " UTC";
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status})`);
  return body;
}

function announce(message, kind = "success") {
  elements.flash.textContent = message;
  elements.flash.dataset.kind = kind;
  elements.flash.hidden = false;
}

function clearAnnouncement() {
  elements.flash.hidden = true;
  elements.flash.textContent = "";
  delete elements.flash.dataset.kind;
}

function setBusy(button, busy, label = "Working…") {
  if (!button) return;
  if (busy) {
    button.dataset.originalLabel = button.textContent;
    button.textContent = label;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
  } else {
    button.textContent = button.dataset.originalLabel ?? button.textContent;
    delete button.dataset.originalLabel;
    button.disabled = false;
    button.removeAttribute("aria-busy");
  }
}

async function refreshState() {
  const [state, keys] = await Promise.all([api("/api/state"), api("/api/event-keys")]);
  runtime.state = state;
  runtime.keys = keys;
  const eventName = state.event.eventId === "medical-supplies-2026" ? "Medical supplies tender" : state.event.eventId;
  elements.eventTitle.textContent = eventName;
  if (state.phase === "awarded" && runtime.stage === "submissions") runtime.stage = "award";
  render();
}

function completionIndex() {
  if (runtime.latestAward || runtime.state?.phase === "awarded") return 3;
  if ((runtime.state?.receiptCount ?? 0) > 0) return 1;
  return 0;
}

function renderNavigation() {
  const currentIndex = stages.indexOf(runtime.stage);
  elements.progress.style.setProperty("--stage-progress", `${Math.max(0, currentIndex) * 25}%`);
  for (const button of document.querySelectorAll("[data-stage]")) {
    const index = stages.indexOf(button.dataset.stage);
    button.removeAttribute("aria-current");
    button.classList.toggle("is-complete", index < completionIndex());
    if (button.dataset.stage === runtime.stage) button.setAttribute("aria-current", "step");
  }
  for (const button of document.querySelectorAll("[data-role]")) {
    button.setAttribute("aria-pressed", String(button.dataset.role === runtime.role));
  }
}

function setHeading(title, description) {
  elements.heading.textContent = title;
  elements.description.textContent = description;
}

function button(label, action, { secondary = false, disabled = false, small = false } = {}) {
  const classes = ["button", secondary ? "button--secondary" : "", small ? "button--small" : ""].filter(Boolean).join(" ");
  return `<button type="button" class="${classes}" data-action="${escapeHtml(action)}"${disabled ? " disabled" : ""}>${escapeHtml(label)}</button>`;
}

function listRows() {
  if (!runtime.submissions.length) {
    const count = runtime.state?.receiptCount ?? 0;
    if (count) return `<li class="empty-state"><strong>${count} signed ${count === 1 ? "receipt" : "receipts"} recorded.</strong>The supplier list is private to the session that submitted each bid.</li>`;
    return `<li class="empty-state"><strong>No bids have been acknowledged yet.</strong>Suppliers can submit a sealed offer, or load labeled synthetic bids for this demo.</li>`;
  }
  return runtime.submissions.map((entry, index) => `
    <li class="commitment-row">
      <span><span class="commitment-name">Commitment ${String(index + 1).padStart(2, "0")}</span><span class="commitment-meta">Received ${escapeHtml(formatDate(entry.receipt.payload.receivedAt))}</span></span>
      <span class="commitment-status">Signed receipt</span>
      <button type="button" class="text-button" data-action="download-receipt" data-index="${index}">Save receipt</button>
    </li>`).join("");
}

function renderRules() {
  setHeading("Rules before offers", "The terms are fixed before suppliers submit. Each bid is encrypted for the buyer and tied to its own receipt.");
  const event = runtime.state.event;
  elements.content.innerHTML = `
    <h2>One published award rule</h2>
    <p class="stage-intro">A supplier can verify that its acknowledged commitment appears in the frozen set. The buyer still sees the bids when the window closes.</p>
    <ul class="rule-list">
      <li><span class="rule-label">Award</span><span class="rule-value">Lowest valid price wins</span></li>
      <li><span class="rule-label">Exact tie</span><span class="rule-value">Earliest signed receipt wins</span></li>
      <li><span class="rule-label">Currency</span><span class="rule-value">USD, cents represented as integers</span></li>
      <li><span class="rule-label">Deadline</span><span class="rule-value">${escapeHtml(formatDate(event.deadline))}</span></li>
    </ul>
    <div class="button-row">${button("Go to sealed bids", "go-submissions")}</div>
    <details class="disclosure">
      <summary>What is committed in the rules hash?</summary>
      <div class="disclosure-body"><p>The award rule, tie-break, deadline, eligibility policy, currency, canonical format, and operator keys are bound before bidding. The public rules hash is <span class="hash-value">${escapeHtml(runtime.state.rulesHash)}</span></p></div>
    </details>`;
  elements.content.insertAdjacentHTML("beforeend", `<details class="disclosure"><summary>Reset this local demo</summary><div class="disclosure-body"><p>This clears the in-memory tender and rotates its demo keys. It does not affect wallet files or any Zcash network.</p>${button("Start a fresh demo", "reset-demo", { secondary: true, small: true })}</div></details>`);
}

function renderBuyerSubmissions() {
  const open = runtime.state.phase === "open";
  const count = runtime.state.receiptCount;
  setHeading(open ? "Collect sealed offers" : "The bid window is closed", open
    ? "Bids stay sealed from competing suppliers. The buyer opens them when the window closes."
    : "The accepted set is frozen. Open the award stage to review the signed result.");
  elements.content.innerHTML = `
    <div class="section-heading"><h2>Received commitments</h2><span class="count-label">${count} ${count === 1 ? "receipt" : "receipts"}</span></div>
    <ul class="commitment-list">${listRows()}</ul>
    <div class="button-row">
      ${button("Load three synthetic bids", "load-samples", { secondary: true, disabled: !open || count > 0 })}
      ${button("Review the bid set", "go-closure", { disabled: count === 0 })}
    </div>
    <p class="inline-note">Before closure, the list shows receipt status only. Prices and supplier terms remain sealed.</p>`;
}

function renderSupplierSubmissions() {
  setHeading("Send a sealed offer", "Your bid is encrypted before it leaves this browser. Keep the private receipt file after submission.");
  const disabled = runtime.state.phase !== "open";
  const ownReceipts = runtime.submissions.filter((entry) => entry.submittedAs === "supplier");
  const lastReceipt = ownReceipts.at(-1);
  elements.content.innerHTML = `
    ${disabled ? `<p class="empty-state"><strong>The submission window has closed.</strong>You can still check a receipt you saved before closure.</p>` : `<h2>Bid details</h2>
    <p class="stage-intro">The buyer can open bids after closure. Competing suppliers cannot inspect your offer.</p>
    <form id="bid-form" class="form-grid" novalidate>
      <div class="field field--wide"><label for="supplier-alias">Supplier name</label><input id="supplier-alias" name="supplierAlias" autocomplete="organization" maxlength="32" placeholder="Example: Atlas Medical" required><span class="field-hint">Use a synthetic name for this demo.</span></div>
      <div class="field"><label for="bid-price">Total offer (USD)</label><input id="bid-price" name="price" inputmode="decimal" autocomplete="off" placeholder="48,200.00" required></div>
      <div class="field"><label for="delivery-days">Delivery time</label><input id="delivery-days" name="deliveryDays" type="number" min="1" max="365" step="1" value="14" required></div>
      <div class="field--wide"><button type="submit" class="button"${disabled ? " disabled" : ""}>Seal and submit offer</button></div>
    </form>`}
    ${lastReceipt ? `<div class="result-block"><p class="result-label">Latest signed receipt</p><p class="result-meta">Receipt ${escapeHtml(lastReceipt.receipt.payload.sequence)} · ${escapeHtml(formatDate(lastReceipt.receipt.payload.receivedAt))}</p><p class="result-meta">Your private bundle was prepared for download when you submitted.</p></div>` : ""}
    <p class="inline-note">Do not share your receipt bundle publicly; it contains your bid and salt for private verification.</p>`;
}

function renderSubmissions() {
  if (runtime.role === "buyer") renderBuyerSubmissions();
  else if (runtime.role === "supplier") renderSupplierSubmissions();
  else {
    setHeading("Wait for the frozen set", "Independent review starts after the buyer publishes the closure and award records.");
    elements.content.innerHTML = `<h2>Nothing to inspect yet</h2><p class="stage-intro">Once the tender closes, an authorized buyer can share a restricted audit package. It contains only the eligible bids needed to reproduce the award.</p><div class="button-row">${button("View published rules", "go-rules", { secondary: true })}</div>`;
  }
}

function renderClosure() {
  const manifest = runtime.state.closure?.manifest;
  const manifestDisclosure = manifest ? `<details class="disclosure"><summary>Inspect signed closure manifest</summary><div class="disclosure-body"><p>${escapeHtml(manifest.acceptedBidCount)} commitments are bound to this root.</p><span class="hash-value">${escapeHtml(manifest.acceptedBidMerkleRoot)}</span></div></details>` : "";
  if (runtime.role !== "buyer") {
    setHeading("Verify the frozen bid set", "A signed manifest records the exact commitments the buyer accepted at closure.");
    const supplierContent = runtime.role === "supplier"
      ? `<div class="button-row">${button("Check my receipt", "check-own-receipt", { disabled: !runtime.submissions.some((entry) => entry.submittedAs === "supplier") })}</div>${renderSupplierEvidence()}`
      : `<p class="inline-note">Use the award stage to verify a restricted package shared for review.</p>`;
    elements.content.innerHTML = `<h2>Supplier evidence after closure</h2><p class="stage-intro">A receipt plus an inclusion proof shows that a commitment is in the frozen set. A valid receipt without a proof is evidence of an omission.</p>${supplierContent}${manifestDisclosure}`;
    return;
  }
  const open = runtime.state.phase === "open";
  setHeading(open ? "Freeze the accepted bid set" : "The accepted set is frozen", open
    ? "Close when submissions are complete. This synthetic demo records, but does not enforce, its configured deadline."
    : "The signed closure manifest and Merkle root are now fixed.");
  const count = runtime.state.receiptCount;
  const omittedCheckbox = runtime.submissions.length > 1
    ? `<details class="disclosure"><summary>Omission challenge demo</summary><div class="disclosure-body"><label class="check-row"><input type="checkbox" id="simulate-omission"${runtime.omittedBidId ? " checked" : ""}><span>Leave the last acknowledged synthetic bid out of the accepted set to demonstrate a supplier challenge. This is a deliberate failure scenario.</span></label></div></details>`
    : "";
  elements.content.innerHTML = `
    <div class="section-heading"><h2>Submission window</h2><span class="count-label">${count} ${count === 1 ? "receipt" : "receipts"} acknowledged</span></div>
    <ul class="commitment-list">${listRows()}</ul>
    <div class="button-row">${button(open ? "Close and sign the accepted set" : "View award decision", open ? "close-tender" : "go-award", { disabled: open && count === 0 })}</div>
    <p class="inline-note">The operator can read bid details during evaluation. Public observers see the signed root, not the bids. This synthetic event can be closed manually before its configured deadline.</p>
    ${manifestDisclosure}
    ${omittedCheckbox}`;
}

function renderSupplierEvidence() {
  if (!runtime.supplierEvidence) return "";
  const evidence = runtime.supplierEvidence;
  const detail = evidence.included
    ? "Your acknowledged commitment has a valid inclusion proof."
    : "A valid receipt has no inclusion proof in the frozen set. This is evidence of an inconsistency, not automatic enforcement.";
  return `<div class="result-block"><p class="result-label">${evidence.included ? "Inclusion verified" : "Inclusion not found"}</p><p class="result-meta">${escapeHtml(detail)}</p></div>`;
}

function renderAward() {
  const publicAward = runtime.state.award;
  if (runtime.role === "supplier") {
    const ownReceipt = runtime.submissions.filter((entry) => entry.submittedAs === "supplier").at(-1);
    setHeading("Check your submission", "Your receipt and inclusion result stay in your supplier view. Other suppliers’ bid terms are not shown here.");
    elements.content.innerHTML = ownReceipt
      ? `<h2>Your signed receipt</h2><p class="stage-intro">Receipt ${escapeHtml(ownReceipt.receipt.payload.sequence)} was acknowledged at ${escapeHtml(formatDate(ownReceipt.receipt.payload.receivedAt))}.</p><div class="button-row">${button("Check inclusion proof", "check-own-receipt", { secondary: true })}</div>${renderSupplierEvidence()}`
      : `<div class="empty-state"><strong>No supplier receipt is held in this browser session.</strong>Switch to the supplier role and submit an offer to download a private receipt bundle.</div>`;
    return;
  }
  if (runtime.role === "auditor") {
    setHeading("Verify a restricted award package", "The package contains private bid terms. Verify it only if the buyer has authorized you to review them.");
    elements.content.innerHTML = `
      <h2>Choose an audit package</h2>
      <p class="stage-intro">BlindTender checks the operator signatures, bid commitments, inclusion proofs, rules hash, and reproducible award.</p>
      <label class="file-control" for="audit-package">Restricted JSON package<input id="audit-package" type="file" accept="application/json,.json"></label>
      ${runtime.auditResult ? renderAuditResult(runtime.auditResult) : ""}
      <p class="inline-note">A valid package proves that the supplied bids match the published rules and award. It does not prove that the buyer accepted every attempted bid.</p>`;
    return;
  }

  const privateAward = runtime.latestAward;
  setHeading("The award is recorded", privateAward
    ? "The buyer's decision is reproducible from the bids disclosed in the restricted audit package."
    : "The public record contains a signed award reference. Commercial terms stay in the buyer's restricted record.");
  const awardDisplay = privateAward
    ? `<div class="result-block"><p class="result-label">Selected supplier</p><p class="result-title">${escapeHtml(privateAward.payload.winnerAlias ?? findWinnerAlias(privateAward))}</p><p class="result-meta">${escapeHtml(formatMoney(privateAward.payload.winningAmountMinor))} · lowest valid offer</p></div>`
    : publicAward
      ? `<div class="result-block"><p class="result-label">Public award reference</p><p class="result-meta">Winner commitment ${escapeHtml(publicAward.payload.winnerCommitment.slice(0, 18))}…</p></div>`
      : `<div class="empty-state"><strong>No award has been published.</strong>Close the submission window to produce a deterministic decision.</div>`;
  const actions = privateAward ? `
    <div class="button-row">
      ${button("Download restricted audit package", "download-audit", { secondary: true })}
      ${button("Check bid integrity", "check-tamper", { secondary: true })}
      ${button("Check inclusion evidence", "check-omission", { secondary: true })}
    </div>` : "";
  const evidence = publicAward ? `
    <details class="disclosure"><summary>Inspect public evidence</summary><div class="disclosure-body">
      <p>A public signature covers this award reference. It does not reveal the winning price or the eligible bid list.</p>
      <span class="hash-value">${escapeHtml(publicAward.payload.awardDecisionHash)}</span>
      ${runtime.state.closure?.manifest ? `<p>Signed closure root</p><span class="hash-value">${escapeHtml(runtime.state.closure.manifest.acceptedBidMerkleRoot)}</span>` : ""}
    </div></details>` : "";
  elements.content.innerHTML = `${awardDisplay}${actions}${runtime.auditResult ? renderAuditResult(runtime.auditResult) : ""}${evidence}<div id="challenge-result"></div><div class="button-row">${button("Continue to settlement", "go-settlement", { secondary: true })}</div>`;
}

function findWinnerAlias(award) {
  const winner = runtime.submissions.find((entry) => entry.commitment === award.payload.winnerCommitment);
  return winner?.bid.supplierAlias ?? "Supplier name held in restricted record";
}

function renderAuditResult(result) {
  const checkNames = {
    awardDecisionHash: "Award decision hash",
    awardSignature: "Award signature",
    closureSignature: "Closure signature",
    commitments: "Bid commitments",
    inclusionProofs: "Inclusion proofs",
    receipts: "Supplier receipts",
    reproducibleAward: "Award recomputation",
    rulesHash: "Published rules",
  };
  const rows = Object.entries(result.checks ?? {}).map(([name, valid]) => `<li><span>${escapeHtml(checkNames[name] ?? name)}</span><strong>${valid ? "PASS" : "FAIL"}</strong></li>`).join("");
  return `<div class="result-block"><p class="result-label">${result.valid ? "Package verified" : "Package verification failed"}</p><ul class="audit-checks">${rows}</ul></div>`;
}

function currentAwardHash() {
  return runtime.latestAward?.awardDecisionHash ?? runtime.state.award?.payload?.awardDecisionHash ?? null;
}

function settlementStateIndex() {
  const state = runtime.state.settlement?.payload?.state;
  return ["created", "broadcast", "mined", "confirmed", "detected-by-recipient"].indexOf(state);
}

function renderSettlement() {
  const awardHash = currentAwardHash();
  const knownSettlement = runtime.state.settlement?.payload ?? null;
  setHeading("Settle privately", "The winning award hash belongs in the encrypted Zcash memo. Public observers should not see the recipient, amount, or memo.");
  const lifecycle = ["Created", "Broadcast", "Mined", "Confirmed", "Recipient detected"];
  const active = settlementStateIndex();
  const steps = lifecycle.map((label, index) => `<li class="${index < active ? "is-complete" : index === active ? "is-current" : ""}">${escapeHtml(label)}</li>`).join("");
  const status = knownSettlement
    ? `<div class="result-block"><p class="result-label">${escapeHtml(knownSettlement.network)} · ${escapeHtml(knownSettlement.state)}</p><p class="result-meta">Transaction reference: <span class="hash-value">${escapeHtml(knownSettlement.transactionId)}</span></p></div>`
    : `<div class="empty-state"><strong>No public-testnet payment is recorded for this award.</strong>Broadcast is not proof of receipt. Keep the settlement state here until the recipient wallet detects the matching memo.</div>`;
  const memo = awardHash ? `BlindTender:v1:${awardHash}` : "Close the tender to generate the award reference.";
  elements.content.innerHTML = `
    <h2>Private payment evidence</h2>
    <p class="stage-intro">The award decision is immutable before payment. Its hash links the private Zcash memo to this tender without exposing the contract value publicly.</p>
    <ol class="settlement-list">${steps}</ol>
    ${status}
    <div class="evidence-row"><span class="rule-label">Encrypted memo</span><span class="rule-value hash-value">${escapeHtml(memo)}</span></div>
    <div class="button-row">${awardHash ? button("Copy award reference", "copy-award-hash", { secondary: true }) : ""}${button("Refresh settlement state", "refresh", { secondary: true })}</div>
    <details class="disclosure"><summary>What this prototype has verified</summary><div class="disclosure-body"><p>The local regtest proof confirmed shielded recipient detection and an exact award-reference memo match. Regtest proves the integration path, not a public-testnet payment.</p><p>The public-testnet wallet still needs funds before a real payment can be shown. This screen never treats a mocked or broadcast-only transaction as received.</p>${awardHash ? `<p>After funding the testnet sender, run <code>npm run zcash:preflight -- send ${escapeHtml(awardHash)}</code>, then run <code>npm run zcash:preflight -- verify</code> after broadcast.</p><div class="button-row">${button("Copy testnet send command", "copy-testnet-command", { secondary: true, small: true })}</div>` : ""}</div></details>`;
}

function render() {
  if (!runtime.state) return;
  const animateTransition = runtime.animateStageChange;
  runtime.animateStageChange = false;
  clearAnnouncement();
  renderNavigation();
  switch (runtime.stage) {
    case "rules": renderRules(); break;
    case "submissions": renderSubmissions(); break;
    case "closure": renderClosure(); break;
    case "award": renderAward(); break;
    case "settlement": renderSettlement(); break;
    default: runtime.stage = "submissions"; renderSubmissions();
  }
  elements.content.classList.remove("is-changing");
  if (animateTransition) requestAnimationFrame(() => {
    elements.content.classList.add("is-changing");
    elements.heading.focus({ preventScroll: true });
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    window.scrollTo({ top: 0, behavior });
  });
}

function changeStage(stage) {
  if (!stages.includes(stage)) return;
  if (runtime.stage === stage) return;
  runtime.stage = stage;
  runtime.animateStageChange = true;
  render();
}

function canonicalRules() {
  const event = runtime.state.event;
  return {
    awardRule: event.awardRule,
    canonicalizationVersion: event.canonicalizationVersion,
    currency: event.currency,
    deadline: event.deadline,
    eligibilityPolicy: event.eligibilityPolicy,
    encryptionPublicKey: runtime.keys.encryptionPublicKey,
    eventId: event.eventId,
    operatorSigningKey: runtime.keys.operatorSigningKey,
    tieBreakRule: event.tieBreakRule,
  };
}

async function submitBid(bid, { downloadReceipt = false } = {}) {
  const { commitment, salt } = await commitBid(bid);
  const envelope = await sealBidForOperator(bid, salt, runtime.keys.encryptionPublicKey);
  const receipt = await api("/api/bids", { method: "POST", body: JSON.stringify({ bidId: bid.bidId, commitment, envelope }) });
  const bundle = createPrivateReceiptBundle({ bid, salt, commitment, receipt, rulesHash: runtime.keys.rulesHash });
  const entry = { bid, commitment, envelope, receipt, salt, bundle, submittedAs: runtime.role };
  runtime.submissions.push(entry);
  if (downloadReceipt) downloadPrivateReceipt(bundle);
  return entry;
}

function bidFromForm(form) {
  const values = new FormData(form);
  const supplierAlias = String(values.get("supplierAlias")).trim().normalize("NFC");
  if (!/^[A-Z][A-Za-z0-9 ]{1,31}$/.test(supplierAlias)) throw new TypeError("Use a supplier name starting with a capital letter, 2–32 characters long.");
  const price = String(values.get("price")).trim().replaceAll(",", "");
  const priceMatch = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(price);
  if (!priceMatch) throw new TypeError("Enter a positive USD amount with no more than two decimal places.");
  const amountMinor = Number(priceMatch[1]) * 100 + Number((priceMatch[2] ?? "").padEnd(2, "0"));
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 1 || amountMinor > 100_000_000_000) throw new TypeError("The offer amount is outside the supported range.");
  const deliveryDays = Number(values.get("deliveryDays"));
  if (!Number.isInteger(deliveryDays) || deliveryDays < 1 || deliveryDays > 365) throw new TypeError("Delivery time must be between 1 and 365 days.");
  return {
    amountMinor,
    bidId: `bid-${crypto.randomUUID().slice(0, 12)}`,
    currency: "USD",
    deliveryDays,
    eventId: runtime.state.event.eventId,
    schemaVersion: "blindtender.bid.v1",
    supplierAlias,
  };
}

function buildAuditPackage() {
  if (!runtime.latestAward || !runtime.latestClosure) throw new Error("Close the tender before creating an audit package.");
  const eligible = runtime.latestAward.payload.eligibleBidCommitments;
  const disclosedEligibleBids = runtime.submissions.filter((entry) => eligible.includes(entry.commitment)).map((entry) => ({
    bid: entry.bid,
    commitment: entry.commitment,
    inclusionProof: runtime.latestClosure.proofs[entry.commitment],
    receipt: entry.receipt,
    salt: entry.salt,
  }));
  return {
    award: runtime.latestAward,
    closure: { manifest: runtime.latestClosure.manifest, signature: runtime.latestClosure.signature },
    disclosedEligibleBids,
    generatedAt: new Date().toISOString(),
    operatorSigningKey: runtime.keys.operatorSigningKey,
    purpose: "authorized-award-recomputation",
    rules: canonicalRules(),
    settlement: runtime.state.settlement,
    warning: "Restricted package: disclosedEligibleBids contains confidential supplier terms.",
  };
}

function downloadJson(value, filename) {
  const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function withButtonAction(buttonElement, busyLabel, action) {
  if (runtime.busy) return;
  runtime.busy = true;
  setBusy(buttonElement, true, busyLabel);
  clearAnnouncement();
  try {
    await action();
  } catch (error) {
    announce(error.message || "That action did not complete. Try again.", "error");
    setBusy(buttonElement, false);
  } finally {
    runtime.busy = false;
    if (buttonElement.isConnected) setBusy(buttonElement, false);
  }
}

async function loadSamples() {
  if (runtime.state.phase !== "open") throw new Error("The bid window is already closed.");
  if (runtime.submissions.length) throw new Error("This browser already has submissions. Reset the demo before loading the sample set.");
  for (const sample of sampleBids) {
    await submitBid({ ...sample, currency: "USD", eventId: runtime.state.event.eventId, schemaVersion: "blindtender.bid.v1" });
  }
  await refreshState();
  announce("Three synthetic bids were encrypted and acknowledged with signed receipts.");
}

async function closeTender() {
  const simulateOmission = document.querySelector("#simulate-omission")?.checked ?? false;
  const omitted = simulateOmission ? runtime.submissions.at(-1)?.bid.bidId : null;
  const result = await api("/api/close", { method: "POST", body: JSON.stringify({ omitBidId: omitted }) });
  runtime.latestAward = result.award;
  runtime.latestClosure = result.closure;
  runtime.omittedBidId = omitted;
  runtime.stage = "award";
  runtime.animateStageChange = true;
  await refreshState();
  announce(omitted ? "The accepted set is frozen. One acknowledged receipt was left out for the challenge demo." : "The accepted set is frozen and the award decision has been signed.");
}

async function verifyAuditPackage(audit) {
  runtime.auditResult = await api("/api/verify-audit-package", { method: "POST", body: JSON.stringify(audit) });
  render();
  announce(runtime.auditResult.valid ? "Every check in the restricted audit package passed." : "Some audit checks failed. Review the listed results.", runtime.auditResult.valid ? "success" : "error");
}

document.querySelector(".stage-nav").addEventListener("click", (event) => {
  const buttonElement = event.target.closest("[data-stage]");
  if (buttonElement) changeStage(buttonElement.dataset.stage);
});

document.querySelector(".role-control").addEventListener("click", (event) => {
  const buttonElement = event.target.closest("[data-role]");
  if (!buttonElement) return;
  runtime.role = buttonElement.dataset.role;
  runtime.supplierEvidence = null;
  render();
});

elements.content.addEventListener("submit", async (event) => {
  if (event.target.id !== "bid-form") return;
  event.preventDefault();
  const submitButton = event.target.querySelector("button[type=submit]");
  await withButtonAction(submitButton, "Encrypting offer…", async () => {
    const bid = bidFromForm(event.target);
    await submitBid(bid, { downloadReceipt: true });
    await refreshState();
    announce("Offer encrypted. Your private signed receipt bundle was downloaded.");
  });
});

elements.content.addEventListener("change", async (event) => {
  if (event.target.id === "audit-package" && event.target.files?.[0]) {
    try {
      const audit = JSON.parse(await event.target.files[0].text());
      await verifyAuditPackage(audit);
    } catch (error) {
      announce(error.message || "This file could not be verified.", "error");
    }
  }
});

elements.content.addEventListener("click", async (event) => {
  const buttonElement = event.target.closest("[data-action]");
  if (!buttonElement) return;
  const action = buttonElement.dataset.action;
  if (action === "go-rules") return changeStage("rules");
  if (action === "go-submissions") return changeStage("submissions");
  if (action === "go-closure") return changeStage("closure");
  if (action === "go-award") return changeStage("award");
  if (action === "go-settlement") return changeStage("settlement");
  if (action === "download-receipt") {
    const entry = runtime.submissions[Number(buttonElement.dataset.index)];
    if (entry) downloadPrivateReceipt(entry.bundle);
    return;
  }
  if (action === "load-samples") return withButtonAction(buttonElement, "Sealing three bids…", loadSamples);
  if (action === "close-tender") return withButtonAction(buttonElement, "Closing and signing…", closeTender);
  if (action === "refresh") return withButtonAction(buttonElement, "Refreshing…", async () => { await refreshState(); announce("Settlement state refreshed."); });
  if (action === "reset-demo") return withButtonAction(buttonElement, "Starting fresh…", async () => {
    await api("/api/reset", { method: "POST" });
    runtime.role = "buyer";
    runtime.stage = "submissions";
    runtime.submissions = [];
    runtime.latestAward = null;
    runtime.latestClosure = null;
    runtime.omittedBidId = null;
    runtime.supplierEvidence = null;
    runtime.auditResult = null;
    runtime.animateStageChange = true;
    await refreshState();
    announce("A fresh in-memory tender is ready. The previous demo record and keys were cleared.");
  });
  if (action === "copy-award-hash") {
    const hash = currentAwardHash();
    if (!hash) return announce("Close the tender first to create an award reference.", "error");
    try { await navigator.clipboard.writeText(hash); announce("Award reference copied."); }
    catch { announce("Clipboard access is unavailable in this browser.", "error"); }
    return;
  }
  if (action === "copy-testnet-command") {
    const hash = currentAwardHash();
    if (!hash) return announce("Close the tender first to create an award reference.", "error");
    try { await navigator.clipboard.writeText(`npm run zcash:preflight -- send ${hash}`); announce("Testnet send command copied."); }
    catch { announce("Clipboard access is unavailable in this browser.", "error"); }
    return;
  }
  if (action === "download-audit") {
    try {
      downloadJson(buildAuditPackage(), "blindtender-restricted-audit-package.json");
      announce("Restricted package downloaded. It contains confidential eligible bid terms.");
    } catch (error) { announce(error.message, "error"); }
    return;
  }
  if (action === "check-tamper") return withButtonAction(buttonElement, "Checking commitment…", async () => {
    const entry = runtime.submissions[0];
    if (!entry) throw new Error("No local bid is available for the tamper demonstration.");
    const alteredBid = { ...entry.bid, amountMinor: entry.bid.amountMinor + 1 };
    const report = await api("/api/challenges/tamper", { method: "POST", body: JSON.stringify({ bidId: entry.bid.bidId, bid: alteredBid, salt: entry.salt }) });
    const result = document.querySelector("#challenge-result");
    if (result) result.innerHTML = `<div class="result-block"><p class="result-label">${report.matches ? "Opening matches commitment" : "Modified bid rejected"}</p><p class="result-meta">Changing one cent changes the commitment. The submitted opening ${report.matches ? "matches" : "does not match"} its receipt.</p></div>`;
    announce(report.matches ? "No tampering was detected in this opening." : "The modified bid failed the commitment check.");
  });
  if (action === "check-omission") return withButtonAction(buttonElement, "Checking inclusion…", async () => {
    const candidate = runtime.omittedBidId ?? runtime.submissions[0]?.bid.bidId;
    if (!candidate) throw new Error("No supplier receipt is available for this challenge.");
    const report = await api(`/api/challenges/omission/${encodeURIComponent(candidate)}`);
    const result = document.querySelector("#challenge-result");
    if (result) result.innerHTML = `<div class="result-block"><p class="result-label">${report.conclusion === "acknowledged-but-not-included" ? "Acknowledged bid omitted" : "No omission detected"}</p><p class="result-meta">${escapeHtml(report.warning)}</p></div>`;
    announce(report.conclusion === "acknowledged-but-not-included" ? "A valid receipt exists without an inclusion proof." : "This supplier's receipt is included in the frozen set.");
  });
  if (action === "check-own-receipt") return withButtonAction(buttonElement, "Checking receipt…", async () => {
    const entry = runtime.submissions.filter((submission) => submission.submittedAs === "supplier").at(-1);
    if (!entry) throw new Error("This browser has no private receipt to check.");
    runtime.supplierEvidence = await api(`/api/evidence/${encodeURIComponent(entry.bid.bidId)}`);
    render();
    announce(runtime.supplierEvidence.included ? "Your bid has a valid inclusion proof." : "Your receipt has no inclusion proof in the frozen set.", runtime.supplierEvidence.included ? "success" : "error");
  });
});

for (const buttonElement of document.querySelectorAll("[data-role]")) {
  buttonElement.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      const buttons = [...document.querySelectorAll("[data-role]")];
      const current = buttons.indexOf(buttonElement);
      const next = buttons[(current + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length];
      next.focus();
      next.click();
      event.preventDefault();
    }
  });
}

refreshState().catch((error) => {
  elements.eventTitle.textContent = "Local server unavailable";
  setHeading("Start the BlindTender server", "The local API did not respond. Start it with npm start, then reload this page.");
  elements.content.innerHTML = `<div class="empty-state"><strong>${escapeHtml(error.message)}</strong>Run <code>npm start</code> in the project directory and open this page again.</div>`;
  announce("The local tender API is unavailable.", "error");
});
