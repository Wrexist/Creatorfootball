import { squadOf, duel } from './tacticsLib';
const A = squadOf('a', 65), B = squadOf('b', 65);
const t0 = Date.now();
duel('x', {}, 'y', {}, 200, A, B);
console.log(`200 matches in ${Date.now() - t0}ms`);
