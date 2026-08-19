import { Rng } from './src/core/rng';
import { makeTestSetup, makeTestTeam } from './src/matches/testSupport';
import { simulateMatch } from './src/matches/simulator';

const N = 800;
for (const maxDecisions of [0, 3]) {
  let w=0,d=0,l=0, hd=0, ad=0;
  for (let i=0;i<N;i++){
    const rng = new Rng(`z:${i}`);
    const home = makeTestTeam(rng, { prefix:`h${i}`, name:'A', target: 65 });
    const away = makeTestTeam(rng, { prefix:`a${i}`, name:'B', target: 65 });
    const r = simulateMatch(makeTestSetup({ seed:`z:${i}`, home, away, config: { maxDecisions } }));
    if(r.homeScore>r.awayScore)w++; else if(r.homeScore===r.awayScore)d++; else l++;
    for (const e of r.events) if (e.type==='DECISION_RESOLVED') { if (e.side==='home') hd++; else ad++; }
  }
  console.log(`maxDecisions=${maxDecisions}: W ${(w/N*100).toFixed(1)}% D ${(d/N*100).toFixed(1)}% L ${(l/N*100).toFixed(1)}%  decisions home=${hd} away=${ad}`);
}
