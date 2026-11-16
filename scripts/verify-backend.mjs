import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseline = JSON.parse(fs.readFileSync(path.join(root, "docs/backend-integrity.json"), "utf8"));
const portable = process.argv.includes("--portable");
let mismatches = 0;
for (const entry of baseline.files) {
  const file = path.join(root, entry.Path);
  const bytes = fs.existsSync(file) ? fs.readFileSync(file) : null;
  const actual = bytes ? crypto.createHash("sha256").update(portable ? bytes.toString("utf8").replace(/\r\n/g, "\n") : bytes).digest("hex").toUpperCase() : "MISSING";
  if (actual !== (portable ? entry.CanonicalSha256 : entry.Sha256)) { console.error("CHANGED: " + entry.Path); mismatches++; }
}
if (mismatches) process.exitCode = 1;
else console.log("PASS: all " + baseline.files.length + " teammate backend SHA-256 hashes match" + (portable ? " (line endings normalized for CI)." : " (exact bytes)."));
