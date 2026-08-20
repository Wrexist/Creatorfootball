import { MatchSimulator } from '@cf/engine';
import { squadOf, teamOf, setup, type Opts } from './tacticsLib';

const A = squadOf('fA', 65), B = squadOf('fB', 65);
console.log('Mean end-of-match stamina of the starting XI (100 = fresh), 200 matches each.\n');
for (const t of [{}, { press: 'HIGH_PRESS' }, { press: 'HIGH_PRESS', tempo: 'FRANTIC', risk: 'RECKLESS', marking: 'MAN' }, { press: 'LOW_BLOCK' }] as Opts[]) {
  let total = 0, n = 0, minSt = 100;
  for (let i = 0; i < 200; i++) {
    const s = setup(`fat-${i}`, teamOf('home', A, t), teamOf('away', B, {}), { enabledSpecialRules: [] });
    const sim = new MatchSimulator(s);
    let g = 0;
    while (!sim.isComplete && g++ < 5000) sim.step();
    const f = sim.frame();
    for (const p of f.players.filter((x) => x.side === 'home')) { total += p.stamina; n++; minSt = Math.min(minSt, p.stamina); }
  }
  console.log(`  ${JSON.stringify(t).padEnd(64)} mean stamina ${(total / n).toFixed(1)}  lowest seen ${minSt.toFixed(1)}`);
}
