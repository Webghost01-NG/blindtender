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

## Zcash preflight

The preflight uses the digest-pinned `zcash-devtool` container and stores wallet material only under ignored `.runtime/`. It initializes two testnet wallets, derives their Unified Addresses, and prints the next funding step without exposing mnemonic material.

```bash
npm run zcash:preflight -- init
```

After the sender has testnet funds, the same script will sync, send a shielded payment with an award reference in its encrypted memo, and save reproducible evidence. Public-testnet success must not be claimed until that run completes.

## Security posture

This is demonstration software, not a procurement, custody, escrow, or payment product. See [SECURITY.md](./SECURITY.md) and [docs/architecture.md](./docs/architecture.md).
