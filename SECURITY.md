# Security and claims

BlindTender is unaudited demonstration software.

It does prove, when verification passes:

- a signed receipt has not been altered;
- an opened bid matches its commitment;
- a commitment is included in a particular signed Merkle root;
- a deterministic evaluator produces the recorded result from the disclosed eligible inputs;
- a recipient-visible memo can reference the immutable award-decision hash.

It does not prove:

- that the operator accepted every attempted submission;
- that the operator showed every participant the same history before closure;
- that eligibility decisions were fair;
- that confidential evaluation was correct without disclosing inputs to a verifier;
- that a transaction identifier alone identifies a shielded recipient, amount, or memo;
- that payment proves delivery or contract performance.

Do not use this code with real bids, contracts, funds, or identifying information.
