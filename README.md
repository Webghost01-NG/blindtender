# BlindTender

BlindTender is a hackathon proof of a tamper-evident evidence chain for confidential procurement:

`published rules → signed receipt → frozen accepted set → reproducible award → shielded settlement reference`

The MVP deliberately trusts the operator to decrypt and evaluate bids. Its contribution is narrower: suppliers retain signed evidence, the operator's accepted set becomes immutable at closure, the award is deterministic, and the winning award can be bound to an encrypted Zcash memo.

## Run locally

Requirements: Node.js 20 or newer.

```bash
npm test
npm start
```

Open `http://127.0.0.1:4173`.

## Walk through the demo

- As **Buyer**, load the three labeled synthetic bids. Prices stay hidden in the receipt list.
- Move to **Closure**, then close and sign the accepted set. The omission challenge disclosure can leave one acknowledged demo bid out on purpose.
- In **Award**, inspect the signed public reference, run the tamper and inclusion checks, or download a restricted audit package.
- Switch to **Auditor** and select that package to recompute the award. The package contains confidential bid terms; share it only with an authorized reviewer.
- Switch to **Supplier** to submit a separate offer. The browser downloads a private receipt bundle containing the bid and salt.
- The **Payment** stage shows the award memo reference and the real testnet CLI steps. The local regtest proof demonstrates the shielded flow, but it is not public-testnet settlement.

Use **Rules → Reset this local demo** inside the page to clear only the server's in-memory tender state and rotate its demo keys. It leaves wallet data and any Zcash network untouched.

## Zcash preflight

The preflight uses the digest-pinned `zcash-devtool` container and stores wallet material only under ignored `.runtime/`. It initializes two testnet wallets, derives their Unified Addresses, and prints the next funding step without exposing mnemonic material.

```bash
npm run zcash:preflight -- init
```

After the sender has testnet funds, the same script will sync, send a shielded payment with an award reference in its encrypted memo, and save reproducible evidence. Public-testnet success must not be claimed until that run completes.

## Security posture

This is demonstration software, not a procurement, custody, escrow, or payment product. See [SECURITY.md](./SECURITY.md) and [docs/architecture.md](./docs/architecture.md).
