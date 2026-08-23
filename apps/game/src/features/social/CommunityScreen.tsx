import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  campaignOptions, closedPolls, declinePoll, liveCampaigns, milestones, nextMilestone,
  offeredPolls, openPolls, respondToCampaign, runPoll, settlePoll, socialWorld, trustSummary,
  formatMoney,
  type FanCampaign, type FanPoll, type GameState,
} from '@cf/engine';
import {
  CreatorAvatar, Divider, EmptyState, GlassButton, GlassPanel, GlassPill, GlassSheet,
  IconFans, IconInfo, IconLock, IconTrophy, ListRow, NameText, ProgressBar, Screen,
  SectionHeader, StatBlock, Text, formatCount, useToast,
} from '@/design';
import { SOCIAL_ROUTES } from './routes';
import { GateScreen, useGameStatus } from './gate';
import { useSocialAction, useSocialWorld } from './engine';
import { contentRegistry } from '@/state/content';
import { EffectLines } from './components/Effects';

/**
 * The supporters.
 *
 * Three surfaces, one rule: **asking is a commitment.** A poll the club runs
 * and then overrules is worse than a poll it never ran, which is exactly how it
 * works in a real supporters' meeting and is what makes running one a decision
 * rather than free goodwill.
 *
 * Campaigns are the mirror image — the supporters started those, the club did
 * not ask, and the only moves available are to meet them, refuse them plainly,
 * or let them sit there costing a little every week.
 *
 * Milestones sit underneath both, because everything on this screen is
 * ultimately about the same thing: the size and the temperature of the audience
 * this club has, and which doors that opens.
 */

function PollCard({
  poll, state, onRun, onDecline, onSettle,
}: {
  poll: FanPoll;
  state: GameState;
  onRun: (id: string) => void;
  onDecline: (id: string) => void;
  onSettle: (id: string, honour: boolean) => void;
}): ReactNode {
  const winnerIndex = poll.options.findIndex((o) => o.id === poll.winnerId);
  return (
    <article className="glass-1 raised rounded-lg p-3.5">
      <div className="flex items-center gap-2">
        <GlassPill size="xs" tone="volt" filled>{poll.topic}</GlassPill>
        <Text role="micro" as="span">
          {poll.status === 'OFFERED' ? 'Not asked yet'
            : poll.status === 'OPEN' ? 'Voting is open'
              : `${formatCount(poll.turnout ?? 0)} voted`}
        </Text>
      </div>
      <Text role="section" as="p" className="mt-2 text-pretty">{poll.question}</Text>

      <ul className="mt-2.5 flex flex-col gap-2">
        {poll.options.map((option, index) => (
          <li key={option.id}>
            <div className="flex items-baseline justify-between gap-2">
              <Text role="label" as="span" className="min-w-0">{option.label}</Text>
              {poll.shares && (
                <Text role="micro" as="span" className="shrink-0">
                  {`${Math.round((poll.shares[index] ?? 0) * 100)}%`}
                </Text>
              )}
            </div>
            {poll.shares && (
              <ProgressBar
                value={(poll.shares[index] ?? 0) * 100}
                max={100}
                tone={index === winnerIndex ? 'volt' : 'neutral'}
                size="xs"
                className="mt-1"
              />
            )}
            <Text role="caption" as="p" className="mt-0.5 text-ink-dim text-pretty">
              {option.commitment}
            </Text>
          </li>
        ))}
      </ul>

      {poll.status === 'OFFERED' && (
        <div className="mt-3 flex gap-2">
          <GlassButton variant="secondary" size="sm" onClick={() => onDecline(poll.id)}>
            Do not ask
          </GlassButton>
          <GlassButton variant="primary" size="sm" block onClick={() => onRun(poll.id)}>
            Put it to them
          </GlassButton>
        </div>
      )}
      {poll.status === 'CLOSED' && (
        <>
          <Divider label="They have answered" />
          <Text role="caption" as="p" className="text-pretty">
            {`They chose ${poll.options[winnerIndex]?.label ?? 'an option'}. Doing it is worth a great deal. Not doing it, having asked, is worth considerably less than never asking.`}
          </Text>
          <div className="mt-3 flex gap-2">
            <GlassButton variant="secondary" size="sm" onClick={() => onSettle(poll.id, false)}>
              Overrule them
            </GlassButton>
            <GlassButton variant="primary" size="sm" block onClick={() => onSettle(poll.id, true)}>
              Do what they said
            </GlassButton>
          </div>
        </>
      )}
      {poll.status === 'OPEN' && (
        <Text role="caption" as="p" className="mt-3 text-ink-dim">
          {`Voting closes at the end of matchweek ${poll.closesCycle}. Whatever you do about the winner, ${state.clubs[state.playerClubId]?.shortName ?? 'the club'} will be judged on it.`}
        </Text>
      )}
    </article>
  );
}

