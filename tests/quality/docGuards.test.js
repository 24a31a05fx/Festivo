import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { ROOT, read } from '../helpers/project.js';

describe('documentation consistency guards', () => {
  it('ensures all documented npm scripts in README exist in package.json', () => {
    const pkg = JSON.parse(read('package.json'));
    const readme = read('README.md');
    const runScripts = [...new Set([...readme.matchAll(/npm run ([a-z0-9:-]+)/g)].map((m) => m[1]))];
    for (const script of runScripts) {
      assert.ok(script in pkg.scripts, `README documents nonexistent script: npm run ${script}`);
    }
    assert.ok('start' in pkg.scripts, 'start script must exist in package.json');
    assert.ok('test' in pkg.scripts, 'test script must exist in package.json');
  });

  it('ensures all documented environment variables match supported configuration', () => {
    const supportedVars = new Set([
      'PORT',
      'HOST',
      'ALLOWED_HOSTS',
      'TRUST_PROXY',
      'GEMINI_API_KEY',
      'GEMINI_MODELS',
      'AI_TIMEOUT_MS',
      'RATE_LIMIT_WINDOW_MS',
      'RATE_LIMIT_MAX',
      'AI_RATE_LIMIT_MAX',
      'MAX_BODY_BYTES',
    ]);

    const envExample = read('.env.example');
    const envVars = [...envExample.matchAll(/^[#\s]*([A-Z0-9_]+)=/gm)].map((m) => m[1]);
    for (const v of envVars) {
      assert.ok(supportedVars.has(v), `.env.example contains unapproved variable: ${v}`);
    }

    const readme = read('README.md');
    const readmeTable = /## Environment Variables[\s\S]*?(?=\n## )/.exec(readme)?.[0] ?? '';
    const readmeVars = [...readmeTable.matchAll(/\| `([A-Z0-9_]+)` \|/g)].map((m) => m[1]);
    assert.ok(readmeVars.length >= 8, 'README should document environment variables');
    for (const v of readmeVars) {
      assert.ok(supportedVars.has(v), `README documents unsupported variable: ${v}`);
    }
  });

  it('ensures all referenced local markdown files and existing assets exist', () => {
    const readme = read('README.md');
    const localLinks = [...readme.matchAll(/\[[^\]]+\]\((docs\/[A-Za-z0-9_/.-]+\.md|LICENSE|CONTRIBUTING\.md|SECURITY\.md)\)/g)].map((m) => m[1]);
    for (const relPath of localLinks) {
      assert.ok(existsSync(path.join(ROOT, relPath)), `Dead link in README.md: ${relPath}`);
    }

    const imageLinks = [...readme.matchAll(/<img[^>]+src="([^">]+)"/g)].map((m) => m[1]);
    for (const src of imageLinks) {
      if (!src.startsWith('http')) {
        assert.ok(existsSync(path.join(ROOT, src)), `Missing image asset: ${src}`);
      }
    }
  });

  it('preserves core project identity and required setup commands', () => {
    const readme = read('README.md');
    assert.ok(readme.includes('# Festivo'), 'README must retain Festivo title');
    assert.ok(readme.includes('Your Celebration Command Center'), 'README must retain tagline');
    for (const phrase of ['npm start', 'npm test', 'npm run check', 'npm run coverage']) {
      assert.ok(readme.includes(phrase), `README must contain ${phrase}`);
    }
  });
});
