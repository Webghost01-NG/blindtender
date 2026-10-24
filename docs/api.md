# Local demo API

The server binds to loopback by default and keeps its operator keys and tender state in memory. Restarting it creates a fresh event.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/state` | Current phase, signed public artifacts, and settlement state |
| `GET` | `/api/event-keys` | Browser encryption key, operator verification key, and rules hash |
| `GET` | `/api/public-evidence` | Bid-safe rules, closure, award, and settlement references |
| `POST` | `/api/bids` | Submit an encrypted envelope and receive a signed acknowledgment |
| `POST` | `/api/close` | Open, verify, freeze, and deterministically award the tender |
| `GET` | `/api/evidence/:bidId` | Supplier receipt and post-close inclusion proof |
| `GET` | `/api/challenges/omission/:bidId` | Report whether a receipt is absent from the accepted set |
| `POST` | `/api/challenges/tamper` | Compare an opened bid against its commitment |
| `POST` | `/api/verify-audit-package` | Verify a restricted package supplied by an authorized auditor |
| `POST` | `/api/settlement` | Append the next signed settlement lifecycle state |
| `POST` | `/api/reset` | Reset disposable in-memory demo state |

Mutation requests require `Content-Type: application/json`. Errors have a stable `code` and a human-readable `error`. The audit-package verifier returns only verification results; there is no public GET route that returns confidential eligible bids.

## Browser submission

`public/crypto.js` exports `commitBid` and `sealBidForOperator`. It produces the same SHA-256 commitment format as the server, encrypts canonical bid material with AES-256-GCM, and wraps the AES key with the event RSA-OAEP public key. A supplier should retain the salt and signed receipt privately.

`public/receipt.js` builds a private receipt bundle containing the original bid, salt, commitment, signed acknowledgment, and rules hash. The bundle is intended for the supplier to download and keep. It should not be uploaded to the public evidence endpoint because it reveals confidential bid terms.
