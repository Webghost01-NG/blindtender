# Contributing

BlindTender is a narrowly scoped hackathon demonstration. Keep changes aligned with its evidence-chain thesis and explicit trust model.

## Local checks

```bash
npm test
npm run check
```

For UI changes, verify the complete workflow at 1440px and 390px widths, keyboard navigation, visible focus, reduced motion, and browser console/network errors.

## Change rules

- Use integer minor units for money; never floating point.
- Keep canonical schemas exact and update pinned vectors intentionally.
- Domain-separate every hash and signature.
- Never expose confidential audit packages from unauthenticated routes.
- Preserve the distinction between public testnet and local regtest evidence.
- Never claim broadcast as recipient detection.
- Do not add production custody, escrow, compliance, or delivery claims.
- Add tests for new cryptographic fields, state transitions, and failure paths.

## Commits and pull requests

Use focused imperative commits. Pull requests should explain intent, tests, privacy impact, trust-model impact, screenshots for UI changes, and remaining risks. Do not include `.runtime/`, `.nivyr/`, `.evidence/`, mnemonic material, wallet identities, or real procurement data.
