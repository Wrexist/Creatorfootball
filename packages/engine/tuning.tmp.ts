import { Rng } from './src/core/rng';
import { makeTestSetup, makeTestTeam } from './src/matches/testSupport';
import { MatchSimulator, simulateMatch } from './src/matches/simulator';
import { BALANCE } from './src/matches/balance';

interface Row {
  goals: number; homeGoals: number; awayGoals: number;
  shots: number; sot: number; xg: number;
  windowGoals: number; windowMinutes: number;
  normalGoals: number; normalMinutes: number;
  yellows: number; reds: number; injuries: number;
  possession: number; passAcc: number; ballInPlay: number;
  fouls: number; corners: number; duration: number;
  endStamina: number; subs: number;
}

function runBatch(n: number, seedPrefix: string, qualityFn: (i: number, rng: Rng) => [number, number]): Row[] {
  const rows: Row[] = [];
  for (let i = 0; i < n; i++) {
    const rng = new Rng(`${seedPrefix}:${i}`);
    const [hq, aq] = qualityFn(i, rng);
    const home = makeTestTeam(rng, { prefix: `h${i}`, name: 'Northside', target: hq, creatorPresence: 0.3 });
    const away = makeTestTeam(rng, { prefix: `a${i}`, name: 'Southgate', target: aq, creatorPresence: 0.3 });
    const setup = makeTestSetup({ seed: `${seedPrefix}:${i}`, home, away });
    const sim = new MatchSimulator(setup);
    const r = sim.finish();

    const halfLen = setup.config.minutes / setup.config.halves;
    const winStart1 = halfLen - BALANCE.SWING_WINDOW_MINUTES;
    const winStart2 = setup.config.minutes - BALANCE.SWING_WINDOW_MINUTES;
    let windowGoals = 0;
    let totalGoals = 0;
    for (const e of r.events) {
      if (e.type !== 'GOAL' && e.type !== 'PENALTY_SCORED') continue;
      const mult = Number(e.detail?.['multiplier'] ?? 1);
      totalGoals += mult;
      if (e.detail?.['window'] === true) windowGoals += mult;
    }
    let windowMinutes = 0;
    let openAt: number | null = null;
    for (const e of r.events) {
      if (e.type === 'SPECIAL_RULE_START') openAt = e.minute;
      if (e.type === 'SPECIAL_RULE_END' && openAt !== null) { windowMinutes += e.minute - openAt; openAt = null; }
    }
    if (openAt !== null) windowMinutes += r.durationMinutes - openAt;
    if (windowMinutes <= 0) windowMinutes = BALANCE.SWING_WINDOW_MINUTES * setup.config.halves;
    const normalMinutes = Math.max(1, r.durationMinutes - windowMinutes);
    void winStart1; void winStart2; void halfLen;

    let endStamina = 0; let cnt = 0; let subs = 0;
    for (const ps of Object.values(r.playerStats)) { endStamina += ps.endStamina; cnt++; }
    subs = r.events.filter((e) => e.type === 'SUBSTITUTION').length;

    rows.push({
      goals: r.homeScore + r.awayScore,
      homeGoals: r.homeScore, awayGoals: r.awayScore,
      shots: r.homeStats.shots + r.awayStats.shots,
      sot: r.homeStats.shotsOnTarget + r.awayStats.shotsOnTarget,
      xg: r.homeStats.xg + r.awayStats.xg,
      windowGoals, windowMinutes,
      normalGoals: totalGoals - windowGoals, normalMinutes,
      yellows: r.homeStats.yellowCards + r.awayStats.yellowCards,
      reds: r.homeStats.redCards + r.awayStats.redCards,
      injuries: r.injuries.length,
      possession: r.homeStats.possession,
      passAcc: (r.homeStats.passAccuracy + r.awayStats.passAccuracy) / 2,
      ballInPlay: sim.ballInPlayShare(),
      fouls: r.homeStats.fouls + r.awayStats.fouls,
      corners: r.homeStats.corners + r.awayStats.corners,
      duration: r.durationMinutes,
      endStamina: cnt ? endStamina / cnt : 0,
      subs,
    });
  }
  return rows;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const variance = (xs: number[]) => { const m = mean(xs); return mean(xs.map((x) => (x - m) ** 2)); };

const N = Number(process.argv[2] ?? 400);
const rows = runBatch(N, 'cal', (i, rng) => {
  const base = 50 + (i % 7) * 5;
  return [base + rng.normal(0, 4), base + rng.normal(0, 4)];
});

const g = rows.map((r) => r.goals);
const teamGoals = rows.flatMap((r) => [r.homeGoals, r.awayGoals]);
console.log('--- AGGREGATE (' + N + ' matches) ---');
console.log('goals/match          ', mean(g).toFixed(2), ' band 6.0-9.0');
console.log('goals/min            ', (mean(g) / mean(rows.map(r=>r.duration))).toFixed(3), ' band 0.20-0.30');
console.log('normal-play goals/min', (mean(rows.map(r=>r.normalGoals)) / mean(rows.map(r=>r.normalMinutes))).toFixed(3), ' band 0.16-0.18');
console.log('window goals/min     ', (mean(rows.map(r=>r.windowGoals)) / mean(rows.map(r=>r.windowMinutes))).toFixed(3));
console.log('window multiple      ', ((mean(rows.map(r=>r.windowGoals)) / mean(rows.map(r=>r.windowMinutes))) / (mean(rows.map(r=>r.normalGoals)) / mean(rows.map(r=>r.normalMinutes)))).toFixed(2), ' band 2-4');
console.log('shots/match          ', mean(rows.map(r=>r.shots)).toFixed(1), ' band 24-40');
console.log('shots/team           ', (mean(rows.map(r=>r.shots))/2).toFixed(1));
console.log('SoT share            ', (mean(rows.map(r=>r.sot))/mean(rows.map(r=>r.shots))*100).toFixed(1)+'%');
console.log('conversion           ', (mean(g)/mean(rows.map(r=>r.shots))*100).toFixed(1)+'%', ' band 18-28');
console.log('xG/match             ', mean(rows.map(r=>r.xg)).toFixed(2));
console.log('xG/shot              ', (mean(rows.map(r=>r.xg))/mean(rows.map(r=>r.shots))).toFixed(3));
console.log('yellows/match        ', mean(rows.map(r=>r.yellows)).toFixed(2), ' band 0.5-2.0');
console.log('reds/match           ', mean(rows.map(r=>r.reds)).toFixed(3), ' band 0.01-0.06');
console.log('injuries/team/match  ', (mean(rows.map(r=>r.injuries))/2).toFixed(3), ' band 0.08-0.14');
console.log('fouls/match          ', mean(rows.map(r=>r.fouls)).toFixed(1));
console.log('possession home      ', mean(rows.map(r=>r.possession)).toFixed(1)+'%');
console.log('possession min/max   ', Math.min(...rows.map(r=>r.possession)).toFixed(1), Math.max(...rows.map(r=>r.possession)).toFixed(1));
console.log('pass accuracy        ', mean(rows.map(r=>r.passAcc)).toFixed(1)+'%');
console.log('ball in play         ', (mean(rows.map(r=>r.ballInPlay))*100).toFixed(1)+'%', ' target ~90');
console.log('duration             ', mean(rows.map(r=>r.duration)).toFixed(1));
console.log('end stamina          ', mean(rows.map(r=>r.endStamina)).toFixed(1));
console.log('subs/match           ', mean(rows.map(r=>r.subs)).toFixed(2));
console.log('team goals var/mean  ', (variance(teamGoals)/mean(teamGoals)).toFixed(2), ' >1 = overdispersed');
const draws = rows.filter(r=>r.homeGoals===r.awayGoals).length;
console.log('draw rate            ', (draws/rows.length*100).toFixed(1)+'%');

// favourite vs underdog
function winRate(edge: number, n: number): { win: number; draw: number; loss: number } {
  let w = 0, d = 0, l = 0;
  for (let i = 0; i < n; i++) {
    const rng = new Rng(`edge${edge}:${i}`);
    const home = makeTestTeam(rng, { prefix: `fh${i}`, name: 'Favourite', target: 65 + edge / 2 });
    const away = makeTestTeam(rng, { prefix: `fa${i}`, name: 'Underdog', target: 65 - edge / 2 });
    const r = simulateMatch(makeTestSetup({ seed: `edge${edge}:${i}`, home, away }));
    if (r.homeScore > r.awayScore) w++; else if (r.homeScore === r.awayScore) d++; else l++;
  }
  return { win: w / n, draw: d / n, loss: l / n };
}
for (const edge of [0, 8, 15, 25, 35]) {
  const r = winRate(edge, 300);
  console.log(`edge ${String(edge).padStart(2)}pts -> W ${(r.win*100).toFixed(1)}%  D ${(r.draw*100).toFixed(1)}%  L ${(r.loss*100).toFixed(1)}%  (W+D/2 = ${((r.win + r.draw/2)*100).toFixed(1)}%)`);
}
