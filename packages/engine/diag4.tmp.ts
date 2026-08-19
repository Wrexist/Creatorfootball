import { Rng } from './src/core/rng';
import { makeTestSetup, makeTestTeam } from './src/matches/testSupport';
import { MatchSimulator } from './src/matches/simulator';

const N = 800;
let firstHome = 0, momSum = 0, momN = 0, hs=0, as_=0;
for (let i=0;i<N;i++){
  const rng = new Rng(`z:${i}`);
  const home = makeTestTeam(rng, { prefix:`h${i}`, name:'A', target: 65 });
  const away = makeTestTeam(rng, { prefix:`a${i}`, name:'B', target: 65 });
  const sim = new MatchSimulator(makeTestSetup({ seed:`z:${i}`, home, away, config: { maxDecisions: 0 } }));
  const ko = sim['possession'] as string;
  if (ko === 'home') firstHome++;
  const r = sim.finish();
  for (const m of r.momentumTimeline) { momSum += m; momN++; }
  hs+=r.homeStats.shots; as_+=r.awayStats.shots;
}
console.log(`kickoff home share ${(firstHome/N*100).toFixed(1)}%`);
console.log(`mean momentum ${(momSum/momN).toFixed(4)}`);
console.log(`shots ${(hs/N).toFixed(2)} / ${(as_/N).toFixed(2)}`);
