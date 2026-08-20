import { memo, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GameState, StoreOfferDef } from '@cf/engine';
import {
  Divider, EmptyState, GlassButton, GlassPanel, GlassPill, GlassSegmented, GlassSheet,
  HeroSurface, IconCheck, IconScout, IconStar, KeyValueRow, Screen, SectionHeader, cn,
  useToast,
} from '@/design';
import { ROUTES } from '@/app/routes';
import { GateScreen, useGameStatus } from './gate';
import { ROTATION_LENGTH, useOwned, useStore } from './engine';

/**
 * The store.
 *
 * This must never feel like a casino, and the way to guarantee that is to
 * remove the mechanisms rather than to soften their copy:
 *
 *   - every offer lists its exact contents; nothing is randomised, so there is
 *     nothing to gamble on;
 *   - there are no countdown timers. The catalogue rotates on the matchweek
 *     calendar and every offer comes back, and the screen says so out loud;
 *   - "limited" is only shown for offers that genuinely have an end cycle. An
 *     offer with no window is never dressed as scarce;
 *   - discounts are stated as a plain percentage off the standing price. No
 *     struck-through reference price is invented to make the number look bigger;
 *   - anything already owned is marked owned and cannot be bought again.
 *
 * And the hard line underneath all of it: nothing sold here changes a result.
 */

type Category = 'ALL' | 'COSMETIC' | 'CONVENIENCE' | 'TOKENS';

const CATEGORIES: readonly { value: Category; label: string }[] = [
  { value: 'ALL', label: 'Everything' },
  { value: 'COSMETIC', label: 'Cosmetics' },
  { value: 'CONVENIENCE', label: 'Convenience' },
  { value: 'TOKENS', label: 'Tokens' },
];

function categoryOf(offer: StoreOfferDef): Exclude<Category, 'ALL'> {
  const kinds = offer.contents.map((c) => c.kind);
  if (kinds.includes('COSMETIC')) return 'COSMETIC';
  if (kinds.includes('PREMIUM')) return 'TOKENS';
  return 'CONVENIENCE';
}

const CATEGORY_LABEL: Record<Exclude<Category, 'ALL'>, string> = {
  COSMETIC: 'Cosmetic',
  CONVENIENCE: 'Convenience',
  TOKENS: 'Tokens',
};

/** Real money, formatted as real money — never through the in-game currency. */
function price(offer: StoreOfferDef): string {
  const amount = offer.priceMinor / 100;
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: offer.currency }).format(amount);
  } catch {
    return `${offer.currency} ${amount.toFixed(2)}`;
  }
}

const CONTENT_NOTE: Record<string, string> = {
  COSMETIC: 'Appearance only. No effect on any match.',
  PREMIUM: 'Spendable on cosmetics and convenience only.',
  SCOUT_CREDIT: 'Speeds up information you could gather anyway.',
  FACILITY_CREDIT: 'Offsets part of an upgrade you still have to choose.',
};

interface OfferCardProps {
  offer: StoreOfferDef;
  owned: boolean;
  cycle: number;
  onOpen: (sku: string) => void;
}

