import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export type ProbeResult = 
  | { status: "APPLY"; message: "Compatible with upstream, ready to apply" }
  | { status: "ALREADY_APPLIED"; message: "Patch is already active in target file" }
  | { status: "NATIVE_FIXED"; message: "Upstream natively implements OCX_SERVICE exit 0 protection" }
  | { status: "INCOMPATIBLE"; message: "cli/index.ts structure has changed significantly" };

export function inspect(projectDir: string): ProbeResult {
  const filePath = join(projectDir, "src", "cli", "index.ts");
  if (!existsSync(filePath)) {
    return { status: "INCOMPATIBLE", message: "cli/index.ts not found" };
  }

  const content = readFileSync(filePath, "utf8");

  if (content.includes("process.env.OCX_SERVICE") && content.includes("Service exiting cleanly.")) {
    return { status: "ALREADY_APPLIED", message: "Patch is already active in target file" };
  }

  if (content.includes("OCX_SERVICE") && (content.includes("process.exit(0)") || content.includes("already running"))) {
    return { status: "NATIVE_FIXED", message: "Upstream natively implements OCX_SERVICE exit 0 protection" };
  }

  if (content.includes("handleStart") && content.includes("findLiveProxy")) {
    return { status: "APPLY", message: "Compatible with upstream, ready to apply" };
  }

  return { status: "INCOMPATIBLE", message: "cli/index.ts structure unrecognised" };
}
