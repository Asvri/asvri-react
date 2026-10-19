// Builds dist/esm (import) and dist/cjs (require) from src with TypeScript; each folder gets a package.json saying
// which module type its .js files are.
import { execFileSync } from "node:child_process"
import { mkdirSync, rmSync, writeFileSync } from "node:fs"

const tsc = (args) => execFileSync(process.execPath, ["node_modules/typescript/bin/tsc", ...args], { stdio: "inherit" })
rmSync("dist", { recursive: true, force: true })
tsc(["-p", "tsconfig.json"])
tsc(["-p", "tsconfig.json", "--module", "CommonJS", "--moduleResolution", "Node10", "--outDir", "dist/cjs"])
for (const [dir, type] of [["dist/esm", "module"], ["dist/cjs", "commonjs"]]) {
  mkdirSync(dir, { recursive: true })
  writeFileSync(`${dir}/package.json`, JSON.stringify({ type }) + "\n")
}
console.log("built dist/esm and dist/cjs")
