# Threat model

## Protected assets

- Confidential bid terms and salts.
- Operator signing and decryption keys.
- Supplier-held receipts and inclusion proofs.
- Integrity of event rules, closure root, award decision, and settlement reference.
- Recipient-visible Zcash amount and memo.

## In-scope adversaries

- A curious public observer inspecting application output and the Zcash chain.
- A competing supplier attempting to inspect or modify another bid.
- An operator who modifies or omits an acknowledged submission after receipt issuance.
- A party who substitutes an unrelated settlement transaction or award reference.

## Demonstrated controls

- RSA-OAEP plus AES-256-GCM bid envelopes.
- Domain-separated SHA-256 commitments.
- Ed25519 signatures over receipts and event artifacts.
- Deterministically sorted Merkle closure roots and supplier inclusion proofs.
- Deterministic award recomputation from authorized disclosed inputs.
- Exact award-decision hash matching in the encrypted Zcash memo.
- Explicit created-to-recipient-detected settlement lifecycle.

## Accepted risks

- The operator sees all decrypted bids and can apply unfair eligibility decisions.
- The operator can refuse to acknowledge an attempted submission.
- Application and network metadata remain outside the cryptographic protection.
- In-memory keys and state are suitable only for a disposable demonstration.
- No delivery, legal performance, identity, or regulatory compliance is proven.

## Failure policy

BlindTender fails closed on unknown bid fields, non-integer money, invalid signatures, commitment mismatches, duplicate IDs or commitments, invalid proof paths, award-reference mismatches, skipped settlement states, and recipient detection without a matching memo.
