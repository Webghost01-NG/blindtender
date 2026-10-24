export function evaluateLowestPrice(openedBids) {
  if (!Array.isArray(openedBids) || openedBids.length === 0) throw new TypeError("At least one eligible bid is required");
  const ranked = [...openedBids].sort((left, right) =>
    left.bid.amountMinor - right.bid.amountMinor ||
    left.receipt.sequence - right.receipt.sequence ||
    left.bid.bidId.localeCompare(right.bid.bidId)
  );
  return {
    rule: "lowest-valid-price",
    tieBreak: "earliest-acknowledged-receipt",
    rankedCommitments: ranked.map((entry) => entry.commitment),
    winnerCommitment: ranked[0].commitment,
    winningAmountMinor: ranked[0].bid.amountMinor,
  };
}
