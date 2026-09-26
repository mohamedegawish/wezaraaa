import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ROOT } from './helpers.js';

describe('contracts (openapi + ROUTES)', () => {
  it('openapi.json is valid and covers all areas', () => {
    const raw = fs.readFileSync(`${ROOT}/contracts/openapi.json`, 'utf8');
    const j = JSON.parse(raw) as { paths: Record<string, unknown> };
    const paths = Object.keys(j.paths);
    assert.ok(paths.length >= 20, `expected >=20 paths, got ${paths.length}`);
    for (const must of ['/api/v1/health', '/api/v1/users/{id}', '/api/v1/applications/{id}', '/api/v1/audit-logs', '/api/v1/dashboard/summary']) {
      assert.ok(paths.includes(must), `missing ${must}`);
    }
  });

  it('api.contracts.ts ROUTES all present', async () => {
    const src = fs.readFileSync(`${ROOT}/contracts/api.contracts.ts`, 'utf8');
    for (const r of ['switchUser', 'createDecision', 'uploadDetailsFile', 'dashboardSummary', 'auditLogs']) {
      assert.ok(src.includes(r), `missing ROUTES.${r}`);
    }
  });
});
