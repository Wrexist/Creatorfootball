import { useEffect, useState, type ReactNode } from 'react';
import { cn } from './cn';
import { RADIUS_CLASS } from './glass/glassLevel';
import { ReducedMotionOverrideContext } from './motion';
import { ICON_NAMES, ICONS } from './icons';
import {
  GlassButton, GlassCard, GlassIcon, GlassInput, GlassModal, GlassPanel, GlassPill,
  GlassSegmented, GlassSheet, GlassSlider, GlassTabs, GlassToggle,
} from './index';
import {
  Accordion, AttributeBar, CardRail, ClubBadge, ClubCard, Confirm, Counter, CreatorAvatar,
  CreatorCard, Divider, EmptyState, ErrorState, FormGuide, GlareHover, GoalBurst, GradualBlur,
  HeroReveal, KeyValueRow, MatchCard, MatchEventRow, MomentumBar, MoneyLabel, NewsCard,
  PlayerCard, PlayerPortrait, PositionChip, ProgressBar, RatingBadge, Screen, ScoreDisplay,
  SectionHeader, ShinyText, SideNav, Skeleton, SocialPost, Sparkline, SpotlightCard, StatCard,
  StatGrid, TabBar, Timeline, ToastProvider, TraitChip, TrendIndicator, TrophyMoment,
  SigningMoment, useToast, type TabId,
} from './index';
import {
  GALLERY_CLUBS, GALLERY_CREATORS, GALLERY_EVENTS, GALLERY_IDENTITIES, GALLERY_PLAYERS,
  GALLERY_POSTS, GALLERY_STANDINGS, GALLERY_STORIES,
} from './Gallery.fixtures';
import { IconBell, IconChevronRight, IconPlus, IconSearch, IconStar, IconTrophy } from './icons';

/**
 * The component gallery.
 *
 * This is how the design gets reviewed, so it is built to be *used*, not to be
 * pretty: every primitive appears in every state it can reach (default, hover,
 * pressed, loading, disabled, empty, error), the viewport can be flipped
 * between a phone frame and full desktop width without reloading, and the two
 * accessibility settings that change the most — reduced motion and reduced
 * transparency/effects — are switchable in the header so a reviewer can check
 * both without touching OS preferences.
 *
 * Route it at /design in development. It is excluded from the product's
 * navigation on purpose.
 */

/* --- scaffolding ------------------------------------------------------ */

const SECTIONS = [
  ['foundations', 'Foundations'],
  ['icons', 'Icons'],
  ['buttons', 'Buttons & controls'],
  ['inputs', 'Inputs'],
  ['overlays', 'Overlays'],
  ['badges', 'Club badges'],
  ['portraits', 'Portraits'],
  ['playercards', 'Player cards'],
  ['cards', 'Domain cards'],
  ['data', 'Data display'],
  ['feedback', 'Feedback'],
  ['structure', 'Layout'],
  ['screen', 'Screen scaffold'],
  ['hero', 'Hero moments'],
] as const;

function Section({ id, title, note, children }: { id: string; title: string; note?: string; children: ReactNode }): ReactNode {
  return (
    <section id={id} className="scroll-mt-24 border-t border-white/[0.07] pt-8">
      <h2 className="font-display text-[24px] font-bold tracking-[-0.03em] text-ink">{title}</h2>
      {note && <p className="mt-1 max-w-[62ch] text-[13px] leading-relaxed text-ink-muted">{note}</p>}
      <div className="mt-5 flex flex-col gap-6">{children}</div>
    </section>
  );
}

function Row({ label, children, className }: { label?: string; children: ReactNode; className?: string }): ReactNode {
  return (
    <div>
      {label && (
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-dim">{label}</p>
      )}
      <div className={cn('flex flex-wrap items-start gap-3', className)}>{children}</div>
    </div>
  );
}

function Swatch({ name, className }: { name: string; className: string }): ReactNode {
  return (
    <div className="w-[104px]">
      <div className={cn('h-14 w-full rounded-md border border-white/10', className)} />
      <p className="mt-1.5 font-mono text-[10px] text-ink-dim">{name}</p>
    </div>
  );
}

/* --- interactive demos ------------------------------------------------ */

