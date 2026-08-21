import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  answerPressConference, pressConference, skipPressConference, socialWorld,
  type GameState, type PressAnswer, type PressConference, type PressQuestion,
} from '@cf/engine';
import {
  CreatorAvatar, Divider, EmptyState, GlassButton, GlassPanel, GlassPill, GlassSheet,
  HeroSurface, IconInfo, IconWarning, ListRow, NameText, ProgressBar, Screen, SectionHeader,
  StatBlock, Text, cn, useToast,
} from '@/design';
import { SOCIAL_ROUTES } from './routes';
import { GateScreen, useGameStatus } from './gate';
import { socialRegistry, useSocialAction, useSocialWorld } from './engine';
import { EffectLines } from './components/Effects';

/**
 * The press room.
 *
 * Three questions and no good answer to any of them. Every option in here
 * trades at least two of the three constituencies against each other — the
 * dressing room, the stands and the room itself — and the trade is printed on
 * the button before it is pressed. Defending a struggling player lifts him and
 * costs you with the press; throwing him under the bus does exactly the
 * reverse. That is the entire screen.
 *
 * Two structural decisions worth stating. Questions are *earned*: each one
 * declares what has to be true of the save before it can be asked, so a
 * reporter never asks about an injury crisis you do not have. And the whole
 * conference is applied as one merged effect, so the player is judged on the
 * shape of the session — three shields in a row is a coherent position and the
 * press write about that rather than about a sentence.
 */

const AnswerCard = ({
  answer, selected, onSelect,
}: { answer: PressAnswer; selected: boolean; onSelect: (id: string) => void }): ReactNode => (
  <button
    type="button"
    onClick={() => onSelect(answer.id)}
    aria-pressed={selected}
    className={cn(
      'w-full rounded-lg p-3.5 text-left transition-colors',
      selected ? 'glass-2 raised-strong raised-edge' : 'glass-1 raised',
    )}
  >
    <Text role="section" as="span">{answer.label}</Text>
    <Text role="body" as="p" className="mt-1.5 text-pretty italic">{`“${answer.line}”`}</Text>
    <EffectLines lines={answer.lines} className="mt-2.5" />
    {answer.stake && (
      <div className="mt-2.5 flex gap-2 rounded-md bg-volt/10 p-2">
        <span aria-hidden="true" className="mt-0.5 shrink-0 text-volt [&_svg]:size-3.5"><IconInfo /></span>
        <Text role="caption" as="p" className="text-pretty text-volt">{answer.stake.claim}</Text>
      </div>
    )}
  </button>
);

function QuestionBlock({
  question, index, total, chosen, onChoose,
}: {
  question: PressQuestion;
  index: number;
  total: number;
  chosen: string | undefined;
  onChoose: (questionId: string, answerId: string) => void;
}): ReactNode {
  return (
    <section>
      <div className="flex items-start gap-3">
        <CreatorAvatar seed={question.avatarSeed} size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <NameText name={question.reporter} role="bodyStrong" lines={1} />
            <NameText name={question.outlet} role="caption" lines={1} />
            <GlassPill size="xs" tone="neutral">{question.topic}</GlassPill>
            <span className="ml-auto shrink-0">
              <Text role="micro" as="span">{`${index + 1} of ${total}`}</Text>
            </span>
          </div>
          <Text role="body" as="p" className="mt-1.5 text-pretty">{question.text}</Text>
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2.5">
        {question.answers.map((answer) => (
          <AnswerCard
            key={answer.id}
            answer={answer}
            selected={chosen === answer.id}
            onSelect={(id) => onChoose(question.id, id)}
          />
        ))}
      </div>
    </section>
  );
}

