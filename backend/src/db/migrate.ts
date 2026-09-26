import { getDb, closeDb } from './sqlite.js';

// Ensures schema exists (idempotent). Seed is separate and auto-runs on boot.
getDb();
console.log('[db:migrate] schema OK');
closeDb();