function OverlayDemos(): ReactNode {
  const [sheet, setSheet] = useState(false);
  const [tallSheet, setTallSheet] = useState(false);
  const [modal, setModal] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const toast = useToast();

  return (
    <>
      <Row label="Triggers">
        <GlassButton onClick={() => setSheet(true)}>Bottom sheet</GlassButton>
        <GlassButton onClick={() => setTallSheet(true)}>Tall sheet</GlassButton>
        <GlassButton onClick={() => setModal(true)}>Modal</GlassButton>
        <GlassButton variant="danger" onClick={() => setConfirm(true)}>Destructive confirm</GlassButton>
      </Row>
      <Row label="Toasts">
        <GlassButton size="sm" onClick={() => toast.show({ title: 'Training complete', description: 'Three players improved this cycle.' })}>Neutral</GlassButton>
        <GlassButton size="sm" onClick={() => toast.success('Transfer complete', 'K. Vantor has signed a 3-year deal.')}>Success</GlassButton>
        <GlassButton size="sm" onClick={() => toast.warning('Wage budget tight', 'You are within 4% of the cap.')}>Warning</GlassButton>
        <GlassButton size="sm" onClick={() => toast.error('Negotiation collapsed', 'Northgate hijacked the deal.')}>Error (persistent)</GlassButton>
        <GlassButton size="sm" onClick={() => toast.show({ title: 'Objective ready to claim', tone: 'volt', action: { label: 'Claim now', onPress: () => undefined } })}>With action</GlassButton>
      </Row>

      <GlassSheet
        open={sheet}
        onClose={() => setSheet(false)}
        title="Substitution"
        subtitle="Two changes remaining"
        footer={<GlassButton variant="primary" block onClick={() => setSheet(false)}>Make the change</GlassButton>}
      >
        <div className="flex flex-col gap-2 py-2">
          {GALLERY_PLAYERS.slice(0, 4).map((player) => (
            <PlayerCard key={player.id} player={player} variant="matchday" club={GALLERY_CLUBS[0]} />
          ))}
        </div>
      </GlassSheet>

      <GlassSheet open={tallSheet} onClose={() => setTallSheet(false)} title="Squad" size="tall">
        <div className="flex flex-col">
          {[...GALLERY_PLAYERS, ...GALLERY_PLAYERS].map((player, i) => (
            <PlayerCard key={`${player.id}-${i}`} player={player} variant="compact" club={GALLERY_CLUBS[0]} onPress={() => undefined} />
          ))}
        </div>
      </GlassSheet>

      <GlassModal
        open={modal}
        onClose={() => setModal(false)}
        title="Contract offer"
        description="Terms agreed with the agent. This will commit the wage for four seasons."
        footer={<GlassButton variant="primary" block onClick={() => setModal(false)}>Sign</GlassButton>}
      >
        <div className="flex flex-col">
          <KeyValueRow label="Wage" value="£42,000 / week" />
          <KeyValueRow label="Length" value="4 years" />
          <KeyValueRow label="Release clause" value="£28.0M" divided={false} />
        </div>
      </GlassModal>

      <Confirm
        open={confirm}
        destructive
        title="Release Ilyan Brekke?"
        description="He is a cult hero. Fan sentiment will drop sharply and the remaining wage is not recoverable."
        confirmLabel="Release him"
        onConfirm={() => setConfirm(false)}
        onCancel={() => setConfirm(false)}
      />
    </>
  );
}

function HeroDemos(): ReactNode {
  const [reveal, setReveal] = useState(false);
  const [goal, setGoal] = useState(false);
  const [trophy, setTrophy] = useState(false);
  const [signing, setSigning] = useState(false);
  const club = GALLERY_CLUBS[0];
  const player = GALLERY_PLAYERS[0];

  return (
    <>
      <Row label="Triggers — reserved for nine moments only">
        <GlassButton onClick={() => setReveal(true)}>Club reveal</GlassButton>
        <GlassButton onClick={() => setGoal(true)}>Goal burst</GlassButton>
        <GlassButton onClick={() => setTrophy(true)}>Trophy</GlassButton>
        <GlassButton onClick={() => setSigning(true)}>Signing</GlassButton>
      </Row>

      <Row label="Ambient effects (used inside hero surfaces)">
        <SpotlightCard className="w-[260px] p-5">
          <p className="text-[13px] uppercase tracking-[0.2em] text-ink-dim">Spotlight card</p>
          <p className="mt-2 text-[15px] text-ink">Move the pointer across this card.</p>
        </SpotlightCard>
        <GlareHover className="w-[260px] rounded-xl glass-2 glass-sheen p-5">
          <p className="text-[13px] uppercase tracking-[0.2em] text-ink-dim">Glare hover</p>
          <p className="mt-2 text-[15px] text-ink">A single pass of light on hover.</p>
        </GlareHover>
        <div className="relative h-[132px] w-[260px] overflow-hidden rounded-xl glass-2 p-5">
          <p className="text-[15px] leading-relaxed text-ink">
            Gradual blur lets a scrolling list dissolve under sticky chrome instead of hitting a hard cut line at the edge of the container.
          </p>
          <GradualBlur side="bottom" height={64} />
        </div>
      </Row>

      <Row label="Shiny text">
        <ShinyText as="span" tone="ink" className="font-display text-[28px] font-bold">Promoted</ShinyText>
        <ShinyText as="span" tone="volt" className="font-display text-[28px] font-bold">Record broken</ShinyText>
        <ShinyText as="span" tone="gold" loop className="font-display text-[28px] font-bold">Champions</ShinyText>
      </Row>

      {club && (
        <HeroReveal
          open={reveal}
          onDismiss={() => setReveal(false)}
          eyebrow="Your club"
          title={club.name}
          subtitle="Twelfth in the league, a stadium half full, and a fanbase that has not forgotten what this club used to be."
          visual={<ClubBadge visual={club.visual} size={168} label={club.name} />}
        />
      )}

      <GoalBurst
        open={goal}
        onDismiss={() => setGoal(false)}
        scorer="K. Vantor"
        assist="M. Okafor"
        minute={64}
        homeScore={2}
        awayScore={1}
        flavour="Near post"
      />

      <TrophyMoment
        open={trophy}
        onDismiss={() => setTrophy(false)}
        competition="The Creator Cup"
        season="Season 3"
        clubName="Ashvale Phoenix"
        stats={[
          { label: 'Points', value: 78 },
          { label: 'Goals', value: 94 },
          { label: 'Unbeaten', value: 12 },
        ]}
      />

      {player && club && (
        <SigningMoment
          open={signing}
          onDismiss={() => setSigning(false)}
          playerName={`${player.firstName} ${player.lastName}`}
          clubName={club.name}
          fee="£18.4M"
          contract="4 years"
          card={<PlayerCard player={player} club={club} variant="legendary" />}
        />
      )}
    </>
  );
}

