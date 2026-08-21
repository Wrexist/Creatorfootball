import { memo, type ReactNode } from 'react';
import {
  punditSummary, rumourAccuracy, socialWorld,
  type GameState, type RumourItem, type ShowSegment,
} from '@cf/engine';
import {
  CreatorAvatar, Divider, GlassPanel, GlassPill, ListRow, NameText, ProgressBar,
  SectionHeader, StatBlock, Text, cn,
} from '@/design';

/**
 * The week, rated — and the man with a running argument about your club.
 *
 * The show's number is arithmetic over results, reach, fan mood and how the
 * club conducted itself, so a 0-0 in a week you handled well genuinely rates
 * higher than a win in a week you spent arguing with your own supporters.
 *
 * The pundit is the piece that makes the world feel like it remembers. His
 * thesis is stated, dated, and then *checked* every week: the results either
 * back him or embarrass him, and the tally is on the card. He is a character
 * with a record rather than a sentiment generator.
 */

const SEGMENT_TONE: Record<ShowSegment['tone'], 'positive' | 'danger' | 'neutral'> = {
  GOOD: 'positive', BAD: 'danger', NEUTRAL: 'neutral',
};

const RATING_TONE = (rating: number): 'positive' | 'warning' | 'danger' =>
  (rating >= 7 ? 'positive' : rating >= 4.5 ? 'warning' : 'danger');

export const WeeklyShowPanel = memo(function WeeklyShowPanel({
  state, onOpenEvent,
}: { state: GameState; onOpenEvent?: (eventId: string) => void }): ReactNode {
  const show = socialWorld(state).show;
  if (!show) return null;
  const guest = show.guestCreatorId ? state.creators[show.guestCreatorId] : undefined;

  return (
    <GlassPanel title={show.title} padding="md" accent="volt">
      <div className="flex items-start gap-3">
        <div className="shrink-0">
          <StatBlock
            label="This week"
            value={show.rating.toFixed(1)}
            unit="/10"
            size="lg"
            tone={RATING_TONE(show.rating)}
          />
        </div>
        <div className="min-w-0 flex-1">
          <Text role="body" as="p" className="text-pretty">{show.verdict}</Text>
          {guest && (
            <div className="mt-2 flex items-center gap-2">
              <CreatorAvatar seed={guest.avatarSeed} size={24} />
              <Text role="micro" as="span">{`On the sofa: ${guest.displayName}`}</Text>
            </div>
          )}
        </div>
      </div>

      <ProgressBar
        value={show.rating}
        max={10}
        tone={RATING_TONE(show.rating)}
        className="mt-3"
      />

      <ul className="mt-3 flex flex-col">
        {show.segments.map((segment, index) => (
          <li key={segment.id}>
            <ListRow
              density="compact"
              divided={index < show.segments.length - 1}
              title={<NameText name={segment.label} role="bodyStrong" lines={1} />}
              subtitle={segment.line}
              trailing={
                <GlassPill size="xs" tone={SEGMENT_TONE[segment.tone]}>
                  {segment.tone === 'GOOD' ? 'Good' : segment.tone === 'BAD' ? 'Bad' : 'Mixed'}
                </GlassPill>
              }
              {...(segment.eventId && onOpenEvent
                ? { chevron: true, onPress: () => onOpenEvent(segment.eventId as string) }
                : {})}
            />
          </li>
        ))}
      </ul>
    </GlassPanel>
  );
});

