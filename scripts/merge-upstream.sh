#!/usr/bin/env bash
# ==============================================================================
# OpenCodex Upstream Merge & Patch Application Tool
# Usage: ./scripts/merge-upstream.sh [target_branch_or_tag]
# Default target: upstream/main
# ==============================================================================

set -e

TARGET="${1:-upstream/main}"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PATCH_FILE="$PROJECT_DIR/patches/0001-opencodex-stability-fix.patch"

echo "🔄 Fetching latest updates from official upstream repository..."
cd "$PROJECT_DIR"
git fetch upstream

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
echo "📌 Current branch: $CURRENT_BRANCH"
echo "🎯 Merging upstream target: $TARGET"

# Attempt standard git merge
if git merge "$TARGET" -m "merge: sync with upstream $TARGET"; then
    echo "✅ Successfully merged $TARGET!"
else
    echo "⚠️ Conflict detected during merge. Attempting patch-reapply recovery..."
    git merge --abort || true
    echo "🩹 Re-applying stability patch onto $TARGET..."
    git checkout "$TARGET" -b "temp/merge-$(date +%s)"
    git apply "$PATCH_FILE"
    git commit -am "fix(stability): re-apply custom stability patch"
    git branch -M "$CURRENT_BRANCH"
    echo "✅ Merge and patch re-application complete!"
fi

echo "🧪 Running verification tests..."
bun test tests/codex-routing.test.ts tests/proxy-liveness.test.ts tests/cli-restart-health.test.ts

echo "🚀 Restarting opencodex service with updated build..."
bun run src/cli/index.ts service install

echo "🎉 Upstream merge completed successfully!"
