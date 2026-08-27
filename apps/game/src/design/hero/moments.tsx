import { useEffect, useMemo, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '../cn';
import { useDesignMotion } from '../motion';
import { haptics } from '../haptics';
import { sfx } from '../audio';
import { SeedStream } from '../seed';
import { Portal } from '../glass/Portal';
import { GlassButton } from '../glass/GlassButton';
import { ShinyText } from './effects';
import { Silverware, type SilverwareVariant } from '../domain/silverware';
import { ArtLayer, useArtAsset } from '../art/ArtLayer';
import { ART_ASSETS } from '../art/assets';

/**
 * Hero moments: full-screen, interruptive, and rationed.
 *
 * Each of these takes over the screen, so each is also dismissible by tap, by
 * Escape, and by an explicit button — a celebration the player cannot skip
 * becomes an obstacle by the third season. They auto-dismiss on a timer unless
 * `persist` is set.
 *
 * Under reduced motion every one of these collapses to a plain cross-fade of
 * the same content: the *information* (you scored, you won it) is never carried
 * by the animation alone.
 */

export interface HeroOverlayProps {
  open: boolean;
  onDismiss: () => void;
  /** ms until auto-dismiss. 0 waits for the player. */
  autoDismiss?: number;
  children?: ReactNode;
  className?: string;
}

function HeroOverlay({ open, onDismiss, autoDismiss = 0, children, className }: HeroOverlayProps): ReactNode {
  const m = useDesignMotion();

  useEffect(() => {
    if (!open || autoDismiss <= 0) return;
    const timer = setTimeout(onDismiss, autoDismiss);
    return () => clearTimeout(timer);
  }, [open, autoDismiss, onDismiss]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') onDismiss();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onDismiss]);

  return (
    <Portal>
      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-modal="true"
            variants={m.variants.backdrop}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onDismiss}
            className={cn(
              // Opaque, not near-opaque. At 92% the match feed read straight
              // through the goal takeover, so the one moment the product asks
              // you to stop and look at competed with a list of events behind
              // it. A hero moment either owns the screen or is not a hero
              // moment.
              'fixed inset-0 z-[70] flex flex-col items-center justify-center overflow-hidden bg-void px-6 text-center',
              className,
            )}
            style={{ paddingTop: 'var(--safe-top)', paddingBottom: 'var(--safe-bottom)' }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </Portal>
  );
}

/* --- radiating rays, shared by the burst moments ---------------------- */

function Rays({ count = 14, color, seed }: { count?: number; color: string; seed: string }): ReactNode {
  const m = useDesignMotion();
  const rays = useMemo(() => {
    const s = new SeedStream(seed);
    return Array.from({ length: count }, (_, i) => ({
      angle: (360 / count) * i + s.range(`jitter${i}`, -7, 7),
      length: s.range(`len${i}`, 34, 50),
      delay: s.range(`delay${i}`, 0, 0.12),
    }));
  }, [count, seed]);

  if (m.reduced) return null;

  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
      {rays.map((ray, i) => (
        <motion.span
          key={i}
          className="absolute origin-bottom rounded-pill"
          style={{
            width: 3,
            height: `${ray.length}vmin`,
            background: `linear-gradient(to top, ${color}, transparent)`,
            transform: `rotate(${ray.angle}deg)`,
            transformOrigin: 'center bottom',
            bottom: '50%',
          }}
          initial={{ scaleY: 0, opacity: 0 }}
          animate={{ scaleY: 1, opacity: [0, 0.85, 0] }}
          transition={{ duration: 1.1, delay: ray.delay, ease: [0.22, 1, 0.36, 1] }}
        />
      ))}
    </span>
  );
}

/* --- HeroReveal ------------------------------------------------------- */

export interface HeroRevealProps extends Omit<HeroOverlayProps, 'children'> {
  /** Small line above the headline: "New club", "Signed", "Season 3". */
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** The thing being revealed: a badge, a card, a portrait. */
  visual?: ReactNode;
  action?: ReactNode;
  tone?: 'volt' | 'gold' | 'ink';
}

/**
 * The general-purpose reveal: club chosen, promotion won, record broken.
 * Everything scales up out of a blur so the subject arrives *into* focus,
 * which reads as "presented" rather than "popped in".
 */
export function HeroReveal({
  eyebrow, title, subtitle, visual, action, tone = 'volt', ...overlay
}: HeroRevealProps): ReactNode {
  const m = useDesignMotion();

  useEffect(() => {
    if (!overlay.open) return;
    haptics.celebrate();
    sfx.reward();
  }, [overlay.open]);

  // B6a/B6b are optional plates. `Rays` is the floor and always draws: when
  // the plates are absent this is exactly the reveal that shipped, and when
  // they load the rays step back to a support role rather than vanishing, so
  // the moment reads the same either way and neither file is load-bearing.
  const burst = useArtAsset(ART_ASSETS.revealBurst);

  return (
    <HeroOverlay {...overlay}>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ opacity: burst === 'ready' ? 0.42 : 1 }}
      >
        <Rays color={tone === 'gold' ? 'rgb(255 215 106 / 0.5)' : 'rgb(200 255 46 / 0.35)'} seed={String(title)} />
      </span>

      {/* Motes are ambient: a full-frame layer over the whole moment. */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <ArtLayer src={ART_ASSETS.revealMotes} opacity={0.26} blend="screen" fade={0.9} />
      </span>

      {visual !== undefined && (
        <motion.div
          variants={m.variants.hero}
          initial="hidden"
          animate="visible"
          className="relative mb-7"
        >
          {/* The burst is centred on the crest, not on the screen: its empty
              middle exists so the badge sits inside it and the light appears to
              come from behind the thing being revealed. Centred on the overlay
              instead, the hole lands behind the headline and the composition
              reads as a blurred ring around the text. Sized in vmin because a
              vmax square renders ~1400px on a 430px-wide phone. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[min(132vmin,820px)] -translate-x-1/2 -translate-y-1/2"
          >
            <ArtLayer src={ART_ASSETS.revealBurst} opacity={0.55} blend="screen" fade={0.5} />
          </span>
          <span className="relative block">{visual}</span>
        </motion.div>
      )}

      <motion.div
        variants={m.variants.listContainer}
        initial="hidden"
        animate="visible"
        className="relative flex flex-col items-center gap-2"
      >
        {eyebrow !== undefined && (
          <motion.p
            variants={m.variants.rise}
            className="text-label font-bold uppercase tracking-[0.28em] text-volt"
          >
            {eyebrow}
          </motion.p>
        )}
        <motion.h2 variants={m.variants.rise} className="max-w-[18ch] text-balance">
          <ShinyText as="span" tone={tone === 'ink' ? 'ink' : tone} className="font-display text-display font-bold leading-[1.05] tracking-[-0.04em]">
            {title}
          </ShinyText>
        </motion.h2>
        {subtitle !== undefined && (
          <motion.p variants={m.variants.rise} className="max-w-[32ch] text-body leading-relaxed text-ink-muted text-pretty">
            {subtitle}
          </motion.p>
        )}
        <motion.div variants={m.variants.rise} className="mt-6">
          {action ?? (
            <GlassButton variant="primary" size="lg" onClick={overlay.onDismiss}>
              Continue
            </GlassButton>
          )}
        </motion.div>
      </motion.div>
    </HeroOverlay>
  );
}

/* --- GoalBurst -------------------------------------------------------- */

export interface GoalBurstProps extends Omit<HeroOverlayProps, 'children'> {
  scorer: string;
  assist?: string;
  minute: number;
  /** Score after the goal. */
  homeScore: number;
  awayScore: number;
  /** Whose goal it is — drives the accent colour. */
  accent?: string;
  /** "PENALTY", "HEADER", "SCREAMER" — the one-word flavour line. */
  flavour?: string;
}

/**
 * The goal celebration. Deliberately short (1.8s default) and always skippable:
 * the player will see this fifty times a season and it must never become the
 * thing standing between them and the next moment.
 */
export function GoalBurst({
  scorer, assist, minute, homeScore, awayScore, accent = '#c8ff2e', flavour, autoDismiss = 1900, ...overlay
}: GoalBurstProps): ReactNode {
  const m = useDesignMotion();

  useEffect(() => {
    if (overlay.open) haptics.celebrate();
  }, [overlay.open]);

  return (
    <HeroOverlay {...overlay} autoDismiss={autoDismiss}>
      <Rays color={`${accent}66`} count={18} seed={`${scorer}${minute}`} />

      <motion.div
        initial={m.reduced ? { opacity: 0 } : { scale: 0.55, opacity: 0 }}
        animate={m.reduced ? { opacity: 1 } : { scale: 1, opacity: 1 }}
        transition={m.spring.bouncy}
        className="relative flex flex-col items-center"
      >
        <span
          className="font-display text-[clamp(56px,17vw,120px)] font-bold uppercase leading-none tracking-[-0.06em]"
          style={{ color: accent }}
        >
          Goal
        </span>
        {flavour !== undefined && (
          <span className="mt-1 text-caption font-bold uppercase tracking-[0.3em] text-ink-muted">{flavour}</span>
        )}
      </motion.div>

      <motion.div
        initial={m.reduced ? { opacity: 0 } : { y: 18, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ ...m.transition.medium, delay: m.reduced ? 0 : 0.14 }}
        className="relative mt-5 flex flex-col items-center gap-1"
      >
        <p className="text-hero font-bold tracking-[-0.02em] text-ink">{scorer}</p>
        <p className="tnum text-body text-ink-muted">
          {minute}&apos;{assist ? ` · assist ${assist}` : ''}
        </p>
        <p className="tnum mt-3 font-display text-hero font-bold tracking-[-0.04em] text-ink">
          {homeScore} – {awayScore}
        </p>
      </motion.div>
    </HeroOverlay>
  );
}

/* --- TrophyMoment ----------------------------------------------------- */

export interface TrophyMomentProps extends Omit<HeroOverlayProps, 'children'> {
  competition: string;
  season: ReactNode;
  clubName: string;
  /**
   * Which piece of silverware is being lifted. Defaults to the champion cup;
   * pass `silverwareVariantFor(competition)` to derive it from the name.
   */
  variant?: SilverwareVariant;
  /**
   * Replaces the trophy itself. Only pass this when the moment is *not* about
   * a trophy — the cup is the point of this overlay.
   */
  visual?: ReactNode;
  /** Small club crest shown above the trophy. */
  crest?: ReactNode;
  stats?: readonly { label: string; value: ReactNode }[];
}

/**
 * Volt confetti, rationed.
 *
 * Fourteen flecks, two of them volt and the rest gold, falling once. Confetti
 * is the easiest thing in this entire design system to overdo: a hundred
 * particles turns the trophy into a background element and costs a frame
 * budget the moment cannot spare on a mid-range phone.
 */
function Confetti({ seed }: { seed: string }): ReactNode {
  const m = useDesignMotion();
  const flecks = useMemo(() => {
    const s = new SeedStream(`confetti:${seed}`);
    return Array.from({ length: 14 }, (_, i) => ({
      x: s.range(`x${i}`, 6, 94),
      delay: s.range(`d${i}`, 0, 0.7),
      drift: s.range(`dr${i}`, -26, 26),
      spin: s.range(`s${i}`, -220, 220),
      duration: s.range(`t${i}`, 1.5, 2.4),
      volt: i % 7 === 3,
      size: s.range(`w${i}`, 4, 8),
    }));
  }, [seed]);

  if (m.reduced) return null;

  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {flecks.map((fleck, i) => (
        <motion.span
          key={i}
          className="absolute top-0 rounded-[1px]"
          style={{
            left: `${fleck.x}%`,
            width: fleck.size,
            height: fleck.size * 1.7,
            background: fleck.volt ? '#c8ff2e' : '#ffd76a',
          }}
          initial={{ y: '-8vh', x: 0, rotate: 0, opacity: 0 }}
          animate={{ y: '92vh', x: fleck.drift, rotate: fleck.spin, opacity: [0, 0.9, 0.9, 0] }}
          transition={{ duration: fleck.duration, delay: fleck.delay, ease: 'linear' }}
        />
      ))}
    </span>
  );
}

/** The biggest moment the product has. Gold is used here and nowhere else. */
export function TrophyMoment({
  competition, season, clubName, variant = 'league', visual, crest, stats, ...overlay
}: TrophyMomentProps): ReactNode {
  const m = useDesignMotion();

  useEffect(() => {
    if (!overlay.open) return;
    haptics.celebrate();
    sfx.trophy();
  }, [overlay.open]);

  return (
    <HeroOverlay {...overlay}>
      <Rays color="rgb(255 215 106 / 0.45)" count={20} seed={competition} />
      <Confetti seed={competition} />

      {crest !== undefined && (
        <motion.div
          initial={m.reduced ? { opacity: 0 } : { y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={m.transition.medium}
          className="relative mb-4 opacity-90"
        >
          {crest}
        </motion.div>
      )}

      <motion.div
        initial={m.reduced ? { opacity: 0 } : { scale: 0.6, opacity: 0, rotate: -8 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={m.spring.bouncy}
        className="relative text-hero-gold drop-shadow-[0_18px_48px_rgb(255_215_106/0.35)]"
      >
        {/* The px size is the SSR/no-CSS truth; the class lets a small phone
            keep the headline on screen underneath it. */}
        {visual ?? (
          <Silverware
            variant={variant}
            size={196}
            glow
            label={`${competition} trophy`}
            className="h-[min(34vh,220px)] w-auto"
          />
        )}

        {/* The lift: one soft specular pass across the metal, once. A radial
            rather than a bar, because a rectangular sweep over a cup-shaped
            silhouette reads as a rectangle. */}
        {!m.reduced && (
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 -inset-x-1/4"
            style={{
              background: 'radial-gradient(38% 60% at 50% 42%, rgb(255 255 255 / 0.5), transparent 72%)',
              mixBlendMode: 'screen',
            }}
            initial={{ x: '-70%', opacity: 0 }}
            animate={{ x: '70%', opacity: [0, 1, 0] }}
            transition={{ duration: 1.15, delay: 0.42, ease: [0.4, 0, 0.2, 1] }}
          />
        )}
      </motion.div>

      <motion.div
        variants={m.variants.listContainer}
        initial="hidden"
        animate="visible"
        className="relative mt-7 flex flex-col items-center gap-2"
      >
        <motion.p variants={m.variants.rise} className="text-label font-bold uppercase tracking-[0.28em] text-hero-gold">
          Champions · {season}
        </motion.p>
        <motion.h2 variants={m.variants.rise} className="max-w-[16ch] text-balance">
          <ShinyText as="span" tone="gold" loop className="font-display text-display font-bold leading-[1.04] tracking-[-0.04em]">
            {competition}
          </ShinyText>
        </motion.h2>
        <motion.p variants={m.variants.rise} className="text-section font-semibold text-ink">
          {clubName}
        </motion.p>

        {stats && stats.length > 0 && (
          <motion.dl variants={m.variants.rise} className="mt-6 flex gap-7">
            {stats.map((stat) => (
              <div key={stat.label} className="flex flex-col items-center">
                <dd className="tnum font-display text-title font-bold text-ink">{stat.value}</dd>
                <dt className="mt-0.5 text-micro uppercase tracking-[0.16em] text-ink-dim">{stat.label}</dt>
              </div>
            ))}
          </motion.dl>
        )}

        <motion.div variants={m.variants.rise} className="mt-8">
          <GlassButton variant="primary" size="lg" onClick={overlay.onDismiss}>
            Lift it
          </GlassButton>
        </motion.div>
      </motion.div>
    </HeroOverlay>
  );
}

/* --- SigningMoment ---------------------------------------------------- */

export interface SigningMomentProps extends Omit<HeroOverlayProps, 'children'> {
  playerName: string;
  /** Usually a `<PlayerCard variant="featured" />`. */
  card: ReactNode;
  fee?: ReactNode;
  contract?: ReactNode;
  clubName?: string;
  accent?: string;
}

/**
 * The signing reveal. The card rotates in from a slight angle and settles —
 * the one place a card is allowed to move in 3D, because here it is being
 * *handed to you* rather than sitting in a list.
 */
export function SigningMoment({
  playerName, card, fee, contract, clubName, accent = '#c8ff2e', ...overlay
}: SigningMomentProps): ReactNode {
  const m = useDesignMotion();

  useEffect(() => {
    if (!overlay.open) return;
    haptics.success();
    sfx.signing();
  }, [overlay.open]);

  return (
    <HeroOverlay {...overlay}>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(60% 40% at 50% 42%, ${accent}22, transparent 70%)` }}
      />

      <motion.p
        initial={m.reduced ? { opacity: 0 } : { y: -12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={m.transition.medium}
        className="relative mb-6 text-label font-bold uppercase tracking-[0.3em] text-volt"
      >
        {clubName ? `Signed for ${clubName}` : 'Signed'}
      </motion.p>

      <motion.div
        initial={m.reduced ? { opacity: 0 } : { rotateY: -26, rotateZ: -6, y: 40, opacity: 0, scale: 0.86 }}
        animate={{ rotateY: 0, rotateZ: 0, y: 0, opacity: 1, scale: 1 }}
        transition={m.spring.gentle}
        style={{ perspective: 1000 }}
        className="relative w-[min(72vw,260px)]"
      >
        {card}
      </motion.div>

      <motion.div
        initial={m.reduced ? { opacity: 0 } : { y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ ...m.transition.medium, delay: m.reduced ? 0 : 0.18 }}
        className="relative mt-7 flex flex-col items-center gap-1.5"
      >
        <h2 className="font-display text-hero font-bold tracking-[-0.03em] text-ink">{playerName}</h2>
        {(fee !== undefined || contract !== undefined) && (
          <p className="tnum text-body text-ink-muted">
            {fee}
            {fee !== undefined && contract !== undefined ? ' · ' : ''}
            {contract}
          </p>
        )}
        <div className="mt-6">
          <GlassButton variant="primary" size="lg" onClick={overlay.onDismiss}>
            Welcome him
          </GlassButton>
        </div>
      </motion.div>
    </HeroOverlay>
  );
}
