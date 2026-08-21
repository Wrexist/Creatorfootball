import { memo, useMemo, useState, type ReactNode } from 'react';
import {
  TONE_INFO, VOICE_INFO, composeAvailability, composeOptions, socialMoments,
  type ComposeOption, type GameState, type PostTone, type PostVoice, type SocialMoment,
} from '@cf/engine';
import {
  Divider, EmptyState, GlassButton, GlassPanel, GlassPill, GlassSegmented, GlassSheet,
  IconInfo, IconSocial, IconWarning, ListRow, NameText, SectionHeader, Text, cn, formatCount,
} from '@/design';
import { EffectLines } from './Effects';

/**
 * Saying something.
 *
 * The composer is a two-step decision and it is built to feel like one. First
 * *what* — and the list is deliberately not a text box, because the player may
 * only speak about something that actually happened. Then *how* — five
 * registers, each with its price printed on it, and one of them is always the
 * wrong read of the room.
 *
 * The screen never hides the downside. A tone that does not fit the moment
 * carries its warning in the open, above the button, because the whole point of
 * the surface is that the player chooses to take the risk rather than
 * discovering it afterwards.
 */

export interface ComposerProps {
  state: GameState;
  open: boolean;
  onClose: () => void;
  onPublish: (input: { momentId: string; tone: PostTone; voice: PostVoice }) => void;
  /** Pre-select a moment, when the composer was opened from a specific post. */
  initialMomentId?: string;
}

const VOICE_OPTIONS: readonly { value: PostVoice; label: string }[] = [
  { value: 'CLUB', label: 'The club' },
  { value: 'MANAGER', label: 'You' },
];

const FIT_LABEL = (fit: number): { label: string; tone: 'positive' | 'warning' | 'danger' } => {
  if (fit >= 1.05) return { label: 'Reads the room', tone: 'positive' };
  if (fit >= 0.7) return { label: 'Defensible', tone: 'warning' };
  return { label: 'Wrong register', tone: 'danger' };
};

const MomentRow = memo(function MomentRow({
  moment, selected, onSelect,
}: { moment: SocialMoment; selected: boolean; onSelect: (id: string) => void }): ReactNode {
  return (
    <ListRow
      density="regular"
      selected={selected}
      divided
      title={<NameText name={moment.headline} role="bodyStrong" lines={2} />}
      subtitle={moment.forward ? 'Not played yet — talking now is a bet' : `Matchweek ${moment.cycle}`}
      trailing={
        moment.forward
          ? <GlassPill size="xs" tone="volt" filled>Ahead</GlassPill>
          : <GlassPill size="xs" tone="neutral">{`Stakes ${moment.importance}`}</GlassPill>
      }
      onPress={() => onSelect(moment.id)}
    />
  );
});

const ToneCard = memo(function ToneCard({
  option, selected, onSelect,
}: { option: ComposeOption; selected: boolean; onSelect: (tone: PostTone) => void }): ReactNode {
  const fit = FIT_LABEL(option.fit);
  return (
    <button
      type="button"
      onClick={() => onSelect(option.tone)}
      className={cn(
        'w-full rounded-lg p-3.5 text-left transition-colors',
        selected ? 'glass-2 raised-strong raised-edge' : 'glass-1 raised',
      )}
      aria-pressed={selected}
    >
      <div className="flex items-center gap-2">
        <Text role="section" as="span">{option.info.label}</Text>
        <GlassPill size="xs" tone={fit.tone}>{fit.label}</GlassPill>
        <span className="ml-auto shrink-0">
          <Text role="micro" as="span">{`${formatCount(option.reach)} reach`}</Text>
        </span>
      </div>
      <Text role="caption" as="p" className="mt-1 text-pretty">{option.info.blurb}</Text>
      <EffectLines lines={option.lines} className="mt-2.5" />
      {option.stake && (
        <div className="mt-2.5 flex gap-2 rounded-md bg-volt/10 p-2">
          <span aria-hidden="true" className="mt-0.5 shrink-0 text-volt [&_svg]:size-3.5"><IconInfo /></span>
          <Text role="caption" as="p" className="text-pretty text-volt">{option.stake.claim}</Text>
        </div>
      )}
      {option.warning && (
        <div className="mt-2 flex gap-2 rounded-md bg-danger/12 p-2">
          <span aria-hidden="true" className="mt-0.5 shrink-0 text-danger [&_svg]:size-3.5"><IconWarning /></span>
          <Text role="caption" as="p" className="text-pretty text-danger">{option.warning}</Text>
        </div>
      )}
    </button>
  );
});

