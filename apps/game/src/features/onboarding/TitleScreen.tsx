import { useEffect, useRef, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { trackEvent } from '@cf/engine';
import {
  ART_ASSETS, ArtLayer, GlassButton, GlassCard, GlassPill, HeroScene, IconChevronRight,
  NameText, useArtAsset, useConfirm, useDesignMotion,
} from '@/design';
import { ROUTES } from '@/app/routes';
import { useGameStore } from '@/state/gameStore';
import { content } from '@/state/content';
import { BrandMark } from './BrandMark';

/**
 * The title screen.
 *
 * Two decisions and nothing else: carry on with the dynasty you have, or start
 * one. The continue card leads because a returning player is the common case
 * and their club — not our logo — is the thing they came back for.
 */

function relativeTime(from: number, now: number): string {
  const minutes = Math.max(0, Math.round((now - from) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? 'day' : 'days'} ago`;
}

export function TitleScreen(): ReactNode {
  const m = useDesignMotion();
  // E1 is an override on the drawn mark, not a replacement: `BrandMark` stays
  // mounted underneath and is what shows until the plate has decoded, and
  // forever if it never does.
  const crest = useArtAsset(ART_ASSETS.crest);
  const navigate = useNavigate();
  const confirm = useConfirm();
  const meta = useGameStore((s) => s.meta);
  const phase = useGameStore((s) => s.phase);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const canContinue = phase === 'READY' && meta !== null;

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  const startNewCareer = async (): Promise<void> => {
    if (canContinue) {
      const ok = await confirm({
        title: 'Start a new career?',
        description:
          `${meta?.clubName} stays exactly as it is until you finish creating a new club. ` +
          'Finishing replaces it, and that cannot be undone.',
        confirmLabel: 'Start new',
        cancelLabel: 'Keep playing',
        destructive: true,
      });
      if (!ok) return;
    }
    trackEvent('onboarding_start', { hadSave: canContinue });
    // The player has said what they are about to do. The universe they will
    // choose a club from starts arriving now, behind the manager step, so the
    // club step has it by the time they get there.
    content.prefetch();
    navigate(ROUTES.managerCreation);
  };

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-base">
      {/* Beat 0:00-0:25. The hero is the screen, not a band across the top of
          it — the copy and the CTA sit *on* the ground rather than above and
          below a hole where a picture should be. */}
      <HeroScene variant="title" seed="creator-football" />

      {/* E2 over the drawn scene rather than instead of it, and mixed *low*.
          The plate is the crest lit in an arena, which is the same mark as the
          badge below and the same words as the headline — at any strength
          where you can read it as a logo it is the third statement of one
          thing and it swamps the type it sits behind. At 12% it stops being a
          logo and becomes what it is useful for: lit depth above the fold,
          with `HeroScene` still establishing the ground and the contrast. */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[46%] overflow-hidden">
        <ArtLayer src={ART_ASSETS.crestArena} opacity={0.12} blend="screen" fade={0.8} />
        {/* The plate carries no scrim of its own and the headline crosses its
            lower half, so the fade to the ground happens here. */}
        <span
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to bottom, transparent 8%, var(--color-base) 92%)' }}
        />
      </span>

      <div
        className="scroll-y relative flex flex-1 flex-col justify-between px-6 pb-[calc(var(--safe-bottom)+28px)] pt-[calc(var(--safe-top)+40px)]"
      >
        <motion.header
          variants={m.variants.rise}
          initial="hidden"
          animate="visible"
          className="flex flex-col items-start gap-6"
        >
          <span className="relative block h-14 w-14">
            {/* Once the plate is up these are the same silhouette twice, so the
                drawn one steps aside rather than doubling it. It is still what
                holds the space, and what stays if the plate never arrives. */}
            <span style={{ opacity: crest === 'ready' ? 0 : 1, transition: 'opacity 0.5s ease-out' }}>
              <BrandMark size={56} className="text-ink" />
            </span>
            <ArtLayer src={ART_ASSETS.crest} blend="normal" fade={0.5} className="object-contain" />
          </span>
          <div>
            <h1
              ref={headingRef}
              tabIndex={-1}
              className="max-w-[9ch] font-display text-[clamp(44px,13vw,72px)] font-bold uppercase leading-[0.92] tracking-[-0.05em] text-ink outline-none"
            >
              Creator Football
            </h1>
            <p className="mt-4 max-w-[30ch] text-[15px] leading-relaxed text-ink-muted text-pretty">
              Build your club. Recruit your creators. Own the league.
            </p>
          </div>
        </motion.header>

        <motion.div
          variants={m.variants.listContainer}
          initial="hidden"
          animate="visible"
          className="mt-10 flex flex-col gap-3"
        >
          {canContinue && meta && (
            <motion.div variants={m.variants.riseFar}>
              <GlassCard
                level={2}
                radius="xl"
                padding="md"
                onPress={() => navigate(ROUTES.home)}
                aria-label={`Continue with ${meta.clubName}, season ${meta.season}, week ${meta.week}`}
              >
                <div className="flex items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-volt">Continue</p>
                    {/* The name of the club they came back for. It shares this
                        row with a chevron and a date, so it is fitted — cutting
                        it here would put an ellipsis on the single most
                        important word on the screen. */}
                    <NameText
                      name={meta.clubName}
                      role="title"
                      lines={1}
                      className="mt-1 font-display font-bold tracking-[-0.03em] text-ink"
                    />
                    <p className="tnum mt-1 text-[13px] text-ink-muted">
                      Season {meta.season} · Week {meta.week} · {meta.managerName}
                    </p>
                  </div>
                  <IconChevronRight size={22} className="shrink-0 text-ink-dim" />
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <GlassPill tone="neutral" size="xs">
                    Saved {relativeTime(meta.savedAt, Date.now())}
                  </GlassPill>
                </div>
              </GlassCard>
            </motion.div>
          )}

          <motion.div variants={m.variants.riseFar}>
            <GlassButton
              variant={canContinue ? 'secondary' : 'primary'}
              size="lg"
              block
              onClick={() => void startNewCareer()}
            >
              {canContinue ? 'New career' : 'Start your career'}
            </GlassButton>
          </motion.div>

          <motion.p variants={m.variants.rise} className="px-1 text-center text-[12px] text-ink-dim">
            Creation takes about three minutes. Every step can be changed later.
          </motion.p>

          {import.meta.env.DEV && (
            <motion.div variants={m.variants.rise} className="flex justify-center pt-1">
              <GlassButton variant="ghost" size="sm" onClick={() => navigate(ROUTES.gallery)}>
                Design gallery
              </GlassButton>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
