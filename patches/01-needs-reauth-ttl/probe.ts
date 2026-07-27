import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export type ProbeResult = 
  | { status: "APPLY"; message: "Compatible with upstream, ready to apply" }
  | { status: "ALREADY_APPLIED"; message: "Patch is already active in target file" }
  | { status: "NATIVE_FIXED"; message: "Upstream natively implements elastic reauth probe TTL" }
  | { status: "INCOMPATIBLE"; message: "Target file structure has changed significantly" };

export function inspect(projectDir: string): ProbeResult {
  const filePath = join(projectDir, "src", "codex", "account-runtime-state.ts");
  if (!existsSync(filePath)) {
    return { status: "INCOMPATIBLE", message: "account-runtime-state.ts not found" };
  }

  const content = readFileSync(filePath, "utf8");

  // Check if our custom function or similar TTL logic is already applied
  if (content.includes("isAccountInReauthProbe") && content.includes("REAUTH_PROBE_INITIAL_MS")) {
    return { status: "ALREADY_APPLIED", message: "Patch is already active in target file" };
  }

  // Check if upstream built their own native TTL / elastic recovery mechanism
  if (content.includes("nextProbeAt") || (content.includes("backoff") && content.includes("probe"))) {
    return { status: "NATIVE_FIXED", message: "Upstream natively implements elastic reauth probe TTL" };
  }

  // Check baseline compatibility: must contain standard markAccountNeedsReauth
  if (content.includes("markAccountNeedsReauth")) {
    return { status: "APPLY", message: "Compatible with upstream, ready to apply" };
  }

  return { status: "INCOMPATIBLE", message: "account-runtime-state.ts structure unrecognised" };
}
