import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { lintSource } from '../../scripts/lint.js';

describe('lintSource', () => {
  it('detects line formatting errors: trailing whitespace, tabs, line length, leftovers, and missing newline', () => {
    const todoMarker = ['TO', 'DO'].join('');
    assert.deepEqual(
      lintSource('src/sample.js', 'const a = 1;  \n'),
      ['src/sample.js:1: trailing whitespace'],
    );
    assert.deepEqual(
      lintSource('src/sample.js', 'const\ta = 1;\n'),
      ['src/sample.js:1: tab character'],
    );
    assert.deepEqual(
      lintSource('src/sample.js', `const a = '${'x'.repeat(160)}';\n`),
      ['src/sample.js:1: line is longer than 170 characters'],
    );
    assert.deepEqual(
      lintSource('src/sample.js', `// ${todoMarker}: implement later\n`),
      ['src/sample.js:1: leftover work marker'],
    );
    assert.deepEqual(
      lintSource('src/sample.js', 'const a = 1;'),
      ['src/sample.js:1: missing final newline'],
    );
  });

  it('exempts files in src/planner/data/ from the line length limit', () => {
    const wideContent = `const record = '${'x'.repeat(180)}';\n`;
    assert.deepEqual(lintSource('src/planner/data/wedding.js', wideContent), []);
  });

  it('detects syntax and code rules: loose equality, var, console, and debugger', () => {
    assert.deepEqual(
      lintSource('src/sample.js', 'if (a == b) {}\n'),
      ['src/sample.js:1: use strict equality'],
    );
    assert.deepEqual(
      lintSource('src/sample.js', 'if (a != b) {}\n'),
      ['src/sample.js:1: use strict equality'],
    );
    assert.deepEqual(
      lintSource('src/sample.js', 'var count = 1;\n'),
      ['src/sample.js:1: use const or let instead of var'],
    );
    assert.deepEqual(
      lintSource('src/sample.js', 'console.log(count);\n'),
      ['src/sample.js:1: no console output in application code'],
    );
    assert.deepEqual(
      lintSource('src/sample.js', 'debugger;\n'),
      ['src/sample.js:1: debugger statement'],
    );
  });

  it('allows console output in tests/ and scripts/', () => {
    const consoleSource = 'console.log(1);\n';
    assert.deepEqual(lintSource('tests/sample.test.js', consoleSource), []);
    assert.deepEqual(lintSource('scripts/sample.js', consoleSource), []);
  });

  it('detects unused imports but allows imports used in code or template expressions', () => {
    assert.deepEqual(
      lintSource('src/sample.js', "import { unused } from './dep.js';\nconst a = 1;\n"),
      ['src/sample.js:1: unused import unused'],
    );
    assert.deepEqual(
      lintSource('src/sample.js', "import { used } from './dep.js';\nused();\n"),
      [],
    );
    assert.deepEqual(
      lintSource('src/sample.js', "import { label } from './dep.js';\nconst text = `${label}`;\n"),
      [],
    );
  });

  it('validates project exports: flags unused exports but allows consumed or same-file used exports', () => {
    const fileA = 'src/a.js';
    const lonelySource = 'export function lonely() {}\n';
    const projectWithLonely = [
      { file: fileA, source: lonelySource },
      { file: 'src/b.js', source: 'const x = 1;\n' },
    ];
    assert.deepEqual(
      lintSource(fileA, lonelySource, projectWithLonely),
      ['src/a.js:1: export lonely is not used by any application module'],
    );

    const sameFileSource = 'export function helper() {}\nhelper();\n';
    assert.deepEqual(
      lintSource(fileA, sameFileSource, [{ file: fileA, source: sameFileSource }]),
      [],
    );

    const sharedSource = 'export function shared() {}\n';
    const consumerSource = "import { shared } from './a.js';\nshared();\n";
    const projectWithConsumer = [
      { file: fileA, source: sharedSource },
      { file: 'src/b.js', source: consumerSource },
    ];
    assert.deepEqual(lintSource(fileA, sharedSource, projectWithConsumer), []);

    // Exports in test files are exempt
    const testExportSource = 'export function testHelper() {}\n';
    assert.deepEqual(
      lintSource('tests/helper.js', testExportSource, [{ file: 'tests/helper.js', source: testExportSource }]),
      [],
    );

    // When project is omitted, export validation is skipped
    assert.deepEqual(lintSource(fileA, lonelySource), []);
  });

  it('respects lint-skip-code-rules to skip code, import, and export checks while keeping line checks', () => {
    const skippedWithBadCode = '// lint-skip-code-rules: reasons\nvar x == 1;\n';
    assert.deepEqual(lintSource('src/sample.js', skippedWithBadCode), []);

    const skippedWithTrailingSpace = '// lint-skip-code-rules: reasons\nconst a = 1;  \n';
    assert.deepEqual(
      lintSource('src/sample.js', skippedWithTrailingSpace),
      ['src/sample.js:2: trailing whitespace'],
    );
  });

  it('permits functions with up to five parameters and handles destructuring, defaults, and rest parameters', () => {
    assert.deepEqual(lintSource('src/sample.js', 'function ok(a, b, c, d, e) {}\nok();\n'), []);
    assert.deepEqual(lintSource('src/sample.js', 'const ok = (a, b, c, d, e) => a + b;\nok();\n'), []);
    assert.deepEqual(lintSource('src/sample.js', 'function destruct({ a, b, c, d, e, f, g }) {}\ndestruct();\n'), []);
    assert.deepEqual(lintSource('src/sample.js', 'const fn = (a = [1, 2, 3], b = { x: 1, y: 2 }, c = calc(1, 2)) => a;\nfn();\n'), []);
    assert.deepEqual(lintSource('src/sample.js', 'function rest(a, b, c, d, ...others) {}\nrest();\n'), []);
    assert.deepEqual(lintSource('src/sample.js', 'call(1, 2, 3, 4, 5, 6);\n'), []);
  });

  it('flags functions with more than five parameters in ordinary, arrow, multi-line, and nested functions', () => {
    assert.deepEqual(
      lintSource('src/sample.js', 'function tooMany(a, b, c, d, e, f) {}\ntooMany();\n'),
      ['src/sample.js:1: function has 6 parameters (maximum is 5)'],
    );
    assert.deepEqual(
      lintSource('src/sample.js', 'const bad = (a, b, c, d, e, f) => a + b;\nbad();\n'),
      ['src/sample.js:1: function has 6 parameters (maximum is 5)'],
    );
    const nested = 'function outer(a, b, c) {\n  const inner = (d, e, f, g, h, i) => d + e;\n  return inner();\n}\nouter();\n';
    assert.deepEqual(
      lintSource('src/sample.js', nested),
      ['src/sample.js:2: function has 6 parameters (maximum is 5)'],
    );
    const multiLine = 'function multi(\n  a,\n  b,\n  c,\n  d,\n  e,\n  f,\n) {}\nmulti();\n';
    assert.deepEqual(
      lintSource('src/sample.js', multiLine),
      ['src/sample.js:1: function has 6 parameters (maximum is 5)'],
    );
    const skipped = '// lint-skip-code-rules: reasons\nfunction tooMany(a, b, c, d, e, f) {}\n';
    assert.deepEqual(lintSource('src/sample.js', skipped), []);
  });
});

