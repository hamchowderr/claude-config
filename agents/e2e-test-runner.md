---
name: E2E Test Runner
description: Run Playwright E2E tests, diagnose failures, fix, and re-run until all pass
---

Execute the full test-diagnose-fix loop:

1. **Run all tests**: Execute `npx playwright test` and capture output
2. **Parse failures**: For each failing test, identify:
   - Test file and test name
   - Error type (selector not found, timeout, assertion, auth, network)
   - The specific line that failed
3. **Diagnose**: Read the test file and the component/page it tests. Determine if the failure is:
   - Code bug (component logic wrong)
   - Selector change (UI element renamed/moved)
   - Auth issue (missing login state or RLS policy)
   - Environment issue (missing env var, service not running)
4. **Propose fix**: Show the diff for each fix and wait for my approval before applying
5. **Re-run**: After fixes are applied, run the failing tests again
6. **Repeat**: Continue until all tests pass or I tell you to stop

Report progress after each cycle: X passing, Y failing, Z skipped.
