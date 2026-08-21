import { useMemo, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  CREATOR_ATTRIBUTE_KEYS, CREATOR_ATTRIBUTE_LABELS, CREATOR_BALANCE, MANAGER_ATTRIBUTE_LABELS,
  creatorReach, declineCampaign, formatMoney, greenlightCampaign, liveFeuds, socialWorld,
  type Creator, type CreatorCampaign, type GameState, type Manager, type Player, type SocialPost,
} from '@cf/engine';
import {
  AttributeBar, ClubBadge, CreatorAvatar, CreatorCard, Divider, EmptyState, GlassButton,
  GlassPanel, GlassPill, IconSocial, IconWarning, KeyValueRow, ListRow, MomentumBar, MoneyLabel,
  PlayerCard, ProgressBar, Screen, SectionHeader, StatCard, StatGrid, Text, formatCount,
  useToast, NameText,
} from '@/design';
import { ROUTES, buildPath } from '@/app/routes';
import { GateScreen, useGameStatus } from './gate';
import { FeedItem } from './components/FeedItem';
import { useSocialAction, useSocialWorld } from './engine';

/**
 * A creator, in full.
 *
 * Creators are first-class entities in this game — they carry audiences,
 * opinions and grudges, and some of them also play or manage. So this screen is
 * built as a profile of a person rather than a stat block: who they are and how
 * they talk comes first, the numbers explain the influence, and their actual
 * output is right there at the bottom in their own words.
 */

const TIER_LABEL = {
  LOCAL: 'Local', RISING: 'Rising', ESTABLISHED: 'Established', MAJOR: 'Major', GLOBAL: 'Global',
} as const;

const TONE_BLURB: Record<Creator['style']['tone'], string> = {
  HYPE: 'Relentlessly positive. Everything is the greatest thing that has ever happened.',
  ANALYTICAL: 'Numbers first. Will explain why your win was actually a warning sign.',
  COMEDIC: 'Here for the bit. Your worst week is their best content.',
  PROVOCATIVE: 'Picks fights on purpose, because fights travel further than analysis.',
  WHOLESOME: 'Kind, and genuinely means it. Rare, and worth protecting.',
  DRAMATIC: 'Every result is a turning point. Every signing is a statement.',
};

const ROLE_LABEL: Record<string, string> = {
  PLAYER: 'Plays', MANAGER: 'Manages', INFLUENCER: 'Influencer',
  CLUB_PERSONALITY: 'Club personality', PUNDIT: 'Pundit', OWNER: 'Owner',
};

const relative = (now: number, then: number): string => {
  const delta = Math.max(0, now - then);
  if (delta === 0) return 'this week';
  if (delta === 1) return 'last week';
  return `${delta}w ago`;
};

const sentimentWord = (value: number): string => {
  if (value >= 60) return 'They are firmly on your side.';
  if (value >= 20) return 'Warm towards you, for now.';
  if (value > -20) return 'Neutral. They will follow the results.';
  if (value > -60) return 'Cool on your club, and it shows in their content.';
  return 'Openly hostile. Every bad week is a video.';
};

interface ViewProps {
  state: GameState;
  creator: Creator;
}

