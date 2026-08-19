import { useMemo, type ReactNode } from 'react';
import type { Club, MatchResult, Player, PlayerMatchStats, TeamMatchStats } from '@cf/engine';
import {
  GlassPanel, GlassPill, PlayerPortrait, PositionChip, RatingBadge, SectionHeader, cn,
} from '@/design';
import { CompareRow } from '../shared/CompareRow';
import { MomentumWave } from '../shared/MomentumWave';
import { SPECIAL_RULE_TONE, minuteLabel, one, two } from '../shared/format';
import { kitColors, paletteFor } from '../shared/kit';

/**
 * Match analytics.
 *
 * One test: can the player answer "why did I win?" or "why did I lose?" in
 * seconds. So the screen opens with the verdict already written — the biggest
 * gap between the two teams, named — and only then offers the numbers that
 * support it. A grid of statistics with no argument in it is a spreadsheet, and
 * a spreadsheet does not teach anybody anything.
 *
 * Every figure comes off `MatchResult`. Nothing on this screen is recomputed.
 */

export interface AnalyticsTabProps {
  result: MatchResult;
  home: Club;
  away: Club;
  playerIsHome: boolean;
  players: Readonly<Record<string, Player>>;
}

export function AnalyticsTab({
  result, home, away, playerIsHome, players,
}: AnalyticsTabProps): ReactNode {
  const homePalette = paletteFor(home);
  const awayPalette = paletteFor(away);
  const ours = playerIsHome ? result.homeStats : result.awayStats;
  const theirs = playerIsHome ? result.awayStats : result.homeStats;

  const verdict = useMemo(() => explainResult(result, ours, theirs), [result, ours, theirs]);

  const goalMarkers = useMemo(
    () =>
      result.events
        .filter((e) => e.type === 'GOAL' || e.type === 'PENALTY_SCORED')
        .map((e) => ({
          at: Math.min(1, e.minute / Math.max(1, result.durationMinutes)),
          side: (e.side ?? 'home') as 'home' | 'away',
          label: `${minuteLabel(e.minute)} goal`,
        })),
    [result],
  );

  const ratedPlayers = useMemo(() => {
    const ourClubId = playerIsHome ? result.homeClubId : result.awayClubId;
    return Object.values(result.playerStats)
      .filter((stat) => players[stat.playerId]?.clubId === ourClubId)
      .sort((a, b) => b.rating - a.rating);
  }, [result, players, playerIsHome]);

  const tacticalChanges = useMemo(
    () => result.events.filter((e) => e.type === 'TACTICAL_CHANGE' || e.type === 'DECISION_RESOLVED'),
    [result],
  );

  return (
    <>
      <GlassPanel nested level={2} padding="md" accent="volt" title="Why it went that way">
        <ul className="flex flex-col gap-2">
          {verdict.map((line) => (
            <li key={line} className="text-[15px] leading-snug text-ink text-pretty">
              {line}
            </li>
          ))}
        </ul>
      </GlassPanel>

      <GlassPanel nested level={2} padding="md" title="Momentum">
        <MomentumWave
          values={result.momentumTimeline}
          homeColor={homePalette.primary}
          awayColor={awayPalette.primary}
          homeLabel={home.abbreviation}
          awayLabel={away.abbreviation}
          markers={goalMarkers}
          height={96}
        />
      </GlassPanel>

      <GlassPanel nested level={2} padding="md" title="The numbers">
        <CompareRow label="Possession" homeValue={result.homeStats.possession * 100} awayValue={result.awayStats.possession * 100} homeColor={homePalette.primary} awayColor={awayPalette.primary} format={(v) => `${Math.round(v)}%`} />
        <CompareRow label="Shots" homeValue={result.homeStats.shots} awayValue={result.awayStats.shots} homeColor={homePalette.primary} awayColor={awayPalette.primary} />
        <CompareRow label="On target" homeValue={result.homeStats.shotsOnTarget} awayValue={result.awayStats.shotsOnTarget} homeColor={homePalette.primary} awayColor={awayPalette.primary} />
        <CompareRow label="xG" homeValue={result.homeStats.xg} awayValue={result.awayStats.xg} homeColor={homePalette.primary} awayColor={awayPalette.primary} format={two} />
        <CompareRow label="Big chances" homeValue={result.homeStats.bigChances} awayValue={result.awayStats.bigChances} homeColor={homePalette.primary} awayColor={awayPalette.primary} />
        <CompareRow label="Passes" homeValue={result.homeStats.passes} awayValue={result.awayStats.passes} homeColor={homePalette.primary} awayColor={awayPalette.primary} />
        <CompareRow label="Pass accuracy" homeValue={result.homeStats.passAccuracy * 100} awayValue={result.awayStats.passAccuracy * 100} homeColor={homePalette.primary} awayColor={awayPalette.primary} format={(v) => `${Math.round(v)}%`} />
        <CompareRow label="Tackles" homeValue={result.homeStats.tackles} awayValue={result.awayStats.tackles} homeColor={homePalette.primary} awayColor={awayPalette.primary} />
        <CompareRow label="Interceptions" homeValue={result.homeStats.interceptions} awayValue={result.awayStats.interceptions} homeColor={homePalette.primary} awayColor={awayPalette.primary} />
        <CompareRow label="Corners" homeValue={result.homeStats.corners} awayValue={result.awayStats.corners} homeColor={homePalette.primary} awayColor={awayPalette.primary} />
        <CompareRow label="Fouls" homeValue={result.homeStats.fouls} awayValue={result.awayStats.fouls} homeColor={homePalette.primary} awayColor={awayPalette.primary} invert />
        <CompareRow label="Yellow cards" homeValue={result.homeStats.yellowCards} awayValue={result.awayStats.yellowCards} homeColor={homePalette.primary} awayColor={awayPalette.primary} invert />
        <CompareRow label="Red cards" homeValue={result.homeStats.redCards} awayValue={result.awayStats.redCards} homeColor={homePalette.primary} awayColor={awayPalette.primary} invert />
        <CompareRow label="Offsides" homeValue={result.homeStats.offsides} awayValue={result.awayStats.offsides} homeColor={homePalette.primary} awayColor={awayPalette.primary} invert />
      </GlassPanel>

      <section>
        <SectionHeader title="Your ratings" subtitle="1.0 to 10.0, from contributions" />
        <ul className="mt-3 flex flex-col gap-1.5">
          {ratedPlayers.map((stat) => (
            <RatingRow
              key={stat.playerId}
              stat={stat}
              player={players[stat.playerId]}
              motm={result.motmPlayerId === stat.playerId}
              club={playerIsHome ? home : away}
            />
          ))}
        </ul>
      </section>

      {result.specialRules.length > 0 && (
        <GlassPanel nested level={2} padding="md" title="Rule windows">
          <ul className="flex flex-col gap-2">
            {result.specialRules.map((rule, index) => (
              <li key={`${rule.ruleId}-${index}`} className="flex items-start gap-2.5">
                <GlassPill tone={SPECIAL_RULE_TONE[rule.ruleId]} size="sm">
                  {rule.startMinute}&apos;–{rule.endMinute}&apos;
                </GlassPill>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-semibold text-ink">
                    {rule.ruleId.replace(/_/g, ' ').toLowerCase()}
                  </p>
                  <p className="text-[13px] leading-snug text-ink-muted text-pretty">{rule.reason}</p>
                </div>
              </li>
            ))}
          </ul>
        </GlassPanel>
      )}

      {tacticalChanges.length > 0 && (
        <GlassPanel nested level={2} padding="md" title="Changes in the match">
          <ul className="flex flex-col gap-1.5">
            {tacticalChanges.map((event) => (
              <li key={event.id} className="flex gap-2 text-[13px]">
                <span className="tnum shrink-0 text-ink-dim">{minuteLabel(event.minute)}</span>
                <span className="min-w-0 flex-1 text-ink-muted text-pretty">{event.text}</span>
              </li>
            ))}
          </ul>
        </GlassPanel>
      )}
    </>
  );
}

