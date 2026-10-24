import {
  createCipheriv,
  createDecipheriv,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  privateDecrypt,
  publicEncrypt,
  randomBytes,
  sign,
  verify,
} from "node:crypto";
import { canonicalBid, validateSalt } from "./schema.js";
import { sha256Hex, stableJson } from "./encoding.js";

export function createOperatorKeys() {
  const signing = generateKeyPairSync("ed25519");
  const encryption = generateKeyPairSync("rsa", { modulusLength: 2048, publicExponent: 0x10001 });
  return {
    signingPrivateKey: signing.privateKey.export({ type: "pkcs8", format: "pem" }),
    signingPublicKey: signing.publicKey.export({ type: "spki", format: "pem" }),
    encryptionPrivateKey: encryption.privateKey.export({ type: "pkcs8", format: "pem" }),
    encryptionPublicKey: encryption.publicKey.export({ type: "spki", format: "pem" }),
  };
}

export function bidCommitment(bid, saltHex) {
  validateSalt(saltHex);
  return sha256Hex("blindtender:bid-commitment:v1", `${canonicalBid(bid)}\u0000${saltHex}`);
}

export function signObject(domain, payload, privateKeyPem) {
  const bytes = Buffer.from(`${domain}\u0000${stableJson(payload)}`, "utf8");
  return sign(null, bytes, createPrivateKey(privateKeyPem)).toString("base64url");
}

export function verifyObject(domain, payload, signature, publicKeyPem) {
  const bytes = Buffer.from(`${domain}\u0000${stableJson(payload)}`, "utf8");
  return verify(null, bytes, createPublicKey(publicKeyPem), Buffer.from(signature, "base64url"));
}

export function encryptBidForOperator(bid, saltHex, publicKeyPem) {
  const key = randomBytes(32);
  const iv = randomBytes(12);
  const plaintext = Buffer.from(stableJson({ bid, salt: saltHex }), "utf8");
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from("blindtender:sealed-bid:v1", "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  const wrappedKey = publicEncrypt({ key: publicKeyPem, oaepHash: "sha256" }, key);
  return {
    algorithm: "RSA-OAEP-256+A256GCM",
    ciphertext: ciphertext.toString("base64url"),
    iv: iv.toString("base64url"),
    tag: tag.toString("base64url"),
    wrappedKey: wrappedKey.toString("base64url"),
  };
}

export function decryptBidEnvelope(envelope, privateKeyPem) {
  const expected = ["algorithm", "ciphertext", "iv", "tag", "wrappedKey"];
  if (!envelope || Object.keys(envelope).sort().join(",") !== expected.sort().join(",")) throw new TypeError("Invalid envelope fields");
  if (envelope.algorithm !== "RSA-OAEP-256+A256GCM") throw new TypeError("Unsupported envelope algorithm");
  const key = privateDecrypt({ key: privateKeyPem, oaepHash: "sha256" }, Buffer.from(envelope.wrappedKey, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "base64url"));
  decipher.setAAD(Buffer.from("blindtender:sealed-bid:v1", "utf8"));
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64url"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, "base64url")), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8"));
}
