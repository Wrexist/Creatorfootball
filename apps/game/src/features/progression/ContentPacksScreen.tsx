import { memo, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { IDENTITY_KINDS, isLicensed, type GameState, type IdentityKind } from '@cf/engine';
import {
  Divider, EmptyState, GlassButton, GlassPanel, GlassPill, IconCheck, IconInfo, IconLock,
  IconWarning, KeyValueRow, Screen, SectionHeader, StatGrid, StatCard, cn,
} from '@/design';
import { ROUTES } from '@/app/routes';
import { GateScreen, useGameStatus } from './gate';
import { usePacks, type PackView } from './engine';

/**
 * Content packs and licensing.
 *
 * Two commitments are made visible here rather than buried in a legal page.
 *
 * First: the base game is 100% fictional and complete on its own. Licensed
 * content is strictly additive, and this screen says so at the top rather than
 * implying that the "real" version is the one you have not bought.
 *
 * Second: when a licence lapses, the pack is shown as unavailable with the
 * reason attached. Content silently disappearing from a save is how players
 * conclude a game is broken, and it is also how a studio quietly avoids saying
 * that a deal ended.
 */

const IDENTITY_LABEL: Record<IdentityKind, string> = {
  FICTIONAL: 'Fictional',
  COMMUNITY_CREATED: 'Community',
  LICENSED_CREATOR: 'Licensed creator',
  LICENSED_FOOTBALLER: 'Licensed footballer',
};

const IDENTITY_BLURB: Record<IdentityKind, string> = {
  FICTIONAL:
    'Invented from nothing — clubs, players, creators, nations. Nothing here depends on anyone renewing a deal, so it can never be taken away from you.',
  COMMUNITY_CREATED:
    'Made by players and shared. Held to the same schema as everything else, and clearly attributed to whoever built it.',
  LICENSED_CREATOR:
    'A real creator who agreed to appear, under a licence with a term, a region and a set of permissions. If any of those lapse, the entity is replaced by its fictional stand-in rather than deleted.',
  LICENSED_FOOTBALLER:
    'A real footballer, under the same kind of licence. The same rules apply, for the same reasons.',
};

const IDENTITY_TONE: Record<IdentityKind, 'neutral' | 'info' | 'volt' | 'special'> = {
  FICTIONAL: 'volt',
  COMMUNITY_CREATED: 'info',
  LICENSED_CREATOR: 'special',
  LICENSED_FOOTBALLER: 'special',
};

const PackCard = memo(function PackCard({ pack }: { pack: PackView }): ReactNode {
  const licensed = isLicensed(pack.manifest.identityKind);
  const counts = pack.counts;
  const entries: readonly [string, number][] = [
    ['Clubs', counts.clubs],
    ['Players', counts.players],
    ['Creators', counts.creators],
    ['Managers', counts.managers],
    ['Sponsors', counts.sponsors],
    ['Facilities', counts.facilities],
    ['Objectives', counts.objectives],
    ['Store offers', counts.offers],
    ['Commentary lines', counts.commentary],
    ['Social templates', counts.social],
    ['Media templates', counts.media],
  ];

  return (
    <GlassPanel
      padding="md"
      accent={pack.available ? 'none' : 'danger'}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={cn(
            'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md',
            pack.available ? 'bg-volt/15 text-volt' : 'bg-danger/15 text-danger',
          )}
        >
          {pack.available ? <IconCheck size={18} /> : <IconLock size={18} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <GlassPill tone={IDENTITY_TONE[pack.manifest.identityKind]} size="xs" filled>
              {IDENTITY_LABEL[pack.manifest.identityKind]}
            </GlassPill>
            <GlassPill size="xs">v{pack.manifest.version}</GlassPill>
            {!pack.available && (
              <GlassPill tone="danger" size="xs" filled>Unavailable</GlassPill>
            )}
            {pack.available && !pack.enabled && (
              <GlassPill tone="warning" size="xs">Disabled</GlassPill>
            )}
          </div>
          <p className="mt-1.5 font-display text-[18px] font-bold leading-tight text-ink">
            {pack.manifest.name}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-muted text-pretty">
            {pack.manifest.description}
          </p>
        </div>
      </div>

      {!pack.available && (
        <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-danger/25 bg-danger/[0.07] p-3">
          <IconWarning size={16} className="mt-0.5 shrink-0 text-danger" />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-ink">{pack.reason}</p>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-muted text-pretty">
              Its entities are replaced by their fictional stand-ins. Your save is intact, and
              nothing has been deleted.
            </p>
          </div>
        </div>
      )}

      <Divider className="my-3" label="What is in it" />
      <div className="grid grid-cols-2 gap-x-4 sm:grid-cols-3">
        {entries
          .filter(([, value]) => value > 0)
          .map(([label, value]) => (
            <KeyValueRow key={label} label={label} value={value} divided={false} />
          ))}
      </div>

      <Divider className="my-3" />
      <KeyValueRow label="Provider" value={pack.manifest.provider} />
      <KeyValueRow
        label="Regions"
        value={pack.manifest.regions.length === 0 ? 'Worldwide' : pack.manifest.regions.join(', ')}
      />
      {licensed && pack.manifest.rights && (
        <>
          <KeyValueRow label="Licence status" value={pack.manifest.rights.status.toLowerCase()} />
          <KeyValueRow
            label="Expires"
            value={
              pack.manifest.rights.expiresAt === undefined
                ? 'Perpetual'
                : new Date(pack.manifest.rights.expiresAt).toLocaleDateString()
            }
          />
          <KeyValueRow
            label="Permits"
            value={Object.entries(pack.manifest.rights.grants)
              .filter(([, allowed]) => allowed)
              .map(([grant]) => grant)
              .join(', ') || 'nothing'}
            divided={false}
          />
        </>
      )}
      {!licensed && (
        <KeyValueRow
          label="Rights"
          value="None needed"
          hint="Nothing in this pack depends on a licence staying alive"
          divided={false}
        />
      )}
    </GlassPanel>
  );
});

function ContentPacksView({ state }: { state: GameState }): ReactNode {
  const navigate = useNavigate();
  // A single timestamp for the whole screen: licence checks must not shift
  // between one card and the next.
  const [now] = useState(() => Date.now());
  const packs = usePacks(state, now);

  const totals = useMemo(() => {
    let entities = 0;
    for (const pack of packs) {
      entities += pack.counts.clubs + pack.counts.players + pack.counts.creators + pack.counts.managers;
    }
    return {
      installed: packs.length,
      available: packs.filter((p) => p.available).length,
      entities,
    };
  }, [packs]);

  return (
    <Screen
      title="Content"
      subtitle={`${totals.installed} pack${totals.installed === 1 ? '' : 's'} installed`}
      onBack={() => navigate(ROUTES.settings)}
      aside={
        <GlassPanel title="The four identity kinds" padding="md">
          <div className="flex flex-col gap-3">
            {IDENTITY_KINDS.map((kind) => (
              <div key={kind}>
                <GlassPill tone={IDENTITY_TONE[kind]} size="xs" filled={!isLicensed(kind)}>
                  {IDENTITY_LABEL[kind]}
                </GlassPill>
                <p className="mt-1.5 text-[12px] leading-relaxed text-ink-muted text-pretty">
                  {IDENTITY_BLURB[kind]}
                </p>
              </div>
            ))}
          </div>
        </GlassPanel>
      }
    >
      <GlassPanel padding="md" accent="volt">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-pill bg-volt/15 text-volt"
          >
            <IconInfo size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-ink">The base game is complete</p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-muted text-pretty">
              Every club, player, creator and competition you need is fictional and shipped with the
              game. Licensed packs add faces and names you might recognise; they never add ability,
              advantage or anything the base game is missing.
            </p>
          </div>
        </div>
      </GlassPanel>

      <StatGrid columns={3}>
        <StatCard label="Installed" value={totals.installed} size="sm" />
        <StatCard
          label="Available"
          value={totals.available}
          size="sm"
          tone={totals.available < totals.installed ? 'warning' : 'positive'}
        />
        <StatCard label="Entities" value={totals.entities} size="sm" />
      </StatGrid>

      <SectionHeader title="Installed packs" subtitle={`Region: ${state.settings.region || 'Worldwide'}`} />
      {packs.length === 0 ? (
        <EmptyState
          icon={<IconInfo />}
          title="No packs loaded"
          description="That should not be possible — the base pack ships with the game. Try reloading your save."
        />
      ) : (
        packs.map((pack) => <PackCard key={pack.manifest.id} pack={pack} />)
      )}

      <GlassPanel padding="md">
        <p className="text-[13px] leading-relaxed text-ink-muted text-pretty">
          Content packs are validated before they load. A pack with an unresolved reference is
          refused outright rather than half-loaded, because a half-loaded pack is worse than an
          absent one.
        </p>
        <Divider className="my-3" />
        <GlassButton variant="secondary" block onClick={() => navigate(ROUTES.settings)}>
          Back to settings
        </GlassButton>
      </GlassPanel>
    </Screen>
  );
}

export function ContentPacksScreen(): ReactNode {
  const gate = useGameStatus();
  if (gate.status !== 'ready') return <GateScreen gate={gate} title="Content" />;
  return <ContentPacksView state={gate.state} />;
}