function ScreenDemo(): ReactNode {
  const [tab, setTab] = useState<TabId>('home');
  const [segment, setSegment] = useState('overview');
  const club = GALLERY_CLUBS[0];

  return (
    <div className="flex flex-wrap gap-6">
      <div className="relative h-[740px] w-[390px] shrink-0 overflow-hidden rounded-[38px] border border-white/12 bg-base shadow-lift">
        <Screen
          title="Club"
          subtitle="Ashvale Phoenix · 4th"
          actions={<GlassIcon label="Notifications" icon={<IconBell />} variant="ghost" badge={3} />}
          headerAccessory={
            <GlassSegmented
              value={segment}
              onChange={setSegment}
              options={[
                { value: 'overview', label: 'Overview' },
                { value: 'finance', label: 'Finance' },
                { value: 'facilities', label: 'Facilities' },
              ]}
              size="sm"
            />
          }
          footer={<GlassButton variant="primary" block>Advance week</GlassButton>}
        >
          <StatGrid columns={2}>
            <StatCard label="Transfer budget" value={8_400_000} prefix="£" delta={-1_200_000} deltaFormat={(v) => `£${Math.abs(v / 1_000_000).toFixed(1)}M`} />
            <StatCard label="Fan sentiment" value={71} suffix="%" delta={4} history={[52, 58, 61, 59, 66, 71]} />
          </StatGrid>
          <SectionHeader title="Next fixture" action="See all" onPress={() => undefined} />
          {GALLERY_CLUBS[0] && GALLERY_CLUBS[1] && (
            <MatchCard
              home={{ ...GALLERY_CLUBS[0], clubId: 'a', form: ['W', 'W', 'D'] }}
              away={{ ...GALLERY_CLUBS[1], clubId: 'b', form: ['L', 'W', 'W'] }}
              status="Sat 15:00"
              importance={5}
              isDerby
              competitionLabel="Week 15"
            />
          )}
          <SectionHeader title="Squad" />
          <div className="flex flex-col">
            {GALLERY_PLAYERS.map((player) => (
              <PlayerCard key={player.id} player={player} variant="compact" club={club} onPress={() => undefined} />
            ))}
          </div>
        </Screen>
        <TabBar value={tab} onChange={setTab} className="absolute" badges={{ social: 5 }} />
      </div>

      <div className="flex h-[560px] min-w-[420px] flex-1 overflow-hidden rounded-2xl border border-white/12 bg-base">
        <SideNav
          value={tab}
          onChange={setTab}
          badges={{ social: 5 }}
          header={club ? <ClubBadge visual={club.visual} size={40} label={club.name} /> : undefined}
        />
        <div className="min-w-0 flex-1">
          <Screen
            title="League"
            subtitle="Creator League · Week 15"
            aside={
              <>
                <GlassPanel title="Form guide">
                  <div className="flex flex-col gap-2">
                    {GALLERY_CLUBS.slice(0, 4).map((c, i) => (
                      <ClubCard key={c.id} club={c} variant="compact" trailing={<FormGuide results={GALLERY_STANDINGS[i]?.form ?? []} />} />
                    ))}
                  </div>
                </GlassPanel>
                <GlassPanel title="Top scorer">
                  {GALLERY_PLAYERS[0] && <PlayerCard player={GALLERY_PLAYERS[0]} club={club} variant="compact" />}
                </GlassPanel>
              </>
            }
          >
            <GlassPanel padding="sm">
              <div className="flex flex-col">
                {GALLERY_CLUBS.map((c, i) => (
                  <ClubCard key={c.id} club={c} variant="standings" standing={GALLERY_STANDINGS[i]} isOwn={i === 3} onPress={() => undefined} />
                ))}
              </div>
            </GlassPanel>
          </Screen>
        </div>
      </div>
    </div>
  );
}

/* --- the gallery ------------------------------------------------------ */

