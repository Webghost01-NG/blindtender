<!-- impeccable:product -->

# BlindTender product context

## Product truths

- BlindTender is a two-day hackathon proof of a tamper-evident evidence chain for confidential procurement.
- The single demo event has three synthetic suppliers, one operator, one buyer, and one authorized auditor.
- The award rule is fixed before bidding: the lowest valid price wins; the earliest acknowledged receipt breaks an exact tie.
- The operator is trusted with bid confidentiality during opening and evaluation. BlindTender does not claim operator-private computation or public proof of correct confidential evaluation.
- Losing bids remain hidden from the public and competing suppliers after the award.
- Suppliers retain a signed submission receipt and, after closure, a Merkle inclusion proof against a signed closure manifest.
- A supplier can demonstrate that an acknowledged commitment is missing from the frozen accepted set, but cannot prove that an attempted submission was accepted without a receipt.
- The immutable award decision is hashed and referenced inside the winning supplier's encrypted Zcash memo.
- Settlement evidence is a separate signed record. This avoids a circular hash in which a transaction ID would change the award record whose prior hash is already in the transaction memo.
- A transaction is not reported as received merely because it was broadcast. The lifecycle is created, broadcast, mined, confirmed, and detected by recipient.
- A public transaction identifier is not treated as proof of recipient, amount, or memo contents.
- The demo must use an actual Zcash transaction. A local regtest transaction may prove integration mechanics during development, but it must never be described as public testnet settlement.

## Scope

### In scope

- One preconfigured procurement event.
- Canonical bid serialization with integer minor units.
- Browser-side authenticated encryption.
- SHA-256 commitments with explicit domain separation.
- Ed25519 operator signatures for receipts, closure manifests, award decisions, and settlement records.
- Deterministically sorted accepted commitments and Merkle inclusion proofs.
- Deterministic lowest-price evaluation.
- Tampered-bid and omitted-bid challenge demonstrations.
- Zcash shielded payment memo bound to the award-decision hash.
- A visible privacy and trust model.

### Out of scope

- Production procurement, escrow, custody, KYC, legal contracting, or real-money use.
- Multiple tenders, accounts, directories, uploads, editable bids, withdrawals, refunds, analytics, and multi-criteria scoring.
- Custom zero-knowledge circuits, smart contracts, operator-private matching, or public proofs over confidential bids.
- Claims that payment proves physical delivery or contract performance.

## Users and core jobs

- Supplier: submit a confidential bid, retain evidence of acceptance, verify inclusion at closure, and privately verify settlement if selected.
- Operator/buyer: publish immutable rules, acknowledge submissions, freeze the accepted set, open and evaluate bids, and pay the winner.
- Auditor: verify a deliberately scoped evidence package without making losing bids public.
- Public observer: verify signed public artifacts without learning individual bid terms or shielded payment details.

## Success criteria

- Three encrypted bids produce three valid signed receipts.
- Closure produces a signed manifest, stable Merkle root, and valid proof for each included commitment.
- Independent evaluation reproduces the winner and tie-break result.
- Modified bid material fails commitment verification.
- An acknowledged but omitted commitment produces a clear inconsistency report.
- The winner receives an actual shielded payment whose decrypted memo contains the exact award-decision hash.
- Public-facing copy clearly distinguishes cryptographic guarantees, signed attestations, evidence, and trusted operator actions.

## Visual and interaction principles

- The primary surface should feel like a chain-of-custody instrument used by commercial operators, not a generic crypto dashboard.
- Evidence lineage is the visual organizing mechanism: rules, receipt, closure, award, and settlement should read as one linked sequence.
- User-pinned density rule: never show the entire operational model at once. Each screen has one primary task, ample whitespace, and progressive disclosure for hashes, proofs, bid details, and trust notes.
- User-pinned visual reference: use PamoSafe's discipline—black and white, very clear large type, generous whitespace, rounded high-contrast controls, and short purposeful transitions—without copying its branding or landing-page content.
- Use restrained, high-contrast typography; avoid generic SaaS blue, neon cyberpunk decoration, excessive cards, decorative terminal chrome, and tiny text.
- Motion is functional and quiet: 150–250ms control feedback, a single stage-transition movement, and full `prefers-reduced-motion` support. No perpetual or attention-seeking animation.
- Prioritize legible hashes, signatures, statuses, verification outcomes, and explicit visibility labels.
- The interface must remain usable at 390px and 1440px widths with keyboard access and visible focus states.

## Assumptions

- Inferred from the authorized pivot: the user wants implementation to begin immediately rather than another ideation round.
- Delegated technical choice: static HTML/CSS/JavaScript and Node.js built-ins, selected to avoid dependency risk and match the two-day scope.
- Delegated visual choice pending direction exploration: an evidence-led procurement instrument rather than the earlier cyberpunk terminal concept.
- Public testnet funding may require an external faucet and wallet synchronization; until verified, the public-testnet settlement criterion remains a release blocker.
