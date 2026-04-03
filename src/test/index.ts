import basic from './basic';
import transactions from './transactions';
import relations from './relations';
import filters from './filters';
import bulk from './bulk';
import query_scan from './query_scan';
import contracts from './contracts';

(async function () {
  try {
    let total_failures = 0;
    total_failures += await basic();
    total_failures += await transactions();
    total_failures += await relations();
    total_failures += await filters();
    total_failures += await bulk();
    total_failures += await query_scan();
    total_failures += await contracts();

    console.log(`\n${'='.repeat(40)}`);
    console.log(total_failures === 0
      ? `  ALL TESTS PASSED`
      : `  ${total_failures} TOTAL FAILURES`
    );
    console.log('='.repeat(40));
    process.exit(total_failures > 0 ? 1 : 0);
  } catch (error: any) {
    console.error('\nFatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
})();
