import { Rng } from './src/core/rng';
import { makeTestTeam } from './src/matches/testSupport';

const N = 4000;
let h=0,a=0, hAll=0, aAll=0;
for (let i=0;i<N;i++){
  const rng = new Rng(`q:${i}`);
  const home = makeTestTeam(rng, { prefix:`h${i}`, name:'A', target: 65 });
  const away = makeTestTeam(rng, { prefix:`a${i}`, name:'B', target: 65 });
  for (const [team, acc] of [[home, 'h'], [away, 'a']] as const) {
    const ids = new Set(Object.values(team.tactics.lineup).filter(Boolean) as unknown as string[]);
    const xi = team.players.filter((p) => ids.has(p.id as unknown as string));
    const m = xi.reduce((s,p)=>s+p.overall,0)/Math.max(1,xi.length);
    const all = team.players.reduce((s,p)=>s+p.overall,0)/team.players.length;
    if (acc==='h') { h+=m; hAll+=all; } else { a+=m; aAll+=all; }
  }
}
console.log(`selected XI overall: home ${(h/N).toFixed(3)}  away ${(a/N).toFixed(3)}  delta ${((h-a)/N).toFixed(3)}`);
console.log(`whole squad overall: home ${(hAll/N).toFixed(3)}  away ${(aAll/N).toFixed(3)}`);
