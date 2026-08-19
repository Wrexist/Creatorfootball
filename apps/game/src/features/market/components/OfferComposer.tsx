import { useEffect, useState, type ReactNode } from 'react';
import {
  SQUAD_ROLE_LABELS,
  type NegotiationStage,
  type NegotiationTerms,
  type SquadRole,
} from '@cf/engine';
import {
  Divider, GlassButton, GlassSegmented, GlassSheet, GlassSlider, GlassToggle,
  KeyValueRow, MoneyLabel, SectionHeader,
} from '@/design';
import { ROLE_ORDER, gapBetween, lifetimeCost, roleLabel } from '../terms';
import { plainMoney } from '../format';

/**
 * The offer composer.
 *
 * Only the controls that matter at the current stage are shown. You cannot
 * haggle over a signing-on fee with a selling club, and pretending otherwise is
 * what makes transfer screens feel like tax returns. Every control carries the
 * other side's number as a marker on the track, so the player is always
 * negotiating against something rather than guessing into a void.
 */

export interface OfferComposerProps {
  open: boolean;
  stage: NegotiationStage;
  playerName: string;
  initial: NegotiationTerms;
  demand: NegotiationTerms;
  agentFeeDemand: number;
  transferBudget: number;
  wageHeadroom: number;
  onClose: () => void;
  onSubmit: (terms: NegotiationTerms, agentFee: number) => void;
}

const ROLE_OPTIONS = ROLE_ORDER.map((role) => ({ value: role, label: SQUAD_ROLE_LABELS[role] }));