const OfferCard = memo(function OfferCard({
  offer, owned, cycle, onOpen,
}: OfferCardProps): ReactNode {
  const featured = offer.treatment === 'FEATURED';
  // "Limited" is only honest when there is an actual end to point at.
  const genuinelyLimited = offer.endCycle !== null && offer.endCycle >= cycle;

  return (
    <GlassPanel
      padding="md"
      accent={featured ? 'volt' : 'none'}
      className={cn(featured && 'sm:col-span-2')}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-0.5 size-9 shrink-0 rounded-md"
          style={{ background: `linear-gradient(140deg, ${offer.accent} 0%, ${offer.accent}22 100%)` }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <GlassPill size="xs">{CATEGORY_LABEL[categoryOf(offer)]}</GlassPill>
            {featured && <GlassPill tone="volt" size="xs" filled>Featured</GlassPill>}
            {genuinelyLimited && (
              <GlassPill tone="warning" size="xs">
                Until matchweek {offer.endCycle}
              </GlassPill>
            )}
            {offer.discountPercent > 0 && (
              <GlassPill tone="positive" size="xs" filled>
                {offer.discountPercent}% off
              </GlassPill>
            )}
            {owned && <GlassPill tone="positive" size="xs" icon={<IconCheck size={11} />}>Owned</GlassPill>}
          </div>
          <p className="mt-1.5 font-display text-[17px] font-bold leading-tight text-ink text-pretty">
            {offer.name}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-muted text-pretty">
            {offer.description}
          </p>
        </div>
      </div>

      <ul className="mt-3 flex flex-col gap-1">
        {offer.contents.map((item, index) => (
          <li key={`${item.kind}-${index}`} className="flex items-start gap-2">
            <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-pill bg-white/30" />
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold text-ink">{item.label}</span>
              {CONTENT_NOTE[item.kind] && (
                <span className="block text-[12px] text-ink-dim text-pretty">
                  {CONTENT_NOTE[item.kind]}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center gap-3">
        <span className="tnum flex-1 font-display text-[19px] font-bold text-ink">
          {price(offer)}
        </span>
        <GlassButton
          variant={owned ? 'ghost' : 'primary'}
          size="md"
          disabled={owned}
          onClick={() => onOpen(offer.sku)}
        >
          {owned ? 'Owned' : 'See what you get'}
        </GlassButton>
      </div>
    </GlassPanel>
  );
});

function StoreView({ state }: { state: GameState }): ReactNode {
  const navigate = useNavigate();
  const toast = useToast();
  const store = useStore(state);
  const owned = useOwned(state);
  const [category, setCategory] = useState<Category>('ALL');
  const [open, setOpen] = useState<string | null>(null);

  const isOwned = (offer: StoreOfferDef): boolean =>
    offer.contents.some((item) => item.kind === 'COSMETIC' && item.ref !== undefined && owned.has(item.ref));

  const thisWeek = useMemo(
    () => store.thisRotation.filter((offer) => category === 'ALL' || categoryOf(offer) === category),
    [store.thisRotation, category],
  );
  const later = useMemo(
    () => store.rest.filter((offer) => category === 'ALL' || categoryOf(offer) === category),
    [store.rest, category],
  );

  const opened = open
    ? [...store.thisRotation, ...store.rest].find((offer) => offer.sku === open)
    : undefined;

  return (
    <Screen
      title="Store"
      subtitle={`Rotation week ${store.week} of ${ROTATION_LENGTH}`}
      aside={
        <GlassPanel title="What this store is" padding="md" accent="volt">
          <ul className="flex flex-col gap-2.5">
            <TrustLine text="Cosmetics, convenience and content. Nothing that changes a result." />
            <TrustLine text="No randomised bundles. Every item is listed before you pay." />
            <TrustLine text="No countdowns. The catalogue rotates on the matchweek calendar and everything returns." />
            <TrustLine text="Nothing you already own is offered to you again." />
          </ul>
          <Divider className="my-3" />
          <p className="text-[12px] leading-relaxed text-ink-dim text-pretty">
            If an offer here ever looks designed to rush you, that is a bug in this screen and not a
            feature of the game.
          </p>
        </GlassPanel>
      }
    >
      <HeroSurface
        eyebrow="Store"
        title="Nothing here changes a result"
        subtitle={`Kits, badges and conveniences — itemised, priced once, and never randomised. The selection rotates every ${ROTATION_LENGTH} matchweeks and every offer comes back around, so there is nothing you have to buy today.`}
        texture="haze"
        padding="md"
        footer={
          <div className="flex flex-wrap gap-1.5">
            <GlassPill size="xs" icon={<IconCheck size={11} />}>Exact contents listed</GlassPill>
            <GlassPill size="xs" icon={<IconCheck size={11} />}>No countdowns</GlassPill>
            <GlassPill size="xs" icon={<IconCheck size={11} />}>No loot boxes</GlassPill>
            <GlassPill size="xs" icon={<IconCheck size={11} />}>No fake reference prices</GlassPill>
          </div>
        }
      />

      <GlassSegmented
        options={CATEGORIES}
        value={category}
        onChange={setCategory}
        aria-label="Filter the catalogue"
        size="sm"
        block
      />

      <SectionHeader title="This rotation" subtitle={`Rotation week ${store.week}`} />
      {thisWeek.length === 0 ? (
        <EmptyState
          size="sm"
          icon={<IconStar />}
          title="Nothing in this category right now"
          description="The catalogue rotates. Check the rest of the catalogue below — nothing is gone for good."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {thisWeek.map((offer) => (
            <OfferCard
              key={offer.sku}
              offer={offer}
              owned={isOwned(offer)}
              cycle={state.clock.cycle}
              onOpen={setOpen}
            />
          ))}
        </div>
      )}

      {later.length > 0 && (
        <>
          <SectionHeader
            title="The rest of the catalogue"
            subtitle="Shown so you always know what exists, not to hurry you"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            {later.map((offer) => (
              <OfferCard
                key={offer.sku}
                offer={offer}
                owned={isOwned(offer)}
                cycle={state.clock.cycle}
                onOpen={setOpen}
              />
            ))}
          </div>
        </>
      )}

      <GlassButton variant="ghost" block icon={<IconScout />} onClick={() => navigate(ROUTES.contentPacks)}>
        Content packs and licensing
      </GlassButton>

      <GlassSheet
        open={open !== null}
        onClose={() => setOpen(null)}
        title={opened?.name ?? 'Offer'}
        subtitle={opened ? price(opened) : undefined}
        size="auto"
        footer={
          <GlassButton
            variant="primary"
            block
            onClick={() => {
              setOpen(null);
              toast.warning(
                'Checkout is not available yet',
                'Purchases will go through the platform store. Nothing has been charged.',
              );
            }}
          >
            Buy {opened ? price(opened) : ''}
          </GlassButton>
        }
      >
        {opened ? (
          <div className="flex flex-col gap-3">
            <p className="text-[14px] leading-relaxed text-ink-muted text-pretty">
              {opened.description}
            </p>
            <Divider label="Exactly what you get" />
            <div>
              {opened.contents.map((item, index) => (
                <KeyValueRow
                  key={`${item.kind}-${index}`}
                  label={item.label}
                  value={item.amount > 1 ? `×${item.amount}` : '1'}
                  {...(CONTENT_NOTE[item.kind] ? { hint: CONTENT_NOTE[item.kind] } : {})}
                  divided={index < opened.contents.length - 1}
                />
              ))}
            </div>
            <Divider />
            <KeyValueRow
              label="Purchase limit"
              value={opened.purchaseLimit === null ? 'None' : `${opened.purchaseLimit} per account`}
              divided={false}
            />
            <KeyValueRow
              label="Availability"
              value={opened.endCycle === null ? 'Returns every rotation' : `Until matchweek ${opened.endCycle}`}
              divided={false}
            />
            <p className="text-[12px] leading-relaxed text-ink-dim text-pretty">
              Nothing in this bundle affects a match, a negotiation or a player's ability. If it did,
              it would not be for sale.
            </p>
          </div>
        ) : null}
      </GlassSheet>
    </Screen>
  );
}

function TrustLine({ text }: { text: string }): ReactNode {
  return (
    <li className="flex items-start gap-2">
      <span
        aria-hidden="true"
        className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-pill bg-volt/20 text-volt"
      >
        <IconCheck size={11} />
      </span>
      <span className="text-[13px] leading-relaxed text-ink-muted text-pretty">{text}</span>
    </li>
  );
}

export function StoreScreen(): ReactNode {
  const gate = useGameStatus();
  if (gate.status !== 'ready') return <GateScreen gate={gate} title="Store" />;
  return <StoreView state={gate.state} />;
}