function RatingRow({
  stat, player, motm, club,
}: {
  stat: PlayerMatchStats;
  player: Player | undefined;
  motm: boolean;
  club: Club;
}): ReactNode {
  const kit = kitColors(club.id, club.visual);
  return (
    <li
      className={cn(
        'flex items-center gap-2.5 rounded-md border px-3 py-2',
        motm ? 'border-volt/40 bg-volt/[0.08]' : 'border-white/[0.06] bg-white/[0.03]',
      )}
    >
      {player && <PlayerPortrait seed={player.portraitSeed} size={32} colors={kit} shape="squircle" />}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[14px] font-semibold text-ink">
            {player?.displayName ?? stat.playerId}
          </span>
          {player && <PositionChip position={player.position} size="xs" />}
          {motm && <GlassPill tone="volt" size="xs" filled>MOTM</GlassPill>}
        </div>
        <p className="tnum mt-0.5 text-[12px] text-ink-dim">
          {stat.minutes}&apos; · {stat.goals}G {stat.assists}A · {stat.shots} shots · {one(stat.xg)} xG
        </p>
      </div>
      <RatingBadge value={stat.rating} scale="match" size="md" />
    </li>
  );
}

/**
 * The verdict, in at most three sentences.
 *
 * Ranked by how far apart the two sides actually were, so the line the player
 * reads first is the one that mattered most in this particular match — not a
 * fixed template that always leads with possession.
 */