function GalleryBody(): ReactNode {
  const [viewport, setViewport] = useState<'mobile' | 'desktop'>('desktop');
  const [reducedMotion, setReducedMotion] = useState(false);
  const [reducedEffects, setReducedEffects] = useState(false);
  const [tab, setTab] = useState('standard');
  const [segment, setSegment] = useState('all');
  const [slider, setSlider] = useState(62);
  const [toggle, setToggle] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    document.documentElement.dataset['reducedEffects'] = reducedEffects ? 'true' : 'false';
  }, [reducedEffects]);

  const club = GALLERY_CLUBS[0];
  const player = GALLERY_PLAYERS[0];

  return (
    <ReducedMotionOverrideContext.Provider value={reducedMotion}>
      <div className="h-full overflow-y-auto bg-base">
        <header className="sticky top-0 z-30 glass-3 border-b border-white/[0.07]">
          <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-3 px-5 py-3">
            <div className="mr-auto">
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-volt">Creator Football</p>
              <h1 className="font-display text-[18px] font-bold tracking-[-0.02em] text-ink">Design system</h1>
            </div>
            <GlassSegmented
              value={viewport}
              onChange={setViewport}
              block={false}
              size="sm"
              aria-label="Preview width"
              options={[
                { value: 'mobile', label: 'Mobile' },
                { value: 'desktop', label: 'Desktop' },
              ]}
            />
            <GlassToggle checked={reducedMotion} onChange={setReducedMotion} aria-label="Reduced motion" size="sm" />
            <span className="text-[12px] text-ink-muted">Reduced motion</span>
            <GlassToggle checked={reducedEffects} onChange={setReducedEffects} aria-label="Reduced effects" size="sm" />
            <span className="text-[12px] text-ink-muted">Reduced effects</span>
          </div>
          <nav className="scroll-x mx-auto flex max-w-[1180px] gap-1 px-5 pb-2" aria-label="Sections">
            {SECTIONS.map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                className="shrink-0 rounded-pill px-3 py-1.5 text-[12px] font-semibold text-ink-dim hover:bg-white/[0.06] hover:text-ink"
              >
                {label}
              </a>
            ))}
          </nav>
        </header>

        <main
          className={cn(
            'mx-auto flex flex-col gap-10 px-5 py-8',
            viewport === 'mobile' ? 'max-w-[390px]' : 'max-w-[1180px]',
          )}
        >
          {/* --- foundations --- */}
          <Section id="foundations" title="Foundations" note="Everything below is generated from tokens.css. No component in the kit contains a hex value except the procedural art, which derives its colours from club identities at runtime.">
            <Row label="Surfaces">
              <Swatch name="void" className="bg-void" />
              <Swatch name="base" className="bg-base" />
              <Swatch name="surface-1" className="bg-surface-1" />
              <Swatch name="surface-2" className="bg-surface-2" />
              <Swatch name="surface-3" className="bg-surface-3" />
              <Swatch name="surface-4" className="bg-surface-4" />
            </Row>
            <Row label="Accent & semantic">
              <Swatch name="volt" className="bg-volt" />
              <Swatch name="volt-bright" className="bg-volt-bright" />
              <Swatch name="volt-deep" className="bg-volt-deep" />
              <Swatch name="positive" className="bg-positive" />
              <Swatch name="warning" className="bg-warning" />
              <Swatch name="danger" className="bg-danger" />
              <Swatch name="info" className="bg-info" />
              <Swatch name="special" className="bg-special" />
            </Row>
            <Row label="Glass levels (over a lit backdrop, so the blur is visible)">
              <div className="relative w-full overflow-hidden rounded-xl p-6" style={{ background: 'radial-gradient(60% 90% at 20% 10%, #2b3a12, #08090b 70%), radial-gradient(50% 70% at 90% 80%, #23204a, transparent)' }}>
                <div className="flex flex-wrap gap-3">
                  {([1, 2, 3, 4] as const).map((level) => (
                    <GlassCard key={level} level={level} className="w-[152px]">
                      <p className="text-[13px] font-semibold text-ink">Level {level}</p>
                      <p className="mt-1 text-[12px] text-ink-muted">blur-glass-{level}</p>
                    </GlassCard>
                  ))}
                </div>
              </div>
            </Row>
            <Row label="Type scale">
              <div className="flex w-full flex-col gap-1.5">
                <p className="font-display text-[32px] font-bold tracking-[-0.035em] text-ink">Large title · 32/700</p>
                <p className="font-display text-[24px] font-bold tracking-[-0.03em] text-ink">Title · 24/700</p>
                <p className="text-[17px] font-semibold text-ink">Headline · 17/600</p>
                <p className="text-[15px] text-ink">Body · 15/400</p>
                <p className="text-[13px] text-ink-muted">Secondary · 13/400 muted</p>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-dim">Micro label · 11/600 tracked</p>
                <p className="tnum font-mono text-[13px] text-ink">Tabular figures 0123456789</p>
              </div>
            </Row>
            <Row label="Radii">
              {/* Looked up from RADIUS_CLASS rather than interpolated: Tailwind
                  only emits classes it can see as complete literals. */}
              {(['xs', 'sm', 'md', 'lg', 'xl', '2xl', 'pill'] as const).map((r) => (
                <div key={r} className="w-[88px]">
                  <div className={cn('h-14 w-full border border-white/12 bg-surface-3', RADIUS_CLASS[r])} />
                  <p className="mt-1.5 font-mono text-[10px] text-ink-dim">{r}</p>
                </div>
              ))}
            </Row>
          </Section>

          {/* --- icons --- */}
          <Section id="icons" title="Icons" note={`${ICON_NAMES.length} icons on a 24px grid at 1.5px stroke. Hand-drawn — no icon package ships with this app.`}>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-2">
              {ICON_NAMES.map((name) => {
                const Component = ICONS[name];
                return (
                  <div key={name} className="flex flex-col items-center gap-1.5 rounded-md p-2.5 hover:bg-white/[0.05]">
                    <Component size={24} className="text-ink" />
                    <span className="truncate font-mono text-[9px] text-ink-dim">{name}</span>
                  </div>
                );
              })}
            </div>
          </Section>

          {/* --- buttons --- */}
          <Section id="buttons" title="Buttons & controls" note="Every interactive element clears a 44pt touch target, keeps a visible focus ring on glass, and has a spring-driven pressed state.">
            {(['primary', 'secondary', 'ghost', 'danger'] as const).map((variant) => (
              <Row key={variant} label={variant}>
                <GlassButton variant={variant} size="sm">Small</GlassButton>
                <GlassButton variant={variant} size="md">Medium</GlassButton>
                <GlassButton variant={variant} size="lg">Large</GlassButton>
                <GlassButton variant={variant} icon={<IconPlus size={18} />}>With icon</GlassButton>
                <GlassButton variant={variant} iconRight={<IconChevronRight size={18} />}>Trailing</GlassButton>
                <GlassButton variant={variant} loading>Loading</GlassButton>
                <GlassButton variant={variant} disabled>Disabled</GlassButton>
              </Row>
            ))}
            <Row label="Block">
              <GlassButton variant="primary" size="lg" block>Advance week</GlassButton>
            </Row>
            <Row label="Icon buttons">
              <GlassIcon label="Search" icon={<IconSearch />} size="sm" />
              <GlassIcon label="Search" icon={<IconSearch />} size="md" />
              <GlassIcon label="Search" icon={<IconSearch />} size="lg" />
              <GlassIcon label="Favourite" icon={<IconStar />} variant="volt" />
              <GlassIcon label="Notifications" icon={<IconBell />} variant="ghost" badge={9} />
              <GlassIcon label="Active filter" icon={<IconStar />} active />
              <GlassIcon label="Delete" icon={<IconStar />} variant="danger" />
              <GlassIcon label="Loading" icon={<IconStar />} loading />
              <GlassIcon label="Disabled" icon={<IconStar />} disabled />
            </Row>
            <Row label="Pills">
              {(['neutral', 'volt', 'positive', 'warning', 'danger', 'info', 'special'] as const).map((tone) => (
                <GlassPill key={tone} tone={tone}>{tone}</GlassPill>
              ))}
              {(['neutral', 'volt', 'positive', 'danger'] as const).map((tone) => (
                <GlassPill key={`f-${tone}`} tone={tone} filled>{tone}</GlassPill>
              ))}
            </Row>
            <Row label="Tabs — underline">
              <div className="w-full">
                <GlassTabs
                  value={tab}
                  onChange={setTab}
                  aria-label="Card variants"
                  items={[
                    { id: 'compact', label: 'Compact' },
                    { id: 'standard', label: 'Standard', badge: 3 },
                    { id: 'featured', label: 'Featured' },
                    { id: 'disabled', label: 'Disabled', disabled: true },
                  ]}
                />
              </div>
            </Row>
            <Row label="Tabs — enclosed">
              <GlassTabs
                appearance="enclosed"
                scrollable
                value={tab}
                onChange={setTab}
                items={[
                  { id: 'compact', label: 'Compact' },
                  { id: 'standard', label: 'Standard' },
                  { id: 'featured', label: 'Featured' },
                ]}
              />
            </Row>
            <Row label="Segmented">
              <div className="w-full max-w-md">
                <GlassSegmented
                  value={segment}
                  onChange={setSegment}
                  aria-label="Filter"
                  options={[
                    { value: 'all', label: 'All' },
                    { value: 'mine', label: 'My club' },
                    { value: 'watch', label: 'Watchlist' },
                  ]}
                />
              </div>
            </Row>
          </Section>

          {/* --- inputs --- */}
          <Section id="inputs" title="Inputs">
            <div className="grid gap-4 sm:grid-cols-2">
              <GlassInput label="Search players" placeholder="Name, position, club" icon={<IconSearch size={18} />} value={search} onChange={(e) => setSearch(e.target.value)} />
              <GlassInput label="Asking price" placeholder="0" hint="Rounded to the nearest £10,000." />
              <GlassInput label="Shirt number" defaultValue="99" error="Already taken by M. Okafor." />
              <GlassInput label="Disabled" placeholder="Locked until week 4" disabled />
            </div>
            <Row label="Slider">
              <div className="w-full max-w-md">
                <GlassSlider
                  label="Press intensity"
                  value={slider}
                  onChange={setSlider}
                  formatValue={(v) => `${v}%`}
                  marks={[{ value: 0, label: 'Passive' }, { value: 50, label: 'Balanced' }, { value: 100, label: 'Relentless' }]}
                />
                <div className="mt-4">
                  <GlassSlider label="Disabled" value={30} onChange={() => undefined} disabled />
                </div>
              </div>
            </Row>
            <Row label="Toggles">
              <div className="w-full max-w-md">
                <GlassToggle checked={toggle} onChange={setToggle} asRow label="Haptics" description="Vibration feedback for selections and key moments." />
                <GlassToggle checked={false} onChange={() => undefined} asRow label="Auto-resolve decisions" description="Live prompts pick the safe option if you do not answer." />
                <GlassToggle checked disabled onChange={() => undefined} asRow label="Disabled" description="Locked by the current difficulty." />
              </div>
            </Row>
          </Section>

          {/* --- overlays --- */}
          <Section id="overlays" title="Overlays" note="Sheets and modals trap focus, lock body scroll, close on Escape and on the backdrop, and are safe-area aware. The sheet is drag-to-dismiss with velocity detection.">
            <OverlayDemos />
          </Section>

          {/* --- badges --- */}
          <Section id="badges" title="Club badges" note="Procedurally generated from ClubVisualIdentity: shape × pattern × palette × motif. Twelve identities below, one per motif, all drawn by the same renderer with no image assets.">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-4">
              {GALLERY_IDENTITIES.map((identity) => (
                <div key={identity.abbr} className="flex flex-col items-center gap-2 rounded-lg p-3 hover:bg-white/[0.04]">
                  <ClubBadge visual={identity.visual} size={84} label={identity.name} />
                  <p className="text-center text-[12px] font-semibold text-ink">{identity.name}</p>
                  <p className="text-center font-mono text-[9px] leading-tight text-ink-dim">
                    {identity.visual.badgeShape} · {identity.visual.badgeMotif}
                    <br />
                    {identity.visual.style} · {identity.visual.kitPattern}
                  </p>
                </div>
              ))}
            </div>
            <Row label="Scale — 20px to 128px">
              {GALLERY_IDENTITIES[4] && [20, 28, 40, 64, 96, 128].map((size) => (
                <ClubBadge key={size} visual={GALLERY_IDENTITIES[4]!.visual} size={size} />
              ))}
            </Row>
            <Row label="Flat (list glyph)">
              {GALLERY_IDENTITIES.slice(0, 8).map((identity) => (
                <ClubBadge key={identity.abbr} visual={identity.visual} size={28} flat />
              ))}
            </Row>
          </Section>

          {/* --- portraits --- */}
          <Section id="portraits" title="Portraits" note="Deterministic from a seed string. Skin tone, hair style and colour, facial hair, head geometry, eye shape and the club-coloured backdrop are all derived from named channels of the seed, so a face is stable forever and adding a new feature never reshuffles existing ones.">
            <Row label="Same generator, twelve seeds">
              {Array.from({ length: 12 }, (_, i) => (
                <PlayerPortrait
                  key={i}
                  seed={`gallery-face-${i}`}
                  size={72}
                  shape="squircle"
                  colors={GALLERY_IDENTITIES[i] ? { primary: GALLERY_IDENTITIES[i]!.visual.primary, secondary: GALLERY_IDENTITIES[i]!.visual.secondary } : undefined}
                />
              ))}
            </Row>
            <Row label="Shapes and sizes">
              <PlayerPortrait seed="shape-a" size={40} shape="circle" />
              <PlayerPortrait seed="shape-b" size={56} shape="squircle" />
              <PlayerPortrait seed="shape-c" size={72} shape="square" />
              <PlayerPortrait seed="shape-d" size={96} shape="circle" ring="#c8ff2e" />
            </Row>
            <Row label="Creator avatars — tier ring and verification">
              {(['LOCAL', 'RISING', 'ESTABLISHED', 'MAJOR', 'GLOBAL'] as const).map((tier) => (
                <div key={tier} className="flex flex-col items-center gap-1.5">
                  <CreatorAvatar seed={`creator-${tier}`} size={56} tier={tier} verified={tier === 'MAJOR' || tier === 'GLOBAL'} />
                  <span className="font-mono text-[9px] text-ink-dim">{tier}</span>
                </div>
              ))}
            </Row>
          </Section>

          {/* --- player cards --- */}
          <Section id="playercards" title="Player cards" note="Six variants of one object. The diagonal identity plate, corner-bleeding portrait and hairline attribute strip are shared by every vertical variant so a player is recognisable anywhere in the product.">
            <Row label="standard / featured / transfer / legendary">
              {player && club && (
                <>
                  <div className="w-[168px]"><PlayerCard player={player} club={club} variant="standard" onPress={() => undefined} /></div>
                  <div className="w-[210px]"><PlayerCard player={player} club={club} variant="featured" /></div>
                  <div className="w-[168px]"><PlayerCard player={GALLERY_PLAYERS[1]!} club={GALLERY_CLUBS[1]} variant="transfer" price={18_400_000} statusLabel="3 clubs interested" /></div>
                  <div className="w-[210px]"><PlayerCard player={player} club={club} variant="legendary" /></div>
                </>
              )}
            </Row>
            <Row label="States — injured, suspended, dimmed, selected">
              {club && (
                <>
                  <div className="w-[168px]"><PlayerCard player={GALLERY_PLAYERS[2]!} club={club} /></div>
                  <div className="w-[168px]"><PlayerCard player={GALLERY_PLAYERS[4]!} club={club} /></div>
                  <div className="w-[168px]"><PlayerCard player={GALLERY_PLAYERS[3]!} club={club} dimmed /></div>
                  <div className="w-[168px]"><PlayerCard player={GALLERY_PLAYERS[5]!} club={club} selected onPress={() => undefined} /></div>
                </>
              )}
            </Row>
            <Row label="compact (squad list)">
              <div className="w-full max-w-md">
                {GALLERY_PLAYERS.map((p) => (
                  <PlayerCard key={p.id} player={p} club={club} variant="compact" onPress={() => undefined} />
                ))}
              </div>
            </Row>
            <Row label="matchday">
              <div className="flex w-full max-w-md flex-col gap-2">
                {GALLERY_PLAYERS.slice(0, 3).map((p) => (
                  <PlayerCard key={p.id} player={p} club={club} variant="matchday" trailing={<RatingBadge value={7.4} scale="match" size="sm" />} />
                ))}
              </div>
            </Row>
          </Section>

          {/* --- domain cards --- */}
          <Section id="cards" title="Domain cards">
            <Row label="Creator">
              <div className="flex w-full max-w-lg flex-col gap-2">
                {GALLERY_CREATORS.map((creator, i) => (
                  <CreatorCard
                    key={creator.id}
                    creator={creator}
                    variant={i === 0 ? 'featured' : i === 2 ? 'compact' : 'standard'}
                    onPress={() => undefined}
                    trailing={i === 1 ? <GlassButton size="sm" variant="primary">Sign</GlassButton> : undefined}
                  />
                ))}
              </div>
            </Row>
            <Row label="Club">
              <div className="flex w-full max-w-lg flex-col gap-3">
                {GALLERY_CLUBS[0] && <ClubCard club={GALLERY_CLUBS[0]} variant="featured" isOwn />}
                {GALLERY_CLUBS[1] && <ClubCard club={GALLERY_CLUBS[1]} variant="standard" onPress={() => undefined} />}
                <GlassPanel padding="sm">
                  {GALLERY_CLUBS.slice(0, 6).map((c, i) => (
                    <ClubCard key={c.id} club={c} variant="standings" standing={GALLERY_STANDINGS[i]} isOwn={i === 2} />
                  ))}
                </GlassPanel>
              </div>
            </Row>
            <Row label="Match">
              <div className="flex w-full max-w-lg flex-col gap-3">
                {GALLERY_CLUBS[0] && GALLERY_CLUBS[1] && (
                  <>
                    <MatchCard home={{ ...GALLERY_CLUBS[0], clubId: 'a', form: ['W', 'W', 'D'] }} away={{ ...GALLERY_CLUBS[1], clubId: 'b', form: ['L', 'D', 'W'] }} status="Sat 15:00" competitionLabel="Week 15" onPress={() => undefined} />
                    <MatchCard home={{ ...GALLERY_CLUBS[0], clubId: 'a' }} away={{ ...GALLERY_CLUBS[2]!, clubId: 'c' }} variant="live" homeScore={2} awayScore={1} status="78'" importance={5} isDerby competitionLabel="Derby day" />
                    <MatchCard home={{ ...GALLERY_CLUBS[3]!, clubId: 'd' }} away={{ ...GALLERY_CLUBS[4]!, clubId: 'e' }} variant="result" homeScore={0} awayScore={3} status="FT" competitionLabel="Week 14" />
                    <MatchCard home={{ ...GALLERY_CLUBS[0], clubId: 'a' }} away={{ ...GALLERY_CLUBS[5]!, clubId: 'f' }} variant="hero" status="Kick-off in 2h" importance={5} competitionLabel="Cup final" action={<GlassButton variant="primary" block>Enter matchday</GlassButton>} />
                  </>
                )}
              </div>
            </Row>
            <Row label="News">
              <div className="flex w-full max-w-lg flex-col gap-3">
                {GALLERY_STORIES[0] && <NewsCard story={GALLERY_STORIES[0]} variant="lead" timeLabel="2h" onPress={() => undefined} />}
                {GALLERY_STORIES[1] && <NewsCard story={GALLERY_STORIES[1]} timeLabel="1d" />}
                {GALLERY_STORIES[2] && <NewsCard story={GALLERY_STORIES[2]} variant="compact" timeLabel="3d" onPress={() => undefined} />}
              </div>
            </Row>
            <Row label="Social">
              <div className="w-full max-w-lg">
                {GALLERY_POSTS.map((post) => (
                  <SocialPost
                    key={post.id}
                    post={post}
                    timeLabel="4h"
                    liked={post.id === 'p1'}
                    onLike={() => undefined}
                    onRepost={() => undefined}
                    onReply={() => undefined}
                    onShare={() => undefined}
                  />
                ))}
              </div>
            </Row>
            <Row label="Card rail">
              <div className="w-full">
                <CardRail itemWidth={148} ariaLabel="Featured players">
                  {GALLERY_PLAYERS.map((p) => (
                    <PlayerCard key={p.id} player={p} club={club} onPress={() => undefined} />
                  ))}
                </CardRail>
              </div>
            </Row>
          </Section>

          {/* --- data --- */}
          <Section id="data" title="Data display">
            <Row label="Rating bands (56 / 62 / 71 / 82 / 91) and match ratings">
              {[52, 62, 71, 82, 91].map((v) => <RatingBadge key={v} value={v} size="md" />)}
              <RatingBadge value={91} size="xl" />
              <RatingBadge value={8.7} scale="match" />
              <RatingBadge value={5.1} scale="match" />
              <RatingBadge value={64} scale="percent" variant="bare" />
            </Row>
            <Row label="Positions">
              {(['GK', 'CB', 'LB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST'] as const).map((p) => (
                <PositionChip key={p} position={p} size="md" />
              ))}
              <PositionChip position="CB" size="md" outOfPosition />
            </Row>
            <Row label="Traits">
              <TraitChip trait={{ id: 'clutch', name: 'Clutch', blurb: 'Raises his level when the game is on the line.', kind: 'positive' }} />
              <TraitChip trait={{ id: 'showman', name: 'Showman', blurb: 'Fans buy tickets to watch him specifically.', kind: 'mixed' }} />
              <TraitChip trait={{ id: 'injury_prone', name: 'Injury Prone', blurb: 'His body keeps letting him down.', kind: 'negative' }} onPress={() => undefined} />
            </Row>
            <Row label="Form">
              <FormGuide results={['W', 'W', 'D', 'L', 'W']} />
              <FormGuide results={['L', 'L']} slots={5} />
              <FormGuide results={['W', 'W', 'W', 'W', 'W']} size="md" />
              <FormGuide results={[]} slots={5} />
            </Row>
            <Row label="Bars">
              <div className="flex w-full max-w-md flex-col gap-3">
                <ProgressBar label="Season objective" valueLabel="7 / 12" value={7} max={12} />
                <ProgressBar label="Wage budget" valueLabel="88%" value={88} tone="warning" marker={80} />
                <ProgressBar label="Squad fitness" valueLabel="41%" value={41} tone="danger" size="md" />
                <div className="mt-2 flex flex-col gap-2">
                  <AttributeBar label="Finishing" value={91} emphasis />
                  <AttributeBar label="Pace" value={78} delta={6} />
                  <AttributeBar label="Composure" value={62} />
                  <AttributeBar label="Vision" value={70} range={[54, 86]} />
                </div>
              </div>
            </Row>
            <Row label="Momentum">
              <div className="flex w-full max-w-md flex-col gap-3">
                <MomentumBar value={0.62} homeLabel="Ashvale" awayLabel="Northgate" />
                <MomentumBar value={-0.38} homeLabel="Ashvale" awayLabel="Northgate" />
                <MomentumBar value={0.02} homeLabel="Ashvale" awayLabel="Northgate" />
              </div>
            </Row>
            <Row label="Sparklines">
              <Sparkline values={[3, 5, 4, 8, 7, 11, 14]} tone="positive" fill label="Form trend" />
              <Sparkline values={[14, 11, 12, 8, 9, 5, 3]} tone="danger" fill />
              <Sparkline values={[6, 6, 7, 6, 8, 7, 7]} tone="neutral" />
            </Row>
            <Row label="Numbers">
              <div className="flex flex-wrap items-center gap-6">
                <span className="font-display text-[34px] font-bold text-ink"><Counter value={184_320} /></span>
                <MoneyLabel amount={18_400_000} size="xl" />
                <MoneyLabel amount={-420_000} signed size="lg" />
                <MoneyLabel amount={950} size="md" />
                <TrendIndicator delta={12} format={(v) => `${v}%`} size="md" />
                <TrendIndicator delta={-3200} invert format={(v) => `£${Math.abs(v)}`} />
                <TrendIndicator delta={0} />
              </div>
            </Row>
            <Row label="Scores">
              <ScoreDisplay home={2} away={1} size="sm" status="FT" />
              <ScoreDisplay home={2} away={1} size="md" status="78'" live />
              <ScoreDisplay home={3} away={0} size="lg" status="Full time" />
              <ScoreDisplay home={4} away={4} size="hero" />
            </Row>
            <Row label="Stat cards">
              <div className="w-full">
                <StatGrid columns={4}>
                  <StatCard label="Points" value={35} delta={3} />
                  <StatCard label="Goals for" value={38} history={[2, 3, 1, 4, 2, 5]} />
                  <StatCard label="Wage bill" value={412_000} prefix="£" delta={18_000} deltaInvert deltaFormat={(v) => `£${(v / 1000).toFixed(0)}K`} />
                  <StatCard label="Followers" value={940_000} tone="special" footnote="+2.1% this week" />
                </StatGrid>
              </div>
            </Row>
            <Row label="Match events">
              <div className="w-full max-w-lg">
                {GALLERY_EVENTS.map((event) => (
                  <MatchEventRow key={event.id} event={event} perspective="home" />
                ))}
              </div>
            </Row>
            <Row label="Timeline">
              <div className="w-full max-w-lg">
                <Timeline
                  items={[
                    { id: '1', title: 'Opening bid submitted', description: '£12.0M plus add-ons.', time: 'Week 11', tone: 'neutral' },
                    { id: '2', title: 'Rejected', description: 'Northgate value him at £19M and are not under pressure.', time: 'Week 11', tone: 'danger' },
                    { id: '3', title: 'Agent talks opened', description: 'Wants a first-team guarantee and a release clause.', time: 'Week 12', tone: 'warning' },
                    { id: '4', title: 'Personal terms agreed', time: 'Week 13', tone: 'positive' },
                    { id: '5', title: 'Medical scheduled', description: 'Waiting on the selling club.', time: 'Week 14', pending: true },
                  ]}
                />
              </div>
            </Row>
          </Section>

          {/* --- feedback --- */}
          <Section id="feedback" title="Feedback">
            <Row label="Skeletons">
              <div className="flex w-full max-w-lg flex-col gap-4">
                <Skeleton variant="title" />
                <Skeleton variant="text" lines={3} />
                <div className="flex gap-3">
                  <Skeleton variant="circle" />
                  <div className="flex-1"><Skeleton variant="text" lines={2} /></div>
                </div>
                <div className="flex gap-3">
                  {[0, 1, 2].map((i) => <div key={i} className="w-[112px]"><Skeleton variant="card" /></div>)}
                </div>
              </div>
            </Row>
            <Row label="Empty">
              <div className="w-full max-w-md rounded-lg glass-1">
                <EmptyState
                  title="No one on your shortlist"
                  description="Scout a player to start tracking them. Reports stay accurate for four weeks."
                  icon={<IconSearch />}
                  action={<GlassButton variant="primary">Open the market</GlassButton>}
                />
              </div>
              <div className="w-full max-w-xs rounded-lg glass-1">
                <EmptyState size="sm" title="No trophies yet" icon={<IconTrophy />} description="Win the league and this cabinet fills up." />
              </div>
            </Row>
            <Row label="Error">
              <div className="w-full max-w-md rounded-lg glass-1">
                <ErrorState
                  detail="SAVE_WRITE_FAILED: quota exceeded"
                  onRetry={() => undefined}
                />
              </div>
            </Row>
          </Section>

          {/* --- structure --- */}
          <Section id="structure" title="Layout">
            <Row label="Section headers & dividers">
              <div className="flex w-full max-w-lg flex-col gap-4">
                <SectionHeader title="Squad" subtitle="18 registered · 2 unavailable" />
                <SectionHeader title="Transfer targets" action="See all" onPress={() => undefined} />
                <Divider />
                <Divider label="Older" />
              </div>
            </Row>
            <Row label="Key-value rows">
              <GlassPanel title="Contract" className="w-full max-w-md">
                <KeyValueRow label="Wage" value="£42,000 / week" />
                <KeyValueRow label="Expires" value="Season 5" hint="Renewal talks open in 6 weeks." />
                <KeyValueRow label="Release clause" value="£28.0M" emphasis />
                <KeyValueRow label="Agent" value="R. Halloway" onPress={() => undefined} divided={false} />
              </GlassPanel>
            </Row>
            <Row label="Accordion">
              <GlassPanel className="w-full max-w-md">
                <Accordion title="Attacking" subtitle="4 attributes" defaultOpen>
                  <div className="flex flex-col gap-2">
                    <AttributeBar label="Finishing" value={91} emphasis />
                    <AttributeBar label="Shooting" value={84} />
                    <AttributeBar label="Dribbling" value={77} />
                  </div>
                </Accordion>
                <Accordion title="Defending" subtitle="2 attributes">
                  <div className="flex flex-col gap-2">
                    <AttributeBar label="Defending" value={38} />
                    <AttributeBar label="Positioning" value={52} />
                  </div>
                </Accordion>
                <Accordion title="Mentality" subtitle="Hidden until scouted">
                  <p className="text-[13px] text-ink-muted">Send a scout to reveal these.</p>
                </Accordion>
              </GlassPanel>
            </Row>
            <Row label="Panels">
              <GlassPanel title="Board confidence" accent="volt" className="w-[280px]">
                <ProgressBar value={74} valueLabel="74%" />
              </GlassPanel>
              <GlassPanel title="Fan unrest" accent="danger" className="w-[280px]">
                <ProgressBar value={32} tone="danger" valueLabel="32%" />
              </GlassPanel>
              <GlassCard level={1} nested className="w-[280px]">
                <p className="text-[13px] text-ink-muted">A level-1 card marked <code className="font-mono text-ink">nested</code>: solid tint, no second blur.</p>
              </GlassCard>
            </Row>
          </Section>

          {/* --- screen --- */}
          <Section id="screen" title="Screen scaffold" note="Left: the phone composition with a collapsing large title and a bottom tab bar. Right: the same component at desktop width, with a side nav and a second column. Same design language, one product.">
            <ScreenDemo />
          </Section>

          {/* --- hero --- */}
          <Section id="hero" title="Hero moments" note="Reserved for nine moments: club reveal, player signing, match start, goal, big save, trophy, promotion, record, legendary achievement. Everything else in the product stays calm — that contrast is the whole point.">
            <HeroDemos />
          </Section>
        </main>
      </div>
    </ReducedMotionOverrideContext.Provider>
  );
}

export function Gallery(): ReactNode {
  return (
    <ToastProvider>
      <GalleryBody />
    </ToastProvider>
  );
}

export default Gallery;
