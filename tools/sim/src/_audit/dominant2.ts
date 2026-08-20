import { squadOf, duelPoints, type Opts } from './tacticsLib';

const N = Number(globalThis.process?.env?.['N'] ?? 1500);
const A = squadOf('sweepA', 65), B = squadOf('sweepB', 65);
const mean = (x: number[]) => x.reduce((a, b) => a + b, 0) / x.length;
const win = (x: number[]) => (x.filter((v) => v === 3).length / x.length) * 100;
const show = (label: string, p: number[]) =>
  console.log(`  ${label.padEnd(52)} ${mean(p).toFixed(3)} ppg  ${win(p).toFixed(1)}% W  ${((p.filter(v=>v===1).length/p.length)*100).toFixed(1)}% D`);

// Stack the three settings the single-axis sweep says are strongest.
const PRESS_STACK: Opts = { press: 'HIGH_PRESS', line: 'HIGH', width: 'NARROW' };
const FULL: Opts = { press: 'HIGH_PRESS', line: 'HIGH', width: 'NARROW', tempo: 'PATIENT', passing: 'SHORT', buildUp: 'FROM_THE_BACK' };
const ANTI: Opts = { press: 'LOW_BLOCK', line: 'DEEP', width: 'WIDE' };

console.log(`Stacked-tactic evaluation, ${N} matches per cell, common random numbers.\n`);
console.log('vs the BALANCED default:');
show('default (control)', duelPoints({}, {}, N, A, B));
show('HIGH_PRESS only', duelPoints({ press: 'HIGH_PRESS' }, {}, N, A, B));
show('HIGH_PRESS + HIGH line + NARROW', duelPoints(PRESS_STACK, {}, N, A, B));
show('full stack (6 axes)', duelPoints(FULL, {}, N, A, B));
show('LOW_BLOCK + DEEP + WIDE (the anti-stack)', duelPoints(ANTI, {}, N, A, B));

console.log('\nthe press stack against every press/line setting:');
for (const press of ['LOW_BLOCK', 'MID_BLOCK', 'BALANCED', 'HIGH_PRESS'])
  for (const line of ['DEEP', 'NORMAL', 'HIGH'])
    show(`vs press=${press}, line=${line}`, duelPoints(PRESS_STACK, { press, line } as Opts, N, A, B));

console.log('\nmirror (press stack vs press stack):');
show('mirror', duelPoints(PRESS_STACK, PRESS_STACK, N, A, B));

console.log('\nhow much squad quality is the press stack worth?');
for (const edge of [0, 5, 10, 15, 20, 25]) {
  const weak = squadOf(`we-${edge}`, 65 - edge);
  show(`press stack on a squad ${edge} overall worse`, duelPoints(PRESS_STACK, {}, N, weak, B));
}
console.log('\ncontrol: default tactics on a weaker squad');
for (const edge of [0, 5, 10, 15, 20, 25]) {
  const weak = squadOf(`we-${edge}`, 65 - edge);
  show(`default on a squad ${edge} overall worse`, duelPoints({}, {}, N, weak, B));
}
