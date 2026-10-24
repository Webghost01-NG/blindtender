# Zcash settlement runbook

## Public-testnet preflight

```bash
npm run zcash:preflight -- init
```

This creates two encrypted testnet wallets under ignored `.runtime/testnet/`, synchronizes the sender through `testnet.zec.rocks`, and writes non-secret status evidence under ignored `.evidence/`.

Fund only the printed sender address with TAZ. Never paste an age identity, mnemonic, viewing key, or spending key into a faucet or issue report.

After funding and confirmation:

```bash
npm run zcash:preflight -- send <award-decision-hash>
npm run zcash:preflight -- verify
```

Acceptance requires a real transaction ID, mined recipient transaction, recipient detection, and exact memo match. Broadcast alone is not success.

## Local shielded proof

The local proof is useful while public funding is unavailable:

```bash
node /home/web-ghost/nivyr/dist/src/cli/index.js up
npm run demo:award
npm run zcash:regtest -- <award-decision-hash>
```

This uses an isolated Nivyr runtime inside `.nivyr/`. It does not modify the Nivyr repository or any other Compose project. The output must remain labeled `regtest` and must never be submitted as public-testnet evidence.

## Cleanup

Stop only BlindTender's isolated runtime:

```bash
node /home/web-ghost/nivyr/dist/src/cli/index.js down
```

Do not remove `.runtime/`, `.nivyr/`, or `.evidence/` while a transaction is pending or before evidence has been copied to the intended private archive.

## Observed public-funding issue

On October 24, 2026, Valar accepted claims for the fresh Unified, transparent, and Sapling receivers but failed each claim before payout with `the wallet cannot pay this address`. Jino Labs reported drips paused for the NU7 upgrade. These observations explain the current release gate; they are not evidence that either service will remain unavailable.
