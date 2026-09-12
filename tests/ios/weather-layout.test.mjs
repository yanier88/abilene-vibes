// First generate and open weather-layout-harness.mjs output in a browser.
// The local harness server writes results.json; never use simulated data in the app.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
const report = JSON.parse(fs.readFileSync(process.env.WEATHER_LAYOUT_RESULTS ?? path.join(os.tmpdir(), 'abilene-weather-layout', 'results.json'), 'utf8'));
for (const width of [440, 390]) for (const temp of [99, 100, 105, 110, 0, -5]) {
  test(`Weather layout ${width}px ${temp}° (browser evidence)`, () => {
    for (const file of ['src/App.jsx', 'src/App.css', 'src/index.css']) {
      const current = createHash('sha256').update(fs.readFileSync(new URL(`../../${file}`, import.meta.url))).digest('hex');
      assert.equal(report.sourceHashes[file], current, 'Regenerate and rerun browser harness: source changed');
    }
    const matches = report.cases.filter(row => row.width === width && row.temp === `${temp}°`);
    assert.equal(matches.length, 1);
    assert.equal(matches[0].pass, true, JSON.stringify(matches[0].checks));
    assert.ok(Object.values(matches[0].checks).every(Boolean));
  });
}