function CreatorView({ state, creator }: ViewProps): ReactNode {
  const navigate = useNavigate();
  const toast = useToast();
  const run = useSocialAction();
  useSocialWorld(state);

  const world = socialWorld(state);

  /**
   * The working relationship, not just the opinion.
   *
   * A creator's sentiment is mostly a function of whether the club gives them
   * anything to make, so the two are shown together: what is on the table, what
   * is in production, what has been delivered, and how long it has been since
   * anybody called. Losing your biggest creator should never be a surprise.
   */
  const briefs = useMemo(
    () => world.creatorCampaigns.filter(
      (c) => c.creatorId === creator.id && c.status === 'OFFERED' && c.expiresCycle > state.clock.cycle,
    ),
    [world.creatorCampaigns, creator.id, state.clock.cycle],
  );
  const inProduction = useMemo(
    () => world.creatorCampaigns.filter((c) => c.creatorId === creator.id && c.status === 'RUNNING'),
    [world.creatorCampaigns, creator.id],
  );
  const madeForUs = useMemo(
    () => world.creatorCampaigns
      .filter((c) => c.creatorId === creator.id && (c.status === 'DELIVERED' || c.status === 'FLOPPED'))
      .sort((a, b) => (b.deliveredCycle ?? 0) - (a.deliveredCycle ?? 0))
      .slice(0, 5),
    [world.creatorCampaigns, creator.id],
  );
  const lastWorked = useMemo(() => {
    let best = -999;
    for (const campaign of world.creatorCampaigns) {
      if (campaign.creatorId !== creator.id) continue;
      if (campaign.status !== 'DELIVERED' && campaign.status !== 'RUNNING') continue;
      best = Math.max(best, campaign.deliveredCycle ?? campaign.offeredCycle);
    }
    return best;
  }, [world.creatorCampaigns, creator.id]);
  const idleCycles = lastWorked < -900 ? null : state.clock.cycle - lastWorked;
  const feud = useMemo(
    () => liveFeuds(state).find((f) => f.aId === creator.id || f.bId === creator.id),
    [state, creator.id],
  );

  const commission = (campaignId: string): void => {
    const outcome = run((current) => greenlightCampaign(current, { campaignId, at: Date.now() }));
    if (outcome.ok) toast.success('In production', `${creator.displayName} starts this week.`);
    else toast.error('Not commissioned', outcome.reason ?? 'No longer available.');
  };
  const pass = (campaignId: string): void => {
    const outcome = run((current) => declineCampaign(current, { campaignId }));
    if (outcome.ok) {
      toast.show({ tone: 'neutral', title: 'Passed', description: 'They will remember it.' });
    } else toast.error('Not possible', outcome.reason ?? 'Already gone.');
  };

  const club = creator.clubId ? state.clubs[creator.clubId] : undefined;
  const player: Player | undefined = creator.playerId ? state.players[creator.playerId] : undefined;
  const manager: Manager | undefined = useMemo(
    () => Object.values(state.managers).find((m) => m.creatorId === creator.id),
    [state.managers, creator.id],
  );

  /** Their own output: posts they wrote, newest first. */
  const content = useMemo<SocialPost[]>(
    () =>
      state.social.posts
        .filter((post) => post.authorHandle === creator.handle)
        .sort((a, b) => b.cycle - a.cycle)
        .slice(0, 10),
    [state.social.posts, creator.handle],
  );

  /** What that output actually did — a tally, not an estimate. */
  const impact = useMemo(() => {
    let likes = 0;
    let reposts = 0;
    let replies = 0;
    for (const post of state.social.posts) {
      if (post.authorHandle !== creator.handle) continue;
      likes += post.likes;
      reposts += post.reposts;
      replies += post.replies;
    }
    return { likes, reposts, replies, posts: content.length };
  }, [state.social.posts, creator.handle, content.length]);

  /**
   * Relationships are read off the world rather than stored: who shares their
   * club, and who they have publicly argued with in the feed.
   */
  const relationships = useMemo(() => {
    const colleagues = Object.values(state.creators).filter(
      (other) => other.id !== creator.id && other.clubId !== null && other.clubId === creator.clubId,
    );
    const sparring = new Map<string, Creator>();
    for (const post of state.social.posts) {
      const quoted = post.quoted;
      if (!quoted) continue;
      const involvesThem =
        post.authorHandle === creator.handle || quoted.authorName === creator.displayName;
      if (!involvesThem) continue;
      const otherName =
        post.authorHandle === creator.handle ? quoted.authorName : post.authorName;
      const other = Object.values(state.creators).find((c) => c.displayName === otherName);
      if (other && other.id !== creator.id) sparring.set(other.id, other);
    }
    return { colleagues: colleagues.slice(0, 6), sparring: [...sparring.values()].slice(0, 6) };
  }, [state.creators, state.social.posts, creator]);

  const reach = creatorReach(creator);
  const ourClub = state.clubs[state.playerClubId];

  return (
    <Screen
      title={creator.displayName}
      subtitle={`${creator.handle} · ${TIER_LABEL[creator.tier]}`}
      onBack={() => navigate(ROUTES.social)}
      aside={
        <>
          <GlassPanel title="Where they stand on you" padding="md">
            <MomentumBar
              value={Math.max(-1, Math.min(1, creator.clubSentiment / 100))}
              homeLabel="Onside"
              awayLabel="Hostile"
              homeColor={ourClub?.visual.primary ?? '#c8ff2e'}
              awayColor="#f4525a"
            />
            <p className="mt-2 text-[13px] leading-relaxed text-ink-muted text-pretty">
              {sentimentWord(creator.clubSentiment)}
            </p>
            {club && (
              <>
                <Divider className="my-3" />
                <div className="flex items-center gap-2.5">
                  <ClubBadge visual={club.visual} size={28} label={club.name} />
                  <div className="min-w-0 flex-1">
                    <NameText
                      name={club.name}
                      short={club.shortName}
                      abbr={club.abbreviation}
                      role="bodyStrong"
                      lines={2}
                    />
                    <p className="text-[11px] uppercase tracking-[0.14em] text-ink-dim">
                      {creator.dealWeeksRemaining === null
                        ? 'No fixed term'
                        : `${creator.dealWeeksRemaining} weeks left`}
                    </p>
                  </div>
                </div>
              </>
            )}
          </GlassPanel>

          <GlassPanel title="What they are worth" padding="md">
            <KeyValueRow label="Market value" value={<MoneyLabel amount={creator.marketValue} size="md" />} />
            <KeyValueRow label="Brand value" value={Math.round(creator.attributes.brandValue)} />
            <KeyValueRow label="Commercial appeal" value={Math.round(creator.attributes.commercialAppeal)} divided={false} />
            <p className="mt-2 text-[12px] leading-relaxed text-ink-dim text-pretty">
              Brand value gates the sponsor tiers your club can reach. A creator is a commercial
              asset as much as a sporting one.
            </p>
          </GlassPanel>
        </>
      }
    >
      <GlassPanel padding="lg">
        <div className="flex items-start gap-4">
          <CreatorAvatar seed={creator.avatarSeed} size={72} verified={creator.tier !== 'LOCAL'} />
          <div className="min-w-0 flex-1">
            <p className="font-display text-[24px] font-bold leading-tight text-ink">
              {creator.displayName}
            </p>
            <p className="text-[13px] text-ink-dim">{creator.handle}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <GlassPill tone="volt" size="xs" filled>{TIER_LABEL[creator.tier]}</GlassPill>
              {creator.roles.map((role) => (
                <GlassPill key={role} size="xs">{ROLE_LABEL[role] ?? role}</GlassPill>
              ))}
            </div>
          </div>
        </div>
        <p className="mt-3 text-[14px] leading-relaxed text-ink-muted text-pretty">{creator.bio}</p>
      </GlassPanel>

      <WorkingRelationship
        creator={creator}
        state={state}
        briefs={briefs}
        inProduction={inProduction}
        madeForUs={madeForUs}
        idleCycles={idleCycles}
        feudCause={feud?.cause ?? null}
        onCommission={commission}
        onPass={pass}
      />

      <StatGrid columns={3}>
        <StatCard label="Followers" value={formatCount(creator.followers)} size="sm" icon={<IconSocial />} />
        <StatCard label="Reach per post" value={formatCount(reach)} size="sm" />
        <StatCard label="Engagement" value={Math.round(creator.attributes.engagement)} size="sm" />
      </StatGrid>

      <GlassPanel title="How they talk" padding="md">
        <p className="text-[15px] font-semibold text-ink">{creator.style.tone.toLowerCase()}</p>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-muted text-pretty">
          {TONE_BLURB[creator.style.tone]}
        </p>
        <Divider className="my-3" />
        <div className="flex flex-wrap gap-1.5">
          {creator.style.platforms.map((platform) => (
            <GlassPill key={platform} size="xs">{platform.toLowerCase()}</GlassPill>
          ))}
        </div>
        <ProgressBar
          className="mt-3"
          value={Math.min(100, Math.round(creator.style.postingFrequency * 100))}
          tone="volt"
          size="xs"
          label="Posting frequency"
        />
        <ProgressBar
          className="mt-2"
          value={Math.round(creator.attributes.controversy)}
          tone={creator.attributes.controversy > 65 ? 'danger' : 'warning'}
          size="xs"
          label="Controversy"
          valueLabel={creator.attributes.controversy > 65 ? 'Volatile' : 'Manageable'}
        />
      </GlassPanel>

      {player && (
        <div>
          <SectionHeader
            title="On the pitch"
            subtitle="This creator also plays"
            className="mb-2"
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <PlayerCard
              player={player}
              {...(club ? { club: { name: club.shortName, abbreviation: club.abbreviation, visual: club.visual } } : {})}
              variant="standard"
            />
            <GlassPanel padding="md" className="col-span-1 sm:col-span-2">
              <KeyValueRow label="Overall" value={player.overall} />
              <KeyValueRow label="Goals" value={player.form.goals} />
              <KeyValueRow label="Assists" value={player.form.assists} />
              <KeyValueRow label="Appearances" value={player.form.appearances} />
              <KeyValueRow label="Morale" value={Math.round(player.mental.morale)} divided={false} />
            </GlassPanel>
          </div>
        </div>
      )}

      {manager && (
        <GlassPanel title="In the dugout" padding="md">
          <p className="text-[15px] font-semibold text-ink">{manager.name}</p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-muted text-pretty">{manager.bio}</p>
          <Divider className="my-3" />
          <div className="flex flex-col gap-2.5">
            <AttributeBar label={MANAGER_ATTRIBUTE_LABELS.tacticalKnowledge} value={manager.attributes.tacticalKnowledge} emphasis />
            <AttributeBar label={MANAGER_ATTRIBUTE_LABELS.motivation} value={manager.attributes.motivation} />
            <AttributeBar label={MANAGER_ATTRIBUTE_LABELS.mediaHandling} value={manager.attributes.mediaHandling} />
            <AttributeBar label={MANAGER_ATTRIBUTE_LABELS.brandBuilding} value={manager.attributes.brandBuilding} />
          </div>
          <KeyValueRow
            className="mt-3"
            label="Record"
            value={`${manager.careerWins}W ${manager.careerDraws}D ${manager.careerLosses}L`}
            divided={false}
          />
        </GlassPanel>
      )}

      <GlassPanel title="Attributes" padding="md">
        <div className="flex flex-col gap-2.5">
          {CREATOR_ATTRIBUTE_KEYS.map((key) => (
            <AttributeBar
              key={key}
              label={CREATOR_ATTRIBUTE_LABELS[key]}
              value={creator.attributes[key]}
              emphasis={key === 'audience' || key === 'engagement' || key === 'brandValue'}
            />
          ))}
        </div>
      </GlassPanel>

      <GlassPanel title="Social impact" padding="md">
        <StatGrid columns={3}>
          <StatCard label="Posts" value={impact.posts} nested level={1} size="sm" />
          <StatCard label="Likes" value={formatCount(impact.likes)} nested level={1} size="sm" />
          <StatCard label="Reposts" value={formatCount(impact.reposts)} nested level={1} size="sm" />
        </StatGrid>
        <p className="mt-3 text-[12px] leading-relaxed text-ink-dim text-pretty">
          Counted from posts that actually appeared in the world feed. Nothing here is a projection.
        </p>
      </GlassPanel>

      {(relationships.colleagues.length > 0 || relationships.sparring.length > 0) && (
        <div>
          <SectionHeader title="Relationships" subtitle="Read off the world, not stored" className="mb-2" />
          {relationships.colleagues.length > 0 && (
            <>
              <p className="mb-2 text-[12px] uppercase tracking-[0.14em] text-ink-dim">Same club</p>
              <div className="flex flex-col gap-2">
                {relationships.colleagues.map((other) => (
                  <CreatorCard
                    key={other.id}
                    creator={other}
                    variant="compact"
                    onPress={(id) => navigate(buildPath(ROUTES.creator, { creatorId: id }))}
                  />
                ))}
              </div>
            </>
          )}
          {relationships.sparring.length > 0 && (
            <>
              <p className="mb-2 mt-3 text-[12px] uppercase tracking-[0.14em] text-ink-dim">
                Has argued with
              </p>
              <div className="flex flex-col gap-2">
                {relationships.sparring.map((other) => (
                  <CreatorCard
                    key={other.id}
                    creator={other}
                    variant="compact"
                    onPress={(id) => navigate(buildPath(ROUTES.creator, { creatorId: id }))}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <div>
        <SectionHeader title="Recent content" subtitle="In their own words" className="mb-2" />
        {content.length === 0 ? (
          <EmptyState
            size="sm"
            icon={<IconSocial />}
            title="They have not posted yet"
            description="Creators post about things that happen. Give them something to talk about."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {content.map((post) => (
              <FeedItem
                key={post.id}
                post={post}
                timeLabel={relative(state.clock.cycle, post.cycle)}
                hasEvent={false}
                onOpenEvent={() => undefined}
              />
            ))}
          </div>
        )}
      </div>
    </Screen>
  );
}

export function CreatorProfileScreen(): ReactNode {
  const gate = useGameStatus();
  const navigate = useNavigate();
  const params = useParams();

  if (gate.status !== 'ready') return <GateScreen gate={gate} title="Creator" />;

  const creator = gate.state.creators[params.creatorId ?? ''];
  if (!creator) {
    return (
      <Screen title="Creator" onBack={() => navigate(ROUTES.social)}>
        <EmptyState
          icon={<IconSocial />}
          title="No such creator"
          description="They may have been part of a content pack that is no longer installed."
          action={
            <GlassButton variant="secondary" onClick={() => navigate(ROUTES.social)}>
              Back to the feed
            </GlassButton>
          }
        />
      </Screen>
    );
  }

  return <CreatorView state={gate.state} creator={creator} />;
}

/**
 * The working relationship.
 *
 * Separated out because it is a different question from "who is this person" —
 * it is "what have we actually done together, and when did anybody last call".
 * Neglect is the failure mode a creator-owned club really has, so the counter
 * is shown plainly rather than hidden behind a sentiment bar.
 */
function WorkingRelationship({
  creator, state, briefs, inProduction, madeForUs, idleCycles, feudCause, onCommission, onPass,
}: {
  creator: Creator;
  state: GameState;
  briefs: readonly CreatorCampaign[];
  inProduction: readonly CreatorCampaign[];
  madeForUs: readonly CreatorCampaign[];
  idleCycles: number | null;
  feudCause: string | null;
  onCommission: (id: string) => void;
  onPass: (id: string) => void;
}): ReactNode {
  const ours = creator.clubId === state.playerClubId;
  const neglected = ours && idleCycles !== null && idleCycles > CREATOR_BALANCE.sentiment.neglectAfter;
  const never = ours && idleCycles === null;

  return (
    <GlassPanel
      title="Working relationship"
      padding="md"
      accent={neglected || never ? 'danger' : 'volt'}
    >
      <div className="flex flex-wrap items-center gap-2">
        <GlassPill
          size="xs"
          tone={creator.clubSentiment >= 25 ? 'positive'
            : creator.clubSentiment <= CREATOR_BALANCE.roster.unhappyAt ? 'danger' : 'warning'}
          filled
        >
          {creator.clubSentiment >= 25 ? 'Happy here'
            : creator.clubSentiment <= CREATOR_BALANCE.roster.unhappyAt ? 'Looking to leave' : 'Restless'}
        </GlassPill>
        {ours && (
          <Text role="micro" as="span">
            {never
              ? 'You have never given them anything to make'
              : `Last worked together ${idleCycles} ${idleCycles === 1 ? 'week' : 'weeks'} ago`}
          </Text>
        )}
      </div>

      {feudCause && (
        <div className="mt-2.5 flex gap-2 rounded-md bg-danger/12 p-2">
          <span aria-hidden="true" className="mt-0.5 shrink-0 text-danger [&_svg]:size-3.5"><IconWarning /></span>
          <Text role="caption" as="p" className="text-pretty text-danger">
            {`In a public feud. ${feudCause}`}
          </Text>
        </div>
      )}

      {briefs.length > 0 && (
        <>
          <Divider label="They want to make something" />
          <div className="flex flex-col gap-2.5">
            {briefs.map((brief) => (
              <div key={brief.id} className="glass-1 rounded-md p-2.5">
                <div className="flex items-center gap-2">
                  <Text role="label" as="span">{CREATOR_BALANCE.formats[brief.format].label}</Text>
                  <GlassPill size="xs" tone="neutral">{formatMoney(brief.cost)}</GlassPill>
                  <span className="ml-auto shrink-0">
                    <Text role="micro" as="span">{`${formatCount(brief.projectedReach)} projected`}</Text>
                  </span>
                </div>
                <Text role="caption" as="p" className="mt-1 text-pretty">{brief.brief}</Text>
                <div className="mt-2 flex gap-2">
                  <GlassButton variant="secondary" size="sm" onClick={() => onPass(brief.id)}>Pass</GlassButton>
                  <GlassButton variant="primary" size="sm" block onClick={() => onCommission(brief.id)}>
                    Commission
                  </GlassButton>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {inProduction.length > 0 && (
        <>
          <Divider label="In production" />
          {inProduction.map((campaign) => (
            <div key={campaign.id} className="mt-1">
              <div className="flex items-baseline justify-between gap-2">
                <Text role="label" as="span">{campaign.title}</Text>
                <Text role="micro" as="span">{`${campaign.cyclesRemaining} to go`}</Text>
              </div>
              <ProgressBar
                value={campaign.totalCycles - campaign.cyclesRemaining}
                max={campaign.totalCycles}
                tone="volt"
                size="xs"
                className="mt-1"
              />
            </div>
          ))}
        </>
      )}

      {madeForUs.length > 0 && (
        <>
          <Divider label="What they have made for you" />
          <div className="flex flex-col">
            {madeForUs.map((campaign, index) => (
              <ListRow
                key={campaign.id}
                density="compact"
                divided={index < madeForUs.length - 1}
                title={<NameText name={campaign.title} role="bodyStrong" lines={2} />}
                subtitle={`Matchweek ${campaign.deliveredCycle ?? campaign.offeredCycle}`}
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
        </>
      )}

      {briefs.length === 0 && inProduction.length === 0 && madeForUs.length === 0 && (
        <Text role="caption" as="p" className="mt-2 text-ink-dim text-pretty">
          Nothing has been made together yet. Creators bring briefs off the back of results,
          signings and rows — give them something worth filming.
        </Text>
      )}
    </GlassPanel>
  );
}
