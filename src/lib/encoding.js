import { createHash } from "node:crypto";

export function stableJson(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
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

export function sha256Hex(domain, value) {
  return createHash("sha256")
    .update(`${domain}\u0000`, "utf8")
    .update(typeof value === "string" ? value : stableJson(value), "utf8")
    .digest("hex");
}

export function assertExactKeys(value, keys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new TypeError(`${label} fields must be exactly: ${expected.join(", ")}`);
  }
}

export function assertString(value, label, pattern, maxLength = 128) {
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength || (pattern && !pattern.test(value))) {
    throw new TypeError(`Invalid ${label}`);
  }
  if (value !== value.normalize("NFC")) throw new TypeError(`${label} must use NFC normalization`);
}

export function assertInteger(value, label, min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new TypeError(`Invalid ${label}`);
}
