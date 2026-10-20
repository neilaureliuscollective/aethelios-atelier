import { spawnSync } from "node:child_process";
import path from "node:path";

const source = process.argv[2] ?? path.resolve("public/brand/original/logo.png");
const script = path.resolve("scripts/prepare-full-logo.py");
const result = spawnSync("python3", [script, source], { stdio: "inherit" });
process.exit(result.status ?? 1);
