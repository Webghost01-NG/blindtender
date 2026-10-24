# Architecture

## Evidence model

1. The event configuration binds the award rule, currency, tie-break, deadline, canonicalization version, eligibility policy, encryption key, and operator signing key.
2. A browser canonicalizes a bid, commits to it with a random 32-byte salt, encrypts the bid using AES-256-GCM, and wraps that key for the operator with RSA-OAEP.
3. The operator signs a receipt over the event ID, bid ID, commitment, timestamp, sequence, and signing-key ID.
4. At closure the operator decrypts and validates bids, sorts accepted commitments bytewise, creates a Merkle tree, and signs the closure manifest.
5. The deterministic evaluator selects the lowest valid amount; receipt order breaks exact ties.
6. The immutable award decision binds the rules hash, closure-manifest hash, eligible commitments, winner commitment, winning amount, and evaluation output.
7. A separate settlement record tracks the Zcash transaction lifecycle and binds the transaction to the award-decision hash found in the encrypted memo.

## Why two records

The award decision cannot both contain a settlement transaction ID and be hashed into that transaction's memo: adding the transaction ID changes the hash. BlindTender therefore signs an immutable `awardDecision`, places its hash in the memo, then signs a separate `settlementRecord` containing both the award hash and transaction ID.

## Trust boundaries

- The operator can read all opened bids and decide eligibility.
- Signed receipts detect modification of acknowledged fields but do not force acceptance.
- A signed Merkle root freezes the operator's declared accepted set. It does not prove that every attempted submission was accepted.
- An inclusion proof proves membership in that frozen set. Absence plus a valid receipt is evidence of inconsistency, not automatic enforcement.
- Reproducible evaluation requires an authorized verifier to receive the eligible confidential inputs.
- Zcash shields ordinary public visibility of transaction details; wallet holders and anyone receiving selective disclosure may see more.

## Runtime

The application uses Node.js built-ins only. Keys and demo state are process-local and ephemeral. Restarting the server resets the tender, which is intentional for the hackathon demonstration.
