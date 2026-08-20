import { squadOf, duel, pts } from './tacticsLib';
const A = squadOf('sweepA', 65), B = squadOf('sweepB', 65);
const snap = () => JSON.stringify([A, B]);
const before = snap();
console.log('first duel  ppg', pts(duel('t1', {}, 'default', {}, 400, A, B)).toFixed(3));
console.log('players mutated by sim:', snap() !== before);
// Now run 20 duels and re-run the identical first one.
for (let i = 0; i < 20; i++) duel(`filler${i}`, { risk: 'RECKLESS' }, 'default', {}, 400, A, B);
console.log('same duel again ppg', pts(duel('t1', {}, 'default', {}, 400, A, B)).toFixed(3));
console.log('players mutated after 21 duels:', snap() !== before);
