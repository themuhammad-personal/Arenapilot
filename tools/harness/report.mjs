/** A skipped scenario is neither a pass nor a way to hide a recorded failure. */
export function scenarioResult(name, outcome, ms = 0) {
  const failures = outcome.failures || [];
  const skipped = !!outcome.skipped && failures.length === 0;
  return { name, pass: !skipped && failures.length === 0, skipped, failures, notes: outcome.notes || [], ms };
}

export function totals(results) {
  return {
    passed: results.filter((r) => r.pass && !r.skipped).length,
    skipped: results.filter((r) => r.skipped).length,
    failed: results.filter((r) => !r.pass && !r.skipped).length,
  };
}
