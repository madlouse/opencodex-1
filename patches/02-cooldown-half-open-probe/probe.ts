import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export type ProbeResult = 
  | { status: "APPLY"; message: "Compatible with upstream, ready to apply" }
  | { status: "ALREADY_APPLIED"; message: "Patch is already active in target file" }
  | { status: "NATIVE_FIXED"; message: "Upstream natively implements cooldown probe" }
  | { status: "INCOMPATIBLE"; message: "routing.ts structure has changed significantly" };

export function inspect(projectDir: string): ProbeResult {
  const filePath = join(projectDir, "src", "codex", "routing.ts");
  if (!existsSync(filePath)) {
    return { status: "INCOMPATIBLE", message: "routing.ts not found" };
  }

  const content = readFileSync(filePath, "utf8");

  if (content.includes("COOLDOWN_PROBE_ELAPSED_RATIO") && content.includes("cooldownProbeTimestamps")) {
    return { status: "ALREADY_APPLIED", message: "Patch is already active in target file" };
  }

  if (content.includes("halfOpen") || content.includes("cooldownProbe")) {
    return { status: "NATIVE_FIXED", message: "Upstream natively implements cooldown probe" };
  }

  if (content.includes("isCodexAccountInCooldown") && content.includes("getCodexAccountCooldownUntil")) {
    return { status: "APPLY", message: "Compatible with upstream, ready to apply" };
  }

  return { status: "INCOMPATIBLE", message: "routing.ts structure unrecognised" };
}
