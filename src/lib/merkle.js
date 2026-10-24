import { createHash } from "node:crypto";

function hashLeaf(commitment) {
  return createHash("sha256").update("blindtender:merkle-leaf:v1\u0000").update(Buffer.from(commitment, "hex")).digest("hex");
}

function hashNode(left, right) {
  return createHash("sha256").update("blindtender:merkle-node:v1\u0000").update(Buffer.from(left, "hex")).update(Buffer.from(right, "hex")).digest("hex");
}

export function buildMerkleTree(commitments) {
  if (!Array.isArray(commitments) || commitments.length === 0) throw new TypeError("At least one commitment is required");
  const sorted = [...commitments].sort();
  if (new Set(sorted).size !== sorted.length) throw new TypeError("Duplicate commitments are not allowed");
  const levels = [sorted.map(hashLeaf)];
  while (levels.at(-1).length > 1) {
    const current = levels.at(-1);
    const next = [];
    for (let index = 0; index < current.length; index += 2) {
      next.push(hashNode(current[index], current[index + 1] ?? current[index]));
    }
    levels.push(next);
  }
  const proofs = new Map();
  sorted.forEach((commitment, leafIndex) => {
    let index = leafIndex;
    const path = [];
    for (let level = 0; level < levels.length - 1; level += 1) {
      const nodes = levels[level];
      const siblingIndex = index ^ 1;
      path.push({
        hash: nodes[siblingIndex] ?? nodes[index],
        position: siblingIndex < index ? "left" : "right",
      });
      index = Math.floor(index / 2);
    }
    proofs.set(commitment, path);
  });
  return { root: levels.at(-1)[0], sortedCommitments: sorted, proofs };
}

export function verifyMerkleProof(commitment, proof, root) {
  let hash = hashLeaf(commitment);
  for (const step of proof) {
    hash = step.position === "left" ? hashNode(step.hash, hash) : hashNode(hash, step.hash);
  }
  return hash === root;
}
