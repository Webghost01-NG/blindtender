# Demonstration claims

| Claim | Evidence in the repository | Limit |
| --- | --- | --- |
| Bid bytes are canonical | Strict schema and stable serializer tests | Browser/server parity still depends on the browser implementation using the same schema |
| An acknowledged bid cannot be changed unnoticed | Commitment recomputation and signed receipt tests | Does not force the operator to acknowledge an attempted bid |
| The declared accepted set is frozen | Signed closure manifest and Merkle-root tests | Does not prove completeness before closure |
| A supplier can verify inclusion | Per-commitment Merkle proof | Absence is challenge evidence, not automatic enforcement |
| Award is reproducible | Offline audit-package verifier | Requires authorized disclosure of eligible bids |
| Public award metadata omits commercial terms | Signed public award reference contains the event ID, award hash, and winner commitment | The operator receives the full award decision; authorized auditors receive disclosed eligible bids |
| Award and settlement are linked | Award-decision hash in recipient-visible memo | A public transaction ID alone proves neither memo nor recipient |
| Settlement status is honest | Enforced five-state lifecycle | Wallet and node observations remain dependencies |
| Payment details are shielded | Recipient detects a v6 Ironwood regtest transaction with zero transparent inputs and outputs | Local regtest is not public testnet |

## Current Zcash evidence

The isolated Nivyr run produced a real version-6 shielded transaction with two Ironwood actions, zero transparent inputs, zero transparent outputs, two confirmations, recipient detection, an exact 1,000,000-zatoshi amount, and an exact award-reference memo match.

Public-testnet wallets also synchronized successfully through `testnet.zec.rocks`. Public settlement is not yet claimed because the available faucets failed before funding the sender. The application must display that distinction explicitly.
