import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CREATOR_BALANCE, campaignOffers, clubCreators, creatorInterest, creatorReach, declineCampaign,
  deliveredCampaigns, formatMoney, greenlightCampaign, liveFeuds, releaseCreator, runningCampaigns,
  signCreator, socialWorld, unlockedCreatorTiers,
  type Creator, type CreatorCampaign, type CreatorInterest, type GameState,
} from '@cf/engine';
import {
  CardRail, CreatorAvatar, Divider, EmptyState, GlassButton, GlassPanel, GlassPill, GlassSheet,
  IconInfo, IconLock, IconSocial, IconWarning, ListRow, NameText, ProgressBar, Screen,
  SectionHeader, StatBlock, Text, cn, formatCount, useToast,
} from '@/design';
import { ROUTES, buildPath } from '@/app/routes';
import { SOCIAL_ROUTES } from './routes';
import { GateScreen, useGameStatus } from './gate';
import { useSocialAction, useSocialWorld } from './engine';

/**
 * The creator desk.
 *
 * This is the screen that makes the game about a creator-owned club rather than
 * about football with a feed attached. Four things live here and they are all
 * the same loop seen from different angles.
 *
 * **Briefs.** A creator wants to make something *about a specific thing that
 * happened* — never about nothing. It costs real money through the ledger, it
 * takes real weeks, and the risk of it landing badly is stated up front.
 *
 * **The roster.** Who will work with you at all, gated on your own audience,
 * which is what turns a follower milestone into a door.
 *
 * **Relationships.** A creator who is never given work drifts, then sours, then
 * leaves and takes their audience with them. The neglect counter is visible,
 * because a club losing its biggest creator should never be a surprise.
 *
 * **Feuds.** Two creators who cannot let it go. Excellent for reach, corrosive
 * for everything else.
 */

const RISK_LABEL = (risk: number): { label: string; tone: 'positive' | 'warning' | 'danger' } => {
  if (risk <= 0.15) return { label: 'Low risk', tone: 'positive' };
  if (risk <= 0.3) return { label: 'Some risk', tone: 'warning' };
  return { label: 'High risk', tone: 'danger' };
};

