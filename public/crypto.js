const encoder = new TextEncoder();
const bidFields = ["amountMinor", "bidId", "currency", "deliveryDays", "eventId", "schemaVersion", "supplierAlias"];
const idPattern = /^[a-z0-9][a-z0-9-]{2,63}$/;
const saltPattern = /^[a-f0-9]{64}$/;

function stableJson(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw new TypeError("Numbers must be safe integers");
    return String(value);
  }
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  throw new TypeError(`Unsupported canonical value: ${typeof value}`);
}

function assertBid(bid) {
  if (!bid || typeof bid !== "object" || Array.isArray(bid)) throw new TypeError("Bid must be an object");
  const actual = Object.keys(bid).sort();
  const expected = [...bidFields].sort();
  if (actual.length !== expected.length || actual.some((field, index) => field !== expected[index])) {
    throw new TypeError(`Bid fields must be exactly: ${expected.join(", ")}`);
  }
  if (bid.schemaVersion !== "blindtender.bid.v1") throw new TypeError("Unsupported bid schemaVersion");
  if (!idPattern.test(bid.eventId) || !idPattern.test(bid.bidId)) throw new TypeError("Invalid bid or event ID");
  if (typeof bid.supplierAlias !== "string" || !/^[A-Z][A-Za-z0-9 ]{1,31}$/.test(bid.supplierAlias) || bid.supplierAlias !== bid.supplierAlias.normalize("NFC")) {
    throw new TypeError("Invalid supplierAlias");
  }
  if (bid.currency !== "USD") throw new TypeError("currency must be USD");
  if (!Number.isSafeInteger(bid.amountMinor) || bid.amountMinor < 1 || bid.amountMinor > 100_000_000_000) throw new TypeError("Invalid amountMinor");
  if (!Number.isSafeInteger(bid.deliveryDays) || bid.deliveryDays < 1 || bid.deliveryDays > 365) throw new TypeError("Invalid deliveryDays");
  return stableJson(bid);
}

function hexToBytes(hex) {
  if (!/^[a-f0-9]+$/i.test(hex) || hex.length % 2 !== 0) throw new TypeError("Invalid hex value");
  return Uint8Array.from(hex.match(/.{2}/g), (byte) => Number.parseInt(byte, 16));
}

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function pemToBytes(pem) {
  const base64 = pem.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\s/g, "");
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function commitBid(bid, salt = null) {
  const canonical = assertBid(bid);
  const secret = salt ?? bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
  if (!saltPattern.test(secret)) throw new TypeError("Salt must be 32 random bytes encoded as lowercase hex");
  const payload = encoder.encode(`blindtender:bid-commitment:v1\u0000${canonical}\u0000${secret}`);
  const digest = await crypto.subtle.digest("SHA-256", payload);
  return { commitment: bytesToHex(new Uint8Array(digest)), salt: secret };
}

export async function sealBidForOperator(bid, salt, publicKeyPem) {
  assertBid(bid);
  if (!saltPattern.test(salt)) throw new TypeError("Salt must be 32 random bytes encoded as lowercase hex");
  const publicKey = await crypto.subtle.importKey(
    "spki",
    pemToBytes(publicKeyPem),
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"],
  );
  const aesKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = encoder.encode(stableJson({ bid, salt }));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode("blindtender:sealed-bid:v1"), tagLength: 128 },
    aesKey,
    plaintext,
  );
  const rawKey = await crypto.subtle.exportKey("raw", aesKey);
  const wrappedKey = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, publicKey, rawKey);
  const combined = new Uint8Array(ciphertext);
  const tag = combined.slice(-16);
  const encryptedBody = combined.slice(0, -16);
  return {
    algorithm: "RSA-OAEP-256+A256GCM",
    ciphertext: bytesToBase64Url(encryptedBody),
    iv: bytesToBase64Url(iv),
    tag: bytesToBase64Url(tag),
    wrappedKey: bytesToBase64Url(new Uint8Array(wrappedKey)),
  };
}

export function canonicalBidBytes(bid) {
  return encoder.encode(assertBid(bid));
}
