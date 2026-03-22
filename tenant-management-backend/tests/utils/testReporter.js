/**
 * Test summary and reporting utilities
 */

/**
 * Generate a test execution summary
 */
export function generateTestSummary(results) {
  const summary = {
    timestamp: new Date().toISOString(),
    totalSuites: results.numTotalTestSuites,
    passedSuites: results.numPassedTestSuites,
    failedSuites: results.numFailedTestSuites,
    totalTests: results.numTotalTests,
    passedTests: results.numPassedTests,
    failedTests: results.numFailedTests,
    skippedTests: results.numPendingTests,
    duration: `${(results.testResults[0]?.perfStats?.runtime || 0) / 1000}s`,
    success: results.success,
  };
  
  return summary;
}

/**
 * Print test summary to console
 */
export function printTestSummary(summary) {
  console.log('\n' + '='.repeat(70));
  console.log('TEST EXECUTION SUMMARY');
  console.log('='.repeat(70));
  console.log(`Timestamp:      ${summary.timestamp}`);
  console.log(`Total Suites:   ${summary.totalSuites}`);
  console.log(`Passed Suites:  ${summary.passedSuites}`);
  console.log(`Failed Suites:  ${summary.failedSuites}`);
  console.log(`Total Tests:    ${summary.totalTests}`);
  console.log(`Passed Tests:   ${summary.passedTests}`);
  console.log(`Failed Tests:   ${summary.failedTests}`);
  console.log(`Skipped Tests:  ${summary.skippedTests}`);
  console.log(`Duration:       ${summary.duration}`);
  console.log(`Status:         ${summary.success ? '✓ PASSED' : '✗ FAILED'}`);
  console.log('='.repeat(70) + '\n');
}
