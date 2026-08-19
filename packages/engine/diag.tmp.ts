import { Rng } from './src/core/rng';
import { makeTestSetup, makeTestTeam } from './src/matches/testSupport';
import { simulateMatch } from './src/matches/simulator';

for (const edge of [0, 8, 15, 25]) {
  let hs=0, as_=0, hx=0, ax=0, hp=0, hsh=0, ash=0, w=0,d=0,l=0;
  const N=300;
  for (let i=0;i<N;i++){
    const rng = new Rng(`d${edge}:${i}`);
    const home = makeTestTeam(rng, { prefix:`h${i}`, name:'Fav', target: 65+edge/2 });
    const away = makeTestTeam(rng, { prefix:`a${i}`, name:'Dog', target: 65-edge/2 });
    const r = simulateMatch(makeTestSetup({ seed:`d${edge}:${i}`, home, away }));
    hs+=r.homeScore; as_+=r.awayScore; hx+=r.homeStats.xg; ax+=r.awayStats.xg;
    hp+=r.homeStats.possession; hsh+=r.homeStats.shots; ash+=r.awayStats.shots;
    if(r.homeScore>r.awayScore)w++; else if(r.homeScore===r.awayScore)d++; else l++;
  }
  console.log(`edge ${String(edge).padStart(2)}: goals ${(hs/N).toFixed(2)}-${(as_/N).toFixed(2)} | xg ${(hx/N).toFixed(2)}-${(ax/N).toFixed(2)} | shots ${(hsh/N).toFixed(1)}-${(ash/N).toFixed(1)} | poss ${(hp/N).toFixed(1)}% | W${(w/N*100).toFixed(0)} D${(d/N*100).toFixed(0)} L${(l/N*100).toFixed(0)}`);
}