export function Composer({
  state, open, onClose, onPublish, initialMomentId,
}: ComposerProps): ReactNode {
  const moments = useMemo(() => socialMoments(state, { limit: 10 }), [state]);
  const availability = useMemo(() => composeAvailability(state), [state]);
  const [momentId, setMomentId] = useState<string | null>(initialMomentId ?? null);
  const [voice, setVoice] = useState<PostVoice>('CLUB');
  const [tone, setTone] = useState<PostTone | null>(null);

  const moment = moments.find((m) => m.id === (momentId ?? moments[0]?.id)) ?? null;
  const options = useMemo(
    () => (moment ? composeOptions(state, moment, voice) : []),
    [state, moment, voice],
  );
  const chosen = options.find((o) => o.tone === tone) ?? null;

  const reset = (): void => { setTone(null); setMomentId(initialMomentId ?? null); };

  return (
    <GlassSheet
      open={open}
      onClose={() => { reset(); onClose(); }}
      title="Say something"
      subtitle={availability.reason}
      size="tall"
      footer={
        chosen && moment ? (
          <GlassButton
            variant="primary"
            size="lg"
            block
            disabled={!availability.allowed}
            onClick={() => {
              onPublish({ momentId: moment.id, tone: chosen.tone, voice });
              reset();
              onClose();
            }}
          >
            {`Post as ${VOICE_INFO[voice].label.toLowerCase()}`}
          </GlassButton>
        ) : undefined
      }
    >
      {moments.length === 0 ? (
        <EmptyState
          size="sm"
          icon={<IconSocial />}
          title="Nothing to talk about yet"
          description="You can only post about something that actually happened. Play a match, sign somebody, lose to somebody you should not have — then come back."
        />
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <SectionHeader
              title="What are you talking about?"
              subtitle="Every post is attached to a real event. There is no blank page here, on purpose."
            />
            <div className="flex flex-col">
              {moments.map((row) => (
                <MomentRow
                  key={row.id}
                  moment={row}
                  selected={row.id === moment?.id}
                  onSelect={(id) => { setMomentId(id); setTone(null); }}
                />
              ))}
            </div>
          </div>

          <Divider label="Who is saying it" />
          <GlassSegmented
            options={VOICE_OPTIONS}
            value={voice}
            onChange={(next) => { setVoice(next); setTone(null); }}
            aria-label="Choose the voice"
            block
            size="sm"
          />
          <Text role="caption" as="p" className="text-ink-dim text-pretty">
            {VOICE_INFO[voice].blurb}
          </Text>

          <Divider label="How you say it" />
          <div className="flex flex-col gap-2.5">
            {options.map((option) => (
              <ToneCard
                key={option.tone}
                option={option}
                selected={option.tone === tone}
                onSelect={setTone}
              />
            ))}
          </div>

          {!availability.allowed && (
            <GlassPanel padding="sm" accent="danger">
              <Text role="caption" as="p" className="text-pretty">{availability.reason}</Text>
            </GlassPanel>
          )}

          <Text role="caption" as="p" className="text-ink-dim text-pretty">
            {`${Object.keys(TONE_INFO).length} registers, and none of them is the right answer twice in a row.`}
          </Text>
        </div>
      )}
    </GlassSheet>
  );
}

/** The one-line prompt that opens the composer from the feed. */
export const ComposerPrompt = memo(function ComposerPrompt({
  state, onOpen,
}: { state: GameState; onOpen: () => void }): ReactNode {
  const availability = composeAvailability(state);
  const club = state.clubs[state.playerClubId];
  return (
    <button
      type="button"
      onClick={onOpen}
      className="glass-1 raised flex w-full items-center gap-3 rounded-lg p-3 text-left"
    >
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-pill bg-volt/14 text-volt [&_svg]:size-4"
      >
        <IconSocial />
      </span>
      <span className="min-w-0 flex-1">
        <NameText
          name={club ? `Post as ${club.shortName}` : 'Post as the club'}
          role="bodyStrong"
          lines={1}
        />
        <Text role="caption" as="span" className="mt-0.5 block text-pretty">
          {availability.allowed
            ? `${availability.cap - availability.used} left this week. Pick a moment and a tone.`
            : 'You have said enough this week.'}
        </Text>
      </span>
    </button>
  );
});
