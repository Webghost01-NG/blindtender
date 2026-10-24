import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { verifyAuditPackage } from "../src/lib/verify.js";

const source = resolve(process.argv[2] ?? ".evidence/demo-award.json");
const auditPackage = JSON.parse(readFileSync(source, "utf8"));
const result = verifyAuditPackage(auditPackage);
console.log(JSON.stringify({ source, ...result }, null, 2));
if (!result.valid) process.exitCode = 1;
