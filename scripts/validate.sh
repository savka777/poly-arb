#!/bin/bash
set -e

echo "=== Phase 1: TypeScript ==="
npx tsc --noEmit
echo "  ✓ TypeScript compiles"

echo ""
echo "=== Phase 2-3: Validation Script ==="
USE_MOCK_DATA=true npx tsx src/test/validate.ts

echo ""
echo "=== Phase 5: Build ==="
npm run build
echo "  ✓ Build completed"

echo ""
echo "=== All validations passed ==="