function BriefCard({
  state, campaign, onGreenlight, onDecline,
}: {
  state: GameState;
  campaign: CreatorCampaign;
  onGreenlight: (id: string) => void;
  onDecline: (id: string) => void;
}): ReactNode {
  const creator = state.creators[campaign.creatorId];
  const format = CREATOR_BALANCE.formats[campaign.format];
  const risk = RISK_LABEL(campaign.risk);
  return (
    <article className="glass-1 raised rounded-lg p-3.5">
      <div className="flex items-start gap-3">
        {creator && <CreatorAvatar seed={creator.avatarSeed} size={36} verified={creator.tier === 'GLOBAL'} />}
        <div className="min-w-0 flex-1">
          <NameText name={creator?.displayName ?? 'A creator'} role="bodyStrong" lines={2} />
          <Text role="caption" as="p" className="mt-0.5">{format.label}</Text>
        </div>
        <GlassPill size="xs" tone={risk.tone}>{risk.label}</GlassPill>
      </div>

      <Text role="body" as="p" className="mt-2.5 text-pretty">{campaign.brief}</Text>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <StatBlock label="Cost" value={formatMoney(campaign.cost)} tone={campaign.cost > 0 ? 'warning' : 'positive'} />
        <StatBlock label="Projected" value={formatCount(campaign.projectedReach)} caption="impressions" tone="volt" />
        <StatBlock
          label="Takes"
          value={campaign.totalCycles}
          unit={campaign.totalCycles === 1 ? 'week' : 'weeks'}
        />
      </div>

      {campaign.sponsorFee > 0 && (
        <div className="mt-2.5 flex gap-2 rounded-md bg-positive/10 p-2">
          <span aria-hidden="true" className="mt-0.5 shrink-0 text-positive [&_svg]:size-3.5"><IconInfo /></span>
          <Text role="caption" as="p" className="text-pretty text-positive">
            {`${campaign.sponsorName ?? 'A brand'} pay ${formatMoney(campaign.sponsorFee)} on delivery — and only a third of it if this lands badly.`}
          </Text>
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <GlassButton variant="secondary" size="sm" onClick={() => onDecline(campaign.id)}>
          Pass
        </GlassButton>
        <GlassButton variant="primary" size="sm" block onClick={() => onGreenlight(campaign.id)}>
          {campaign.cost > 0 ? `Commission for ${formatMoney(campaign.cost)}` : 'Commission it'}
        </GlassButton>
      </div>
    </article>
  );
}

function CreatorHubView({ state }: { state: GameState }): ReactNode {
  const navigate = useNavigate();
  const toast = useToast();
  const run = useSocialAction();
  useSocialWorld(state);

  const world = socialWorld(state);
  const offers = useMemo(() => campaignOffers(state), [state]);
  const running = useMemo(() => runningCampaigns(state), [state]);
  const delivered = useMemo(() => deliveredCampaigns(state).slice(0, 6), [state]);
  const roster = useMemo(() => clubCreators(state, state.playerClubId), [state]);
  const interest = useMemo(() => creatorInterest(state), [state]);
  const feuds = useMemo(() => liveFeuds(state), [state]);
  const tiers = useMemo(() => unlockedCreatorTiers(state), [state]);
  const [signing, setSigning] = useState<CreatorInterest | null>(null);
  const [releasing, setReleasing] = useState<Creator | null>(null);

  const lastWorked = useMemo(() => {
    const map = new Map<string, number>();
    for (const campaign of world.creatorCampaigns) {
      if (campaign.status !== 'DELIVERED' && campaign.status !== 'RUNNING') continue;
      const cycle = campaign.deliveredCycle ?? campaign.offeredCycle;
      if ((map.get(campaign.creatorId) ?? -999) < cycle) map.set(campaign.creatorId, cycle);
    }
    return map;
  }, [world.creatorCampaigns]);

  const greenlight = (id: string): void => {
    const outcome = run((current) => greenlightCampaign(current, { campaignId: id, at: Date.now() }));
    if (outcome.ok) toast.success('In production', 'They start this week.');
    else toast.error('Not commissioned', outcome.reason ?? 'That is no longer available.');
  };

  const decline = (id: string): void => {
    const outcome = run((current) => declineCampaign(current, { campaignId: id }));
    if (outcome.ok) {
      toast.show({ tone: 'neutral', title: 'Passed', description: 'They will remember being turned down.' });
    } else toast.error('Not possible', outcome.reason ?? 'Already gone.');
  };

  const sign = (row: CreatorInterest): void => {
    const outcome = run((current) => signCreator(current, { creatorId: row.creator.id, at: Date.now() }));
    setSigning(null);
    if (outcome.ok) toast.success(`${row.creator.displayName} is in`, 'They start posting about you immediately.');
    else toast.error('Not signed', outcome.reason ?? 'They said no.');
  };

  const release = (creator: Creator): void => {
    const outcome = run((current) => releaseCreator(current, { creatorId: creator.id, at: Date.now() }));
    setReleasing(null);
    if (outcome.ok) {
      toast.show({
        tone: 'warning',
        title: 'Released',
        description: 'The rest of the roster has already heard about it.',
      });
    } else toast.error('Not possible', outcome.reason ?? 'Not one of yours.');
  };

  const totalReach = roster.reduce((sum, c) => sum + creatorReach(c), 0);

  return (
    <Screen
      title="Creators"
      subtitle={`${roster.length} on the books · ${formatCount(totalReach)} combined reach`}
      onBack={() => navigate(SOCIAL_ROUTES.feed)}
      aside={
        <GlassPanel title="Who will take the call" padding="md">
          <ul className="flex flex-col gap-2">
            {tiers.map((tier) => (
              <li key={tier.tier} className="flex items-center gap-2">
                <GlassPill size="xs" tone={tier.open ? 'positive' : 'neutral'} filled={tier.open}>
                  {tier.tier.charAt(0) + tier.tier.slice(1).toLowerCase()}
                </GlassPill>
                <Text role="caption" as="span" className="min-w-0 flex-1 text-pretty">
                  {tier.open ? 'Open to you' : `Needs ${formatCount(tier.needed)} followers`}
                </Text>
                {!tier.open && (
                  <span aria-hidden="true" className="shrink-0 text-ink-dim [&_svg]:size-3.5"><IconLock /></span>
                )}
              </li>
            ))}
          </ul>
          <Text role="caption" as="p" className="mt-3 text-ink-dim text-pretty">
            Reach is not fandom and fandom is not revenue. Each of these doors changes who will do
            business with you, not how good your team is.
          </Text>
        </GlassPanel>
      }
    >
      {offers.length > 0 ? (
        <section>
          <SectionHeader
            title="On the table"
            subtitle="Every brief is about something that actually happened. Nobody turns up wanting to make a video about nothing."
          />
          <div className="flex flex-col gap-3">
            {offers.map((campaign) => (
              <BriefCard
                key={campaign.id}
                state={state}
                campaign={campaign}
                onGreenlight={greenlight}
                onDecline={decline}
              />
            ))}
          </div>
        </section>
      ) : (
        <GlassPanel padding="md">
          <EmptyState
            size="sm"
            icon={<IconSocial />}
            title="Nobody is pitching this week"
            description="Creators bring briefs off the back of results, signings and rows. Give them something to make a video about."
          />
        </GlassPanel>
      )}

      {running.length > 0 && (
        <section>
          <SectionHeader title="In production" subtitle="Commissioned, paid for, and not finished yet." />
          <div className="flex flex-col">
            {running.map((campaign, index) => {
              const creator = state.creators[campaign.creatorId];
              const done = campaign.totalCycles - campaign.cyclesRemaining;
              return (
                <ListRow
                  key={campaign.id}
                  density="regular"
                  divided={index < running.length - 1}
                  leading={creator ? <CreatorAvatar seed={creator.avatarSeed} size={32} /> : undefined}
                  title={<NameText name={campaign.title} role="bodyStrong" lines={2} />}
                  subtitle={`${creator?.displayName ?? 'A creator'} · ${campaign.cyclesRemaining} to go`}
                  trailing={
                    <span className="w-20">
                      <ProgressBar value={done} max={campaign.totalCycles} tone="volt" size="xs" />
                    </span>
                  }
                />
              );
            })}
          </div>
        </section>
      )}

      {feuds.length > 0 && (
        <GlassPanel title="Ongoing feuds" padding="md" accent="danger">
          <div className="flex flex-col">
            {feuds.map((feud, index) => (
              <ListRow
                key={feud.id}
                density="compact"
                divided={index < feuds.length - 1}
                leading={<span aria-hidden="true" className="text-danger [&_svg]:size-4"><IconWarning /></span>}
                title={
                  <NameText
                    name={`${state.creators[feud.aId]?.displayName ?? 'Somebody'} v ${state.creators[feud.bId]?.displayName ?? 'somebody'}`}
                    role="bodyStrong"
                    lines={2}
                  />
                }
                subtitle={feud.cause}
                trailing={<GlassPill size="xs" tone="danger">{`Heat ${Math.round(feud.heat)}`}</GlassPill>}
              />
            ))}
          </div>
          <Text role="caption" as="p" className="mt-3 text-ink-dim text-pretty">
            A feud is very good for reach and very bad for everything else. It ends in a settlement
            or in somebody leaving.
          </Text>
        </GlassPanel>
      )}

      <section>
        <SectionHeader
          title="Your roster"
          subtitle="A creator who is never given work drifts, then sours, then walks."
        />
        {roster.length === 0 ? (
          <GlassPanel padding="md">
            <EmptyState
              size="sm"
              icon={<IconSocial />}
              title="Nobody is attached to this club"
              description="Sign somebody below. Their audience is not yours, but it is the only route to one."
            />
          </GlassPanel>
        ) : (
          <div className="flex flex-col">
            {roster.map((creator, index) => {
              // A creator who has never been commissioned has been idle since
              // the save began, not since a sentinel. Falling back to -99 made
              // a brand-new club read "99 weeks without work" in week one.
              const idle = state.clock.cycle - (lastWorked.get(creator.id) ?? 0);
              const neglected = idle > CREATOR_BALANCE.sentiment.neglectAfter;
              return (
                <ListRow
                  key={creator.id}
                  density="relaxed"
                  divided={index < roster.length - 1}
                  leading={<CreatorAvatar seed={creator.avatarSeed} size={38} verified={creator.tier === 'GLOBAL'} />}
                  title={<NameText name={creator.displayName} role="bodyStrong" lines={2} />}
                  subtitle={`${formatCount(creator.followers)} followers · ${creator.tier.toLowerCase()}`}
                  trailing={
                    <div className="flex flex-col items-end gap-1">
                      <GlassPill
                        size="xs"
                        tone={creator.clubSentiment >= 25 ? 'positive'
                          : creator.clubSentiment <= CREATOR_BALANCE.roster.unhappyAt ? 'danger' : 'warning'}
                      >
                        {creator.clubSentiment >= 25 ? 'Happy'
                          : creator.clubSentiment <= CREATOR_BALANCE.roster.unhappyAt ? 'Looking to leave' : 'Restless'}
                      </GlassPill>
                      {neglected && <Text role="micro" as="span">{`${idle}w without work`}</Text>}
                    </div>
                  }
                  chevron
                  onPress={() => navigate(buildPath(ROUTES.creator, { creatorId: creator.id }))}
                />
              );
            })}
          </div>
        )}
        {roster.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {roster.map((creator) => (
              <GlassButton
                key={creator.id}
                variant="ghost"
                size="sm"
                onClick={() => setReleasing(creator)}
              >
                {`Release ${creator.displayName}`}
              </GlassButton>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeader
          title="Who else is out there"
          subtitle="Gated on your own audience, because that is how this works in reality."
        />
        <CardRail ariaLabel="Creators who might sign">
          {interest.slice(0, 12).map((row) => (
            <button
              key={row.creator.id}
              type="button"
              onClick={() => setSigning(row)}
              className={cn(
                'glass-1 raised w-52 shrink-0 rounded-lg p-3 text-left',
                !row.available && 'opacity-70',
              )}
            >
              <CreatorAvatar seed={row.creator.avatarSeed} size={34} verified={row.creator.tier === 'GLOBAL'} />
              <NameText name={row.creator.displayName} role="bodyStrong" lines={2} className="mt-2" />
              <Text role="caption" as="p" className="mt-0.5">
                {`${formatCount(row.creator.followers)} followers`}
              </Text>
              <div className="mt-2">
                <GlassPill size="xs" tone={row.available ? 'positive' : 'neutral'}>
                  {row.available ? formatMoney(row.signingFee) : 'Out of reach'}
                </GlassPill>
              </div>
              <Text role="caption" as="p" className="mt-1.5 text-pretty" clamp={3}>{row.reason}</Text>
            </button>
          ))}
        </CardRail>
      </section>

      {delivered.length > 0 && (
        <section>
          <SectionHeader title="What you have made" subtitle="Impressions, and the far smaller number of followers they became." />
          <div className="flex flex-col">
            {delivered.map((campaign, index) => (
              <ListRow
                key={campaign.id}
                density="regular"
                divided={index < delivered.length - 1}
                title={<NameText name={campaign.title} role="bodyStrong" lines={2} />}
                subtitle={`${state.creators[campaign.creatorId]?.displayName ?? 'A creator'} · matchweek ${campaign.deliveredCycle ?? campaign.offeredCycle}`}
                trailing={
                  <div className="flex flex-col items-end">
                    <GlassPill size="xs" tone={campaign.status === 'DELIVERED' ? 'positive' : 'danger'}>
                      {campaign.status === 'DELIVERED' ? 'Landed' : 'Flopped'}
                    </GlassPill>
                    <Text role="micro" as="span" className="mt-0.5">
                      {`${formatCount(campaign.deliveredReach ?? 0)} → ${formatCount(campaign.followerGain ?? 0)}`}
                    </Text>
                  </div>
                }
              />
            ))}
          </div>
        </section>
      )}

      <GlassSheet
        open={signing !== null}
        onClose={() => setSigning(null)}
        title={signing ? `Sign ${signing.creator.displayName}?` : 'Sign a creator'}
        subtitle={signing?.creator.bio}
        size="auto"
        footer={
          signing?.available ? (
            <GlassButton variant="primary" size="lg" block onClick={() => sign(signing)}>
              {`Sign for ${formatMoney(signing.signingFee)}`}
            </GlassButton>
          ) : undefined
        }
      >
        {signing && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <StatBlock label="Followers" value={formatCount(signing.creator.followers)} tone="volt" />
              <StatBlock label="Reach per post" value={formatCount(creatorReach(signing.creator))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <StatBlock label="Signing fee" value={formatMoney(signing.signingFee)} tone="warning" />
              <StatBlock label="Retainer" value={formatMoney(signing.retainerPerCycle)} caption="per week" />
            </div>
            <Divider label="Where they stand" />
            <Text role="body" as="p" className="text-pretty">{signing.reason}</Text>
            <Text role="caption" as="p" className="text-ink-dim text-pretty">
              Signing somebody is the easy half. Keeping them means giving them work — a creator who
              makes nothing about you for a month starts looking for the exit.
            </Text>
          </div>
        )}
      </GlassSheet>

      <GlassSheet
        open={releasing !== null}
        onClose={() => setReleasing(null)}
        title="Release this creator?"
        subtitle="Everybody else on the roster will hear about it."
        size="auto"
        footer={
          <div className="flex gap-2">
            <GlassButton variant="secondary" size="lg" block onClick={() => setReleasing(null)}>
              Keep them
            </GlassButton>
            <GlassButton variant="danger" size="lg" block onClick={() => releasing && release(releasing)}>
              Release
            </GlassButton>
          </div>
        }
      >
        <Text role="body" as="p" className="text-pretty">
          They keep their audience, they keep their opinion of you, and both of those are about to
          get considerably worse. The rest of the roster takes it personally.
        </Text>
      </GlassSheet>
    </Screen>
  );
}

export function CreatorHubScreen(): ReactNode {
  const gate = useGameStatus();
  if (gate.status !== 'ready') return <GateScreen gate={gate} title="Creators" />;
  return <CreatorHubView state={gate.state} />;
}
