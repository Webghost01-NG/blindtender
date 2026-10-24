const hashPattern = /^[a-f0-9]{64}$/;

export function createPrivateReceiptBundle({ bid, salt, commitment, receipt, rulesHash }) {
  if (!bid || typeof bid !== "object") throw new TypeError("Bid is required");
  if (!hashPattern.test(salt ?? "")) throw new TypeError("Invalid bid salt");
  if (!hashPattern.test(commitment ?? "")) throw new TypeError("Invalid commitment");
  if (!hashPattern.test(rulesHash ?? "")) throw new TypeError("Invalid rules hash");
  if (!receipt?.payload || typeof receipt.signature !== "string") throw new TypeError("Signed receipt is required");
  if (receipt.payload.commitment !== commitment || receipt.payload.bidId !== bid.bidId || receipt.payload.eventId !== bid.eventId) {
    throw new TypeError("Receipt fields do not match this bid");
  }
  return {
    bundleVersion: "blindtender.private-receipt.v1",
    bid,
    commitment,
    receipt,
    rulesHash,
    salt,
    savedAt: new Date().toISOString(),
  };
}

export function downloadPrivateReceipt(bundle, fileName = `${bundle.bid.bidId}-private-receipt.json`) {
  const blob = new Blob([`${JSON.stringify(bundle, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function readPrivateReceipt(file) {
  if (!(file instanceof Blob)) throw new TypeError("A receipt file is required");
  const bundle = JSON.parse(await file.text());
  if (bundle.bundleVersion !== "blindtender.private-receipt.v1") throw new TypeError("Unsupported receipt bundle version");
  createPrivateReceiptBundle(bundle);
  return bundle;
}