function PressView({ state }: { state: GameState }): ReactNode {
  const navigate = useNavigate();
  const toast = useToast();
  const run = useSocialAction();
  useSocialWorld(state);

  const conference: PressConference | null = useMemo(() => pressConference(state), [state]);
  const world = socialWorld(state);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [confirmSkip, setConfirmSkip] = useState(false);

  const history = world.conferences.slice(-6).reverse();
  const complete = conference
    ? conference.questions.every((q) => answers[q.id] !== undefined)
    : false;

  const submit = (): void => {
    if (!conference) return;
    const outcome = run((current) => answerPressConference(current, {
      conferenceId: conference.id,
      answers: conference.questions.map((q) => ({ questionId: q.id, answerId: answers[q.id] as string })),
      at: Date.now(),
      registry: socialRegistry(),
    }));
    setAnswers({});
    if (outcome.ok) toast.success('That is on the record', 'The room is already filing it.');
    else toast.error('Not filed', outcome.reason ?? 'Something was missing.');
  };

  const skip = (): void => {
    if (!conference) return;
    const outcome = run((current) => skipPressConference(current, { at: Date.now() }));
    setConfirmSkip(false);
    if (outcome.ok) {
      toast.show({
        tone: 'warning',
        title: 'You walked past them',
        description: 'They noticed, and they will notice again next time.',
      });
    } else toast.error('Not possible', outcome.reason ?? 'Nothing to skip.');
  };

  return (
    <Screen
      title="Press"
      subtitle={conference ? conference.title : 'No conference scheduled'}
      onBack={() => navigate(SOCIAL_ROUTES.feed)}
      aside={
        <GlassPanel title="Where you stand" padding="md">
          <StatBlock
            label="Media goodwill"
            value={Math.round(world.mediaGoodwill)}
            unit="/100"
            tone={world.mediaGoodwill >= 55 ? 'positive' : world.mediaGoodwill <= 35 ? 'danger' : 'neutral'}
            caption="Softens hostile coverage of your club"
          />
          <ProgressBar
            value={world.mediaGoodwill}
            max={100}
            tone={world.mediaGoodwill >= 55 ? 'positive' : 'warning'}
            className="mt-2"
          />
          <Text role="caption" as="p" className="mt-3 text-ink-dim text-pretty">
            Goodwill is not a favour. A press that believes you writes your bad weeks smaller; one
            that does not writes them larger.
          </Text>
        </GlassPanel>
      }
      footer={
        conference ? (
          <div className="flex gap-2">
            <GlassButton variant="ghost" size="lg" onClick={() => setConfirmSkip(true)}>
              Walk past
            </GlassButton>
            <GlassButton variant="primary" size="lg" block disabled={!complete} onClick={submit}>
              {complete ? 'Give those answers' : `Answer all ${conference.questions.length}`}
            </GlassButton>
          </div>
        ) : undefined
      }
    >
      {conference ? (
        <>
          <HeroSurface
            eyebrow={conference.slot === 'PRE' ? 'Before the match' : 'After the whistle'}
            title={conference.title}
            subtitle={conference.subtitle}
            texture="haze"
            padding="md"
          >
            <div className="flex flex-wrap items-center gap-2">
              <GlassPill size="sm" tone="info" filled>
                {`${conference.questions.length} questions`}
              </GlassPill>
              <Text role="label" as="span">
                {`Goodwill ${conference.goodwill} / 100`}
              </Text>
            </div>
          </HeroSurface>

          <div className="flex flex-col gap-6">
            {conference.questions.map((question, index) => (
              <QuestionBlock
                key={question.id}
                question={question}
                index={index}
                total={conference.questions.length}
                chosen={answers[question.id]}
                onChoose={(questionId, answerId) =>
                  setAnswers((prev) => ({ ...prev, [questionId]: answerId }))}
              />
            ))}
          </div>

          <Text role="caption" as="p" className="text-ink-dim text-pretty">
            Every question here comes from something that actually happened to this club in the last
            fortnight, and every answer moves the world before you next see it.
          </Text>
        </>
      ) : (
        <GlassPanel padding="md">
          <EmptyState
            icon={<IconInfo />}
            title="Nothing to answer for"
            description="A conference opens before your next fixture and again after the result. Play a match, or wait for the fixture to be announced."
            action={
              <GlassButton variant="secondary" size="sm" onClick={() => navigate(SOCIAL_ROUTES.feed)}>
                Back to the feed
              </GlassButton>
            }
          />
        </GlassPanel>
      )}

      {history.length > 0 && (
        <>
          <SectionHeader
            title="What you have said"
            subtitle="The room remembers. So does the dressing room."
          />
          <div className="flex flex-col">
            {history.map((record, index) => (
              <ListRow
                key={record.id}
                density="regular"
                divided={index < history.length - 1}
                title={<NameText name={record.headline} role="bodyStrong" lines={3} />}
                subtitle={`${record.slot === 'PRE' ? 'Pre-match' : 'Post-match'}, matchweek ${record.cycle}`}
                trailing={
                  <GlassPill size="xs" tone={record.goodwillDelta >= 0 ? 'positive' : 'danger'}>
                    {`${record.goodwillDelta > 0 ? '+' : ''}${record.goodwillDelta}`}
                  </GlassPill>
                }
              />
            ))}
          </div>
        </>
      )}

      <GlassSheet
        open={confirmSkip}
        onClose={() => setConfirmSkip(false)}
        title="Walk past the press?"
        subtitle="Cheap once. Expensive as a habit."
        size="auto"
        footer={
          <div className="flex gap-2">
            <GlassButton variant="secondary" size="lg" block onClick={() => setConfirmSkip(false)}>
              Take the questions
            </GlassButton>
            <GlassButton variant="danger" size="lg" block onClick={skip}>
              Say nothing
            </GlassButton>
          </div>
        }
      >
        <div className="flex gap-2 rounded-md bg-danger/12 p-3">
          <span aria-hidden="true" className="mt-0.5 shrink-0 text-danger [&_svg]:size-4"><IconWarning /></span>
          <Text role="body" as="p" className="text-pretty">
            You lose goodwill with the room and a little with the organised support, and every
            subsequent walk-past costs more than the last one. Nothing you would have said gets
            said instead.
          </Text>
        </div>
        <Divider />
        <Text role="caption" as="p" className="text-ink-dim text-pretty">
          There are weeks where this is the right call. This is not most weeks.
        </Text>
      </GlassSheet>
    </Screen>
  );
}

export function PressConferenceScreen(): ReactNode {
  const gate = useGameStatus();
  if (gate.status !== 'ready') return <GateScreen gate={gate} title="Press" />;
  return <PressView state={gate.state} />;
}
