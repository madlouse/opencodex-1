#!/usr/bin/env bash
# ==============================================================================
# OpenCodex Upstream Merge & Modular Patch Pipeline Tool
# Usage: ./scripts/merge-upstream.sh [target_branch_or_tag]
# Default target: upstream/main
# ==============================================================================

set -e

TARGET="${1:-upstream/main}"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

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
    echo "⚠️ Conflict detected during merge. Re-evaluating modular patch suite..."
    git merge --abort || true
    echo "🩹 Running modular patch probe manager..."
fi

# Run the self-healing modular patch manager
bun run "$PROJECT_DIR/scripts/patch-manager.ts" apply

echo "🚀 Restarting opencodex service with updated build..."
bun run src/cli/index.ts restart

echo "🎉 Upstream merge & modular patch pipeline completed successfully!"
