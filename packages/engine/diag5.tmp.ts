import { Rng } from './src/core/rng';
import { makeTestSetup, makeTestTeam } from './src/matches/testSupport';
import { simulateMatch } from './src/matches/simulator';

const N = 2000;
let hs=0, as_=0, hg=0, ag=0, hp=0, w=0,l=0,d=0;
for (let i=0;i<N;i++){
  const rng = new Rng(`sym:${i}`);
  const squad = makeTestTeam(rng, { prefix:`s${i}`, name:'A', target: 65 });
  const away = { ...squad, name: 'B', shortName: 'B' };
  const r = simulateMatch(makeTestSetup({ seed:`sym:${i}`, home: squad, away, config: { maxDecisions: 0 } }));
  hs+=r.homeStats.shots; as_+=r.awayStats.shots; hg+=r.homeScore; ag+=r.awayScore;
  hp+=r.homeStats.possession;
  if(r.homeScore>r.awayScore)w++; else if(r.homeScore<r.awayScore)l++; else d++;
}
console.log(`MIRROR shots ${(hs/N).toFixed(2)} / ${(as_/N).toFixed(2)}   goals ${(hg/N).toFixed(3)} / ${(ag/N).toFixed(3)}  poss ${(hp/N).toFixed(2)}%  W${(w/N*100).toFixed(1)} D${(d/N*100).toFixed(1)} L${(l/N*100).toFixed(1)}`);
