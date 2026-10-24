# Privacy and visibility model

| Actor | Can see | Cannot infer from BlindTender alone |
| --- | --- | --- |
| Public observer | Event ID, rules hash, signed closure root, signed winner commitment and award hash, public settlement state and transaction ID | Bid prices, eligible bid list, supplier identities, shielded recipient, amount, or memo |
| Competing supplier | Its own bid, salt, receipt, inclusion proof, and permitted event outcome | Other suppliers' bid contents or settlement details |
| Operator and buyer | Every opened bid, receipt order, eligibility inputs, award calculation, and payer-wallet settlement evidence | Whether goods or services were delivered |
| Authorized auditor | Only the confidential verification package deliberately provided for a dispute | Undisclosed application metadata or unrelated wallet history |
| Winning supplier | Its own award evidence plus recipient-visible amount and encrypted memo | Other suppliers' losing terms |
| Ordinary chain observer | A transaction exists and any information exposed by transparent components | Shielded recipient, shielded output amount, or encrypted memo contents |

## Metadata limits

Bid encryption does not hide IP addresses, request timing, browser identifiers, access logs, or operator-side storage metadata. The MVP binds application evidence and shielded settlement; it does not provide network anonymity. A production service would require a separate metadata-minimization and retention design.

## Operator trust

The operator decrypts bids at closure and controls eligibility decisions. Signed receipts and the signed closure root make acknowledged modification and declared-set rewriting detectable. They do not prevent the operator from refusing a bid before acknowledgment or colluding before closure.

## Disclosure language

- **Proof:** a cryptographic verification performed from supplied inputs.
- **Signed attestation:** a statement attributable to the operator key.
- **Evidence:** material that can support a dispute but may require human or contractual enforcement.
- **Trusted action:** an operation BlindTender records but cannot independently prove, such as eligibility review or delivery.