export function OfferComposer({
  open, stage, playerName, initial, demand, agentFeeDemand,
  transferBudget, wageHeadroom, onClose, onSubmit,
}: OfferComposerProps): ReactNode {
  const [terms, setTerms] = useState<NegotiationTerms>(initial);
  const [agentFee, setAgentFee] = useState(agentFeeDemand);
  const [clause, setClause] = useState(initial.releaseClause !== null);

  // Re-seed whenever the room's position changes: the composer should always
  // open showing where the talks actually stand, not where they stood an hour ago.
  useEffect(() => {
    if (!open) return;
    setTerms(initial);
    setAgentFee(agentFeeDemand);
    setClause(initial.releaseClause !== null);
  }, [open, initial, agentFeeDemand]);

  const patch = (delta: Partial<NegotiationTerms>): void => setTerms((t) => ({ ...t, ...delta }));

  const feeStage = stage === 'OPENING' || stage === 'CLUB_TALKS';
  const playerStage = stage === 'PLAYER_TALKS';
  const agentStage = stage === 'AGENT_TALKS';

  const feeGap = gapBetween(terms.fee, demand.fee);
  const wageGap = gapBetween(terms.wage, demand.wage);
  const agentGap = gapBetween(agentFee, agentFeeDemand);
  const total = lifetimeCost(terms, agentFee);

  const title = feeStage ? 'Bid for him' : playerStage ? 'Talk terms' : 'Settle the agent';
  const subtitle = feeStage
    ? 'You are negotiating with his club'
    : playerStage
      ? `You are negotiating with ${playerName}`
      : 'You are negotiating with his agent';

  return (
    <GlassSheet
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      size="tall"
      footer={
        <div className="flex gap-3">
          <GlassButton variant="ghost" block onClick={onClose}>
            Not yet
          </GlassButton>
          <GlassButton
            variant="primary"
            block
            onClick={() => onSubmit({ ...terms, releaseClause: clause ? terms.releaseClause : null }, agentFee)}
          >
            Put it to them
          </GlassButton>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {feeStage && (
          <section className="flex flex-col gap-4">
            <SectionHeader
              title="Transfer fee"
              subtitle={`They value him at ${plainMoney(demand.fee)}`}
            />
            <GlassSlider
              label="Your bid"
              value={terms.fee}
              min={0}
              max={Math.max(Math.round(demand.fee * 1.6), Math.round(transferBudget), 1)}
              step={Math.max(10_000, Math.round(demand.fee / 100))}
              marks={[{ value: demand.fee, label: 'Their valuation' }]}
              onChange={(fee) => patch({ fee })}
              formatValue={(v) => plainMoney(v)}
              tone={feeGap.tone === 'danger' ? 'danger' : 'volt'}
            />
            <KeyValueRow label="Against their valuation" value={feeGap.label} divided={false} />
            <KeyValueRow
              label="Against your budget"
              value={<MoneyLabel amount={transferBudget - terms.fee} signed size="md" />}
              hint="Left in the transfer budget if this bid is accepted"
              divided={false}
            />
          </section>
        )}

        {playerStage && (
          <>
            <section className="flex flex-col gap-4">
              <SectionHeader
                title="The package"
                subtitle={`He is asking ${plainMoney(demand.wage)} a week as a ${roleLabel(demand.role).toLowerCase()}`}
              />
              <GlassSlider
                label="Weekly wage"
                value={terms.wage}
                min={0}
                max={Math.max(Math.round(demand.wage * 2), 1)}
                step={Math.max(100, Math.round(demand.wage / 100))}
                marks={[{ value: demand.wage, label: 'His demand' }]}
                onChange={(wage) => patch({ wage })}
                formatValue={(v) => plainMoney(v)}
                tone={wageGap.tone === 'danger' ? 'danger' : 'volt'}
              />
              <GlassSlider
                label="Contract length"
                value={terms.years}
                min={1}
                max={5}
                step={1}
                marks={[{ value: demand.years, label: 'He wants' }]}
                onChange={(years) => patch({ years })}
                formatValue={(v) => `${v} year${v === 1 ? '' : 's'}`}
              />
              <div>
                <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                  Role promised
                </p>
                <GlassSegmented
                  options={ROLE_OPTIONS}
                  value={terms.role as SquadRole}
                  onChange={(role) => patch({ role })}
                  aria-label="Squad role"
                  size="sm"
                  block
                  nested
                />
                <p className="mt-2 text-[12px] leading-relaxed text-ink-dim text-pretty">
                  A role is a promise. Break it with team selection and his morale pays for it.
                </p>
              </div>
            </section>

            <Divider label="Sweeteners" />

            <section className="flex flex-col gap-4">
              <GlassSlider
                label="Signing-on fee"
                value={terms.signingBonus}
                min={0}
                max={Math.max(Math.round(demand.wage * 60), 1)}
                step={Math.max(1_000, Math.round(demand.wage / 4))}
                onChange={(signingBonus) => patch({ signingBonus })}
                formatValue={(v) => plainMoney(v)}
              />
              <GlassSlider
                label="Goal bonus"
                value={terms.goalBonus}
                min={0}
                max={Math.max(Math.round(demand.wage * 2), 1)}
                step={Math.max(100, Math.round(demand.wage / 40))}
                onChange={(goalBonus) => patch({ goalBonus })}
                formatValue={(v) => plainMoney(v)}
              />
              <GlassSlider
                label="Appearance bonus"
                value={terms.appearanceBonus}
                min={0}
                max={Math.max(Math.round(demand.wage), 1)}
                step={Math.max(100, Math.round(demand.wage / 60))}
                onChange={(appearanceBonus) => patch({ appearanceBonus })}
                formatValue={(v) => plainMoney(v)}
              />
              <GlassToggle
                asRow
                label="Release clause"
                description="Cheap to give away now, expensive the week somebody triggers it."
                checked={clause}
                onChange={(next) => {
                  setClause(next);
                  patch({ releaseClause: next ? Math.round(Math.max(terms.fee, demand.fee) * 1.8) : null });
                }}
              />
              {clause && (
                <GlassSlider
                  label="Clause amount"
                  value={terms.releaseClause ?? 0}
                  min={0}
                  max={Math.max(Math.round(Math.max(terms.fee, demand.fee) * 4), 1)}
                  step={Math.max(50_000, Math.round(demand.fee / 40))}
                  onChange={(releaseClause) => patch({ releaseClause })}
                  formatValue={(v) => plainMoney(v)}
                />
              )}
              <KeyValueRow
                label="Weekly wage headroom left"
                value={<MoneyLabel amount={wageHeadroom - terms.wage} signed size="md" />}
                divided={false}
              />
            </section>
          </>
        )}

        {agentStage && (
          <section className="flex flex-col gap-4">
            <SectionHeader
              title="Agent fee"
              subtitle={`He is asking ${plainMoney(agentFeeDemand)}`}
            />
            <GlassSlider
              label="What you will pay him"
              value={agentFee}
              min={0}
              max={Math.max(Math.round(agentFeeDemand * 1.5), 1)}
              step={Math.max(1_000, Math.round(agentFeeDemand / 100))}
              marks={[{ value: agentFeeDemand, label: 'His demand' }]}
              onChange={setAgentFee}
              formatValue={(v) => plainMoney(v)}
              tone={agentGap.tone === 'danger' ? 'danger' : 'volt'}
            />
            <KeyValueRow label="Against his demand" value={agentGap.label} divided={false} />
            <p className="text-[12px] leading-relaxed text-ink-dim text-pretty">
              The agent's cut grows with every rival club in the room. He is not being greedy for
              the sake of it — he simply has options.
            </p>
          </section>
        )}

        <Divider />

        <KeyValueRow
          label="Total commitment"
          value={<MoneyLabel amount={total} size="lg" />}
          hint="Fee, signing-on fee, agent fee and every week of wages for the life of the deal"
          divided={false}
          emphasis
        />
      </div>
    </GlassSheet>
  );
}