function CampaignCard({
  campaign, state, onRespond,
}: {
  campaign: FanCampaign;
  state: GameState;
  onRespond: (id: string, response: 'BACK' | 'REFUSE') => void;
}): ReactNode {
  const options = campaignOptions(state, campaign);
  return (
    <article className="glass-1 raised rounded-lg p-3.5">
      <div className="flex items-center gap-2">
        <GlassPill size="xs" tone={campaign.support >= 60 ? 'danger' : 'warning'} filled>
          {`${campaign.support}% behind it`}
        </GlassPill>
        <Text role="micro" as="span">{`Fades after matchweek ${campaign.expiresCycle}`}</Text>
      </div>
      <Text role="section" as="p" className="mt-2 text-pretty">{campaign.title}</Text>
      <Text role="body" as="p" className="mt-1 text-pretty">{campaign.demand}</Text>
      <div className="mt-3 flex flex-col gap-2">
        {options.map((option) => (
          <button
            key={option.response}
            type="button"
            onClick={() => onRespond(campaign.id, option.response)}
            className="glass-1 w-full rounded-md p-2.5 text-left"
          >
            <Text role="label" as="span">{option.label}</Text>
            <Text role="caption" as="p" className="mt-0.5 text-pretty">{option.blurb}</Text>
            <EffectLines lines={option.lines} className="mt-1.5" />
          </button>
        ))}
      </div>
      <Text role="caption" as="p" className="mt-2.5 text-ink-dim text-pretty">
        Ignoring it costs a little every week it stays up, and then it fades having cost more than
        either answer would have.
      </Text>
    </article>
  );
}

