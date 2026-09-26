import { closeDb } from './sqlite.js';
import { seedIfEmpty } from './seed.js';

const { seeded } = seedIfEmpty();
console.log(`[db:seed] ${seeded ? 'seeded initial data' : 'already seeded — skipped'}`);
closeDb();
