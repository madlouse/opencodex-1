import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const PROJECT_DIR = join(import.meta.dir, "..");
const PATCHES_DIR = join(PROJECT_DIR, "patches");

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
  gray: "\x1b[90m",
};

interface PatchReport {
  id: string;
  status: "APPLIED" | "SKIPPED_NATIVE" | "SKIPPED_ALREADY" | "SKIPPED_INCOMPATIBLE" | "FAILED";
  message: string;
}

async function runPatchManager(action: "status" | "apply") {
  console.log(`\n${C.bold}${C.cyan}📦 OpenCodex Modular Patch Pipeline v1.0${C.reset}`);
  console.log(`${C.gray}--------------------------------------------------${C.reset}`);

  if (!existsSync(PATCHES_DIR)) {
    console.error(`${C.red}❌ Patches directory not found at ${PATCHES_DIR}${C.reset}`);
    process.exit(1);
  }

  const patchDirs = readdirSync(PATCHES_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort();

  const reports: PatchReport[] = [];

  for (let i = 0; i < patchDirs.length; i++) {
    const dirName = patchDirs[i]!;
    const patchPath = join(PATCHES_DIR, dirName);
    const probePath = join(patchPath, "probe.ts");
    const diffPath = join(patchPath, "patch.diff");

    const indexStr = `[${i + 1}/${patchDirs.length}]`;
    const label = dirName.padEnd(32, " ");

    if (!existsSync(probePath)) {
      console.log(` ${C.gray}${indexStr}${C.reset} ${label} ... ${C.yellow}⚠️ NO PROBE${C.reset}`);
      reports.push({ id: dirName, status: "SKIPPED_INCOMPATIBLE", message: "Missing probe.ts" });
      continue;
    }

    try {
      const probeModule = await import(probePath);
      const probeResult = probeModule.inspect(PROJECT_DIR);

      if (probeResult.status === "ALREADY_APPLIED") {
        console.log(` ${C.gray}${indexStr}${C.reset} ${label} ... ${C.cyan}ℹ️ ALREADY ACTIVE${C.reset} ${C.gray}(${probeResult.message})${C.reset}`);
        reports.push({ id: dirName, status: "SKIPPED_ALREADY", message: probeResult.message });
      } else if (probeResult.status === "NATIVE_FIXED") {
        console.log(` ${C.gray}${indexStr}${C.reset} ${label} ... ${C.yellow}🟡 SKIPPED (NATIVE)${C.reset} ${C.gray}(Upstream solved natively)${C.reset}`);
        reports.push({ id: dirName, status: "SKIPPED_NATIVE", message: probeResult.message });
      } else if (probeResult.status === "INCOMPATIBLE") {
        console.log(` ${C.gray}${indexStr}${C.reset} ${label} ... ${C.red}❌ INCOMPATIBLE${C.reset} ${C.gray}(${probeResult.message})${C.reset}`);
        reports.push({ id: dirName, status: "SKIPPED_INCOMPATIBLE", message: probeResult.message });
      } else if (probeResult.status === "APPLY") {
        if (action === "status") {
          console.log(` ${C.gray}${indexStr}${C.reset} ${label} ... ${C.blue}READY TO APPLY${C.reset}`);
          reports.push({ id: dirName, status: "APPLIED", message: "Ready to apply" });
        } else {
          // Action === "apply"
          try {
            execSync(`git apply --whitespace=nowarn "${diffPath}"`, { cwd: PROJECT_DIR, stdio: "pipe" });
            console.log(` ${C.gray}${indexStr}${C.reset} ${label} ... ${C.green}🟢 APPLIED${C.reset}`);
            reports.push({ id: dirName, status: "APPLIED", message: "Successfully applied" });
          } catch (err: any) {
            console.log(` ${C.gray}${indexStr}${C.reset} ${label} ... ${C.red}❌ APPLY FAILED${C.reset}`);
            reports.push({ id: dirName, status: "FAILED", message: err.message || "git apply failed" });
          }
        }
      }
    } catch (err: any) {
      console.log(` ${C.gray}${indexStr}${C.reset} ${label} ... ${C.red}💥 PROBE ERROR${C.reset} ${C.gray}(${err.message})${C.reset}`);
      reports.push({ id: dirName, status: "FAILED", message: err.message });
    }
  }

  console.log(`${C.gray}--------------------------------------------------${C.reset}`);
  const appliedCount = reports.filter(r => r.status === "APPLIED" || r.status === "SKIPPED_ALREADY").length;
  const nativeCount = reports.filter(r => r.status === "SKIPPED_NATIVE").length;
  const failedCount = reports.filter(r => r.status === "FAILED").length;
  const total = reports.length;

  console.log(`${C.bold}📊 Summary:${C.reset} ${C.green}${appliedCount} Active/Applied${C.reset}, ${C.yellow}${nativeCount} Native/Skipped${C.reset}, ${C.red}${failedCount} Failed${C.reset} / Total ${total}`);

  if (action === "apply" && failedCount === 0) {
    console.log(`\n${C.cyan}🧪 Running verification test suite...${C.reset}`);
    try {
      execSync(`bun test tests/codex-routing.test.ts tests/proxy-liveness.test.ts`, { cwd: PROJECT_DIR, stdio: "inherit" });
      console.log(`${C.green}✅ Verification tests passed!${C.reset}`);
    } catch {
      console.error(`${C.red}❌ Verification tests failed! Check git diff before deploying.${C.reset}`);
    }
  }
}

const arg = process.argv[2] ?? "status";
runPatchManager(arg === "apply" || arg === "sync" ? "apply" : "status").catch(console.error);
