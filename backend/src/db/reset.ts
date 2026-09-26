import { closeDb } from './sqlite.js';
import { resetAndSeed } from './seed.js';

resetAndSeed();
console.log('[db:reset] wiped + reseeded');
closeDb();
