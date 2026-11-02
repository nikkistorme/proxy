// Writes the performance check's fixtures (8d, #171): tests/fixtures/bundles/stress.json,
// the stress table, and tests/fixtures/csv/two-hundred-rows.csv.
// Run with `npm run perf:fixture`. Vite loads the TypeScript builder, so no extra runner is needed.
import { writeFile } from 'node:fs/promises';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { makeStressBundle, makeTwoHundredRows } = await server.ssrLoadModule('/src/demo/stressBundle.ts');
  const { bundleToText } = await server.ssrLoadModule('/src/model/bundle.ts');
  await writeFile('tests/fixtures/bundles/stress.json', bundleToText(makeStressBundle()));
  await writeFile('tests/fixtures/csv/two-hundred-rows.csv', makeTwoHundredRows());
  console.log('Wrote tests/fixtures/bundles/stress.json and tests/fixtures/csv/two-hundred-rows.csv');
} finally {
  await server.close();
}