function explainResult(
  result: MatchResult,
  ours: TeamMatchStats,
  theirs: TeamMatchStats,
): string[] {
  const lines: { weight: number; text: string }[] = [];

  const xgGap = ours.xg - theirs.xg;
  const goalGap = ours.goals - theirs.goals;
  const overperformance = goalGap - xgGap;

  if (Math.abs(xgGap) > 0.4) {
    lines.push({
      weight: Math.abs(xgGap) * 2,
      text:
        xgGap > 0
          ? `You created the better chances — ${two(ours.xg)} xG to ${two(theirs.xg)}.`
          : `They created the better chances — ${two(theirs.xg)} xG to your ${two(ours.xg)}.`,
    });
  }

  if (Math.abs(overperformance) > 0.8) {
    lines.push({
      weight: Math.abs(overperformance) * 1.6,
      text:
        overperformance > 0
          ? 'You took your chances better than the numbers said you should. Finishing won this.'
          : 'You did not take your chances. The finishing, not the football, cost you.',
    });
  }

  const shotGap = ours.shots - theirs.shots;
  if (Math.abs(shotGap) >= 5) {
    lines.push({
      weight: Math.abs(shotGap) * 0.4,
      text:
        shotGap > 0
          ? `You had ${ours.shots} shots to their ${theirs.shots} and kept them penned in.`
          : `They out-shot you ${theirs.shots} to ${ours.shots}. You spent the match defending.`,
    });
  }

  const possessionGap = ours.possession - theirs.possession;
  if (Math.abs(possessionGap) > 0.14) {
    lines.push({
      weight: Math.abs(possessionGap) * 8,
      text:
        possessionGap > 0
          ? `You controlled the ball (${Math.round(ours.possession * 100)}%) — the question is what you did with it.`
          : `You barely saw the ball (${Math.round(ours.possession * 100)}%), and it showed.`,
    });
  }

  if (ours.redCards > 0) {
    lines.push({ weight: 12, text: 'Going down to ten changed the match. Discipline decided this one.' });
  }
  if (theirs.redCards > 0) {
    lines.push({ weight: 10, text: 'Their red card handed you the initiative.' });
  }

  const bigChancesMissed = ours.bigChancesMissed;
  if (bigChancesMissed >= 2) {
    lines.push({
      weight: bigChancesMissed * 1.4,
      text: `${bigChancesMissed} big chances went begging.`,
    });
  }

  if (result.specialRules.length > 0) {
    const windowGoals = result.events.filter(
      (e) => (e.type === 'GOAL' || e.type === 'PENALTY_SCORED') && e.detail?.window === true,
    ).length;
    if (windowGoals > 0) {
      lines.push({
        weight: windowGoals * 3,
        text: `${windowGoals} of the goals landed inside a rule window. Those minutes decided the scoreline.`,
      });
    }
  }

  if (lines.length === 0) {
    return ['There was almost nothing between the two sides. This one turned on moments, not patterns.'];
  }

  return lines.sort((a, b) => b.weight - a.weight).slice(0, 3).map((line) => line.text);
}