export const PunditPanel = memo(function PunditPanel({
  state,
}: { state: GameState }): ReactNode {
  const pundit = socialWorld(state).pundit;
  if (!pundit) return null;
  const tone = pundit.stance >= 25 ? 'positive' : pundit.stance <= -25 ? 'danger' : 'neutral';

  return (
    <GlassPanel title="The running argument" padding="md">
      <div className="flex items-start gap-3">
        <CreatorAvatar seed={pundit.avatarSeed} size={38} verified />
        <div className="min-w-0 flex-1">
          <NameText name={pundit.name} role="bodyStrong" lines={1} />
          <NameText name={pundit.handle} role="caption" lines={1} className="mt-0.5" />
        </div>
        <GlassPill size="xs" tone={tone} filled>
          {pundit.stance >= 25 ? 'On your side' : pundit.stance <= -25 ? 'Against you' : 'Undecided'}
        </GlassPill>
      </div>

      <Text role="body" as="p" className="mt-2.5 text-pretty italic">{`“${pundit.thesis}”`}</Text>
      <Text role="caption" as="p" className="mt-2 text-pretty">{punditSummary(pundit)}</Text>

      <div className="mt-3 flex gap-2">
        <GlassPill size="xs" tone="positive">{`Right ${pundit.proven}`}</GlassPill>
        <GlassPill size="xs" tone="danger">{`Wrong ${pundit.disproven}`}</GlassPill>
        <Text role="micro" as="span" className="ml-auto">
          {`Since matchweek ${pundit.thesisSetCycle}`}
        </Text>
      </div>
    </GlassPanel>
  );
});

const CRED = (credibility: number): { label: string; tone: 'positive' | 'warning' | 'danger' } => {
  if (credibility >= 0.7) return { label: 'Strong', tone: 'positive' };
  if (credibility >= 0.45) return { label: 'Plausible', tone: 'warning' };
  return { label: 'Thin', tone: 'danger' };
};

export const RumourMillPanel = memo(function RumourMillPanel({
  state,
}: { state: GameState }): ReactNode {
  const world = socialWorld(state);
  const rumours: readonly RumourItem[] = world.rumours.slice(-6).reverse();
  const accuracy = rumourAccuracy(state);
  if (rumours.length === 0) return null;

  return (
    <GlassPanel title="The rumour mill" padding="md">
      <Text role="caption" as="p" className="text-pretty">
        Nothing here is a fact. Each one carries the confidence it was reported with, and the world
        checks them against what actually happened.
      </Text>
      <ul className="mt-2.5 flex flex-col">
        {rumours.map((rumour, index) => {
          const cred = CRED(rumour.credibility);
          return (
            <li key={rumour.id}>
              <ListRow
                density="regular"
                divided={index < rumours.length - 1}
                title={<NameText name={rumour.text} role="bodyStrong" lines={3} />}
                subtitle={`${rumour.source} · matchweek ${rumour.cycle}`}
                trailing={
                  <div className="flex flex-col items-end gap-1">
                    <GlassPill size="xs" tone={cred.tone}>{cred.label}</GlassPill>
                    {rumour.resolved && (
                      <Text
                        role="micro"
                        as="span"
                        className={cn(rumour.resolved === 'TRUE' ? 'text-positive' : 'text-ink-dim')}
                      >
                        {rumour.resolved === 'TRUE' ? 'It happened' : 'It did not'}
                      </Text>
                    )}
                  </div>
                }
              />
            </li>
          );
        })}
      </ul>
      {accuracy.length > 0 && (
        <>
          <Divider label="Who has been right" />
          <div className="flex flex-wrap gap-1.5">
            {accuracy.map((row) => (
              <GlassPill key={row.source} size="xs" tone={row.right > row.wrong ? 'positive' : 'neutral'}>
                {`${row.source} ${row.right}/${row.right + row.wrong}`}
              </GlassPill>
            ))}
          </div>
        </>
      )}
    </GlassPanel>
  );
});

/** Everything the broadcast layer contributes, in the order it should be read. */
export const BroadcastStack = memo(function BroadcastStack({
  state, onOpenEvent,
}: { state: GameState; onOpenEvent?: (eventId: string) => void }): ReactNode {
  const world = socialWorld(state);
  if (!world.show && !world.pundit && world.rumours.length === 0) return null;
  return (
    <>
      <SectionHeader
        title="The week, rated"
        subtitle="Everything here is measured off the same events the feed reacted to."
      />
      <WeeklyShowPanel state={state} {...(onOpenEvent ? { onOpenEvent } : {})} />
      <PunditPanel state={state} />
      <RumourMillPanel state={state} />
    </>
  );
});
