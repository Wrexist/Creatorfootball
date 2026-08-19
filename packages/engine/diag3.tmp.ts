import { Rng } from './src/core/rng';
import { makeTestSetup, makeTestTeam } from './src/matches/testSupport';
import { simulateMatch } from './src/matches/simulator';

const N = 800;
let hq=0, aq=0, hs=0, as_=0, hx=0, ax=0, hg=0, ag=0, hp=0;
for (let i=0;i<N;i++){
  const rng = new Rng(`z:${i}`);
  const home = makeTestTeam(rng, { prefix:`h${i}`, name:'A', target: 65 });
  const away = makeTestTeam(rng, { prefix:`a${i}`, name:'B', target: 65 });
  const startersH = home.players.slice(0,7), startersA = away.players.slice(0,7);
  hq += startersH.reduce((a,p)=>a+p.overall,0)/7;
  aq += startersA.reduce((a,p)=>a+p.overall,0)/7;
  const r = simulateMatch(makeTestSetup({ seed:`z:${i}`, home, away, config: { maxDecisions: 0 } }));
  hs+=r.homeStats.shots; as_+=r.awayStats.shots; hx+=r.homeStats.xg; ax+=r.awayStats.xg;
  hg+=r.homeScore; ag+=r.awayScore; hp+=r.homeStats.possession;
}
console.log(`squad overall  home ${(hq/N).toFixed(2)}  away ${(aq/N).toFixed(2)}`);
console.log(`shots          home ${(hs/N).toFixed(2)}  away ${(as_/N).toFixed(2)}`);
console.log(`xg             home ${(hx/N).toFixed(3)}  away ${(ax/N).toFixed(3)}`);
console.log(`goals          home ${(hg/N).toFixed(3)}  away ${(ag/N).toFixed(3)}`);
console.log(`possession     home ${(hp/N).toFixed(2)}%`);