function CommunityView({ state }: { state: GameState }): ReactNode {
  const navigate = useNavigate();
  const toast = useToast();
  const run = useSocialAction();
  useSocialWorld(state);

  const world = socialWorld(state);
  const trust = trustSummary(state);
  const offered = useMemo(() => offeredPolls(state), [state]);
  const open = useMemo(() => openPolls(state), [state]);
  const closed = useMemo(() => closedPolls(state).slice(0, 3), [state]);
  const campaigns = useMemo(() => liveCampaigns(state), [state]);
  const doors = useMemo(() => milestones(state), [state]);
  const next = useMemo(() => nextMilestone(state), [state]);
  const fan = world.fanOfTheWeek[world.fanOfTheWeek.length - 1];
  const [viralOpen, setViralOpen] = useState(false);
  const viral = world.viral.slice(-5).reverse();

  const doRun = (id: string): void => {
    const outcome = run((current) => runPoll(current, { pollId: id, at: Date.now() }));
    if (outcome.ok) toast.success('It is out there', 'They will answer by the end of the week.');
    else toast.error('Not possible', outcome.reason ?? 'That question has gone.');
  };
  const doDecline = (id: string): void => {
    const outcome = run((current) => declinePoll(current, { pollId: id, at: Date.now() }));
    if (outcome.ok) {
      toast.show({ tone: 'neutral', title: 'Not asked', description: 'A small cost, and no argument.' });
    } else toast.error('Not possible', outcome.reason ?? 'Already gone.');
  };
  const doSettle = (id: string, honour: boolean): void => {
    const outcome = run((current) => settlePoll(current, {
      pollId: id, honour, at: Date.now(), registry: contentRegistry(),
    }));
    if (!outcome.ok) { toast.error('Not possible', outcome.reason ?? 'That vote is closed.'); return; }
    if (honour) toast.success('Done', 'They asked, you listened, and they noticed.');
    else {
      toast.show({
        tone: 'warning',
        title: 'Overruled',
        description: 'That will be remembered for longer than a result.',
      });
    }
  };
  const doRespond = (id: string, response: 'BACK' | 'REFUSE'): void => {
    const outcome = run((current) => respondToCampaign(current, {
      campaignId: id, response, at: Date.now(), registry: contentRegistry(),
    }));
    if (outcome.ok) {
      if (response === 'BACK') toast.success('Behind them', 'The club put its name to it.');
      else {
        toast.show({
          tone: 'neutral',
          title: 'Refused, plainly',
          description: 'At least they were told to their faces.',
        });
      }
    } else toast.error('Not possible', outcome.reason ?? 'That has run its course.');
  };

  return (
    <Screen
      title="Community"
      subtitle={`${trust.label} · ${formatCount(state.social.clubFollowers)} following`}
      onBack={() => navigate(SOCIAL_ROUTES.feed)}
      aside={
        <GlassPanel title="Supporters' trust" padding="md">
          <StatBlock
            label={trust.label}
            value={trust.value}
            unit="/100"
            tone={trust.value >= 60 ? 'positive' : trust.value <= 35 ? 'danger' : 'neutral'}
          />
          <ProgressBar
            value={trust.value}
            max={100}
            tone={trust.value >= 60 ? 'positive' : trust.value <= 35 ? 'danger' : 'warning'}
            className="mt-2"
          />
          <Text role="caption" as="p" className="mt-3 text-pretty">{trust.blurb}</Text>
        </GlassPanel>
      }
    >
      <div className="md:hidden">
        <GlassPanel title="Supporters' trust" padding="md">
          <StatBlock
            label={trust.label}
            value={trust.value}
            unit="/100"
            tone={trust.value >= 60 ? 'positive' : trust.value <= 35 ? 'danger' : 'neutral'}
          />
          <Text role="caption" as="p" className="mt-2 text-pretty">{trust.blurb}</Text>
        </GlassPanel>
      </div>

      {campaigns.length > 0 && (
        <section>
          <SectionHeader
            title="They have started something"
            subtitle="You did not ask for any of this. That is rather the point."
          />
          <div className="flex flex-col gap-3">
            {campaigns.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                state={state}
                onRespond={doRespond}
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionHeader
          title="Ask them something"
          subtitle="Running a poll buys trust. Overruling the answer costs far more than never running one."
        />
        {offered.length === 0 && open.length === 0 && closed.length === 0 ? (
          <GlassPanel padding="md">
            <EmptyState
              size="sm"
              icon={<IconFans />}
              title="No question worth asking this week"
              description="Polls come off the back of what has been happening — a signing, a bad run, a decision about the ground. Play on and one will appear."
            />
          </GlassPanel>
        ) : (
          <div className="flex flex-col gap-3">
            {[...offered, ...open, ...closed].map((poll) => (
              <PollCard
                key={poll.id}
                poll={poll}
                state={state}
                onRun={doRun}
                onDecline={doDecline}
                onSettle={doSettle}
              />
            ))}
          </div>
        )}
      </section>

      {fan && (
        <GlassPanel title="Fan of the week" padding="md" accent="volt">
          <div className="flex items-start gap-3">
            <CreatorAvatar seed={fan.avatarSeed} size={38} />
            <div className="min-w-0 flex-1">
              <NameText name={fan.name} role="bodyStrong" lines={2} />
              <NameText name={fan.handle} role="caption" lines={1} className="mt-0.5" />
              <Text role="body" as="p" className="mt-1.5 text-pretty">{fan.reason}</Text>
            </div>
          </div>
        </GlassPanel>
      )}

      <section>
        <SectionHeader
          title="Doors"
          subtitle="Every threshold changes who will do business with you. None of them makes your team better."
          action={
            viral.length > 0
              ? (
                <GlassButton variant="ghost" size="sm" onClick={() => setViralOpen(true)}>
                  Viral moments
                </GlassButton>
              )
              : undefined
          }
        />
        {next && (
          <GlassPanel padding="md" className="mb-3">
            <div className="flex items-baseline justify-between gap-2">
              <Text role="section" as="span">{next.milestone.label}</Text>
              <Text role="micro" as="span">{`${formatCount(next.remaining)} to go`}</Text>
            </div>
            <ProgressBar value={next.progress * 100} max={100} tone="volt" className="mt-2" />
            <ul className="mt-2.5 flex flex-col gap-1">
              {next.milestone.unlocks.map((unlock) => (
                <li key={unlock} className="flex gap-2">
                  <span aria-hidden="true" className="mt-0.5 shrink-0 text-volt [&_svg]:size-3.5"><IconInfo /></span>
                  <Text role="caption" as="span" className="text-pretty">{unlock}</Text>
                </li>
              ))}
            </ul>
          </GlassPanel>
        )}
        <div className="flex flex-col">
          {doors.map((door, index) => (
            <ListRow
              key={door.threshold}
              density="compact"
              divided={index < doors.length - 1}
              dimmed={!door.reached}
              leading={
                <span aria-hidden="true" className={door.reached ? 'text-volt [&_svg]:size-4' : 'text-ink-dim [&_svg]:size-4'}>
                  {door.reached ? <IconTrophy /> : <IconLock />}
                </span>
              }
              title={<NameText name={door.label} role="bodyStrong" lines={1} />}
              subtitle={door.unlocks[0] ?? 'A bigger room'}
              trailing={
                <GlassPill size="xs" tone={door.reached ? 'positive' : 'neutral'}>
                  {door.reached ? 'Open' : formatMoney(door.cash)}
                </GlassPill>
              }
            />
          ))}
        </div>
      </section>

      <GlassSheet
        open={viralOpen}
        onClose={() => setViralOpen(false)}
        title="When it got out"
        subtitle="Posts that escaped the football internet entirely."
        size="auto"
      >
        <div className="flex flex-col">
          {viral.map((moment, index) => (
            <ListRow
              key={moment.postId}
              density="regular"
              divided={index < viral.length - 1}
              title={<NameText name={moment.label} role="bodyStrong" lines={3} />}
              subtitle={`Matchweek ${moment.cycle} · ${formatCount(moment.reach)} extra impressions`}
              trailing={
                <GlassPill size="xs" tone={moment.sentiment >= 0 ? 'positive' : 'danger'}>
                  {`${moment.multiplier}×`}
                </GlassPill>
              }
            />
          ))}
        </div>
      </GlassSheet>
    </Screen>
  );
}

export function CommunityScreen(): ReactNode {
  const gate = useGameStatus();
  if (gate.status !== 'ready') return <GateScreen gate={gate} title="Community" />;
  return <CommunityView state={gate.state} />;
}
