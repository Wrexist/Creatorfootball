import { Rng } from './src/core/rng';
import { makeTestSetup, makeTestTeam } from './src/matches/testSupport';
import { simulateMatch } from './src/matches/simulator';

const N = Number(process.argv[2] ?? 800);
for (const edge of [0, 8, 15, 20, 25, 30, 35]) {
  let w=0,d=0,l=0;
  for (let i=0;i<N;i++){
    const rng = new Rng(`edge${edge}:${i}`);
    const home = makeTestTeam(rng, { prefix:`fh${i}`, name:'Fav', target: 65+edge/2 });
    const away = makeTestTeam(rng, { prefix:`fa${i}`, name:'Dog', target: 65-edge/2 });
    const r = simulateMatch(makeTestSetup({ seed:`edge${edge}:${i}`, home, away }));
    if(r.homeScore>r.awayScore)w++; else if(r.homeScore===r.awayScore)d++; else l++;
  }
  console.log(`edge ${String(edge).padStart(2)}: W ${(w/N*100).toFixed(1)}%  D ${(d/N*100).toFixed(1)}%  L ${(l/N*100).toFixed(1)}%`);
}
