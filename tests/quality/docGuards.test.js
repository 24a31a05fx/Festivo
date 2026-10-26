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

  it('ensures all referenced local markdown files, anchors, and existing assets exist', () => {
    const mdFiles = [
      'README.md',
      'CONTRIBUTING.md',
      'SECURITY.md',
      'docs/ARCHITECTURE.md',
      'docs/SECURITY.md',
      'docs/ACCESSIBILITY.md',
      'docs/DEPLOYMENT.md',
      'docs/TESTING.md',
      'docs/screenshots/README.md',
    ];

    for (const docFile of mdFiles) {
      const fullDocPath = path.join(ROOT, docFile);
      const docDir = path.dirname(fullDocPath);
      const content = read(docFile);

      if (docFile === 'README.md') {
        const headings = [...content.matchAll(/^#+\s+(.+)$/gm)].map((m) => m[1]);
        const githubSlug = (h) => h.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s/g, '-');
        const headingSlugs = new Set(headings.map(githubSlug));
        for (const match of content.matchAll(/\[[^\]]+\]\(#([^)]+)\)/g)) {
          const anchor = match[1];
          assert.ok(headingSlugs.has(anchor), `Unmatched anchor in ${docFile}: #${anchor}`);
        }
      }

      for (const match of content.matchAll(/\[([^\]]*)\]\(([^)]+)\)/g)) {
        const rawTarget = match[2].trim();
        if (/^(?:https?:|mailto:|#)/.test(rawTarget)) continue;

        const targetPath = decodeURIComponent(rawTarget.split('#')[0].trim());
        if (!targetPath) continue;

        const resolved = path.isAbsolute(targetPath) ? targetPath : path.resolve(docDir, targetPath);
        assert.ok(existsSync(resolved), `Dead link in ${docFile}: ${rawTarget}`);
      }

      for (const match of content.matchAll(/<img[^>]+src="([^">]+)"/g)) {
        const rawSrc = match[1].trim();
        if (/^https?:/.test(rawSrc)) continue;
        const assetPath = decodeURIComponent(rawSrc.split('#')[0].trim());
        const resolved = path.resolve(ROOT, assetPath);
        assert.ok(existsSync(resolved), `Missing image asset in ${docFile}: ${rawSrc}`);
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

  it('ensures all files and directories in README repository structure tree actually exist on disk', () => {
    const readme = read('README.md');
    const match = /## Repository Structure[\s\S]*?```[a-z]*\r?\n([\s\S]*?)\r?\n```/.exec(readme);
    assert.ok(match, 'README must contain a repository structure tree block');
    const lines = match[1].split(/\r?\n/);

    const dirStack = [''];
    let checked = 0;
    for (const line of lines) {
      const m = /^([|\s]*?)(?:\|--|`--)\s+([a-zA-Z0-9_.-]+(?:\/)?)/.exec(line);
      if (!m) continue;
      const prefix = m[1];
      const item = m[2];
      const depth = Math.round(prefix.length / 4) + 1;
      dirStack.length = depth;
      const cleanPath = (dirStack.slice(1).join('') + item).replace(/\/+/g, '/');
      if (item.endsWith('/')) {
        dirStack[depth] = item;
      }
      const resolved = path.resolve(ROOT, cleanPath);
      assert.ok(existsSync(resolved), `Path in README tree does not exist on disk: ${cleanPath}`);
      checked += 1;
    }
    assert.ok(checked >= 40, `Expected at least 40 files in tree, found ${checked}`);
  });
});
