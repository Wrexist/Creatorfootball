import { isProductId, type ProductId } from './catalog';

export interface PurchaseSnapshot { owned: readonly ProductId[]; checkedAt: number }
export interface ProductQuote { id: ProductId; price: string; title: string }
export type PurchaseOutcome = 'PURCHASED' | 'CANCELLED' | 'PENDING';
export interface PurchaseAdapter {
  snapshot(): Promise<PurchaseSnapshot>;
  products(): Promise<readonly ProductQuote[]>;
  purchase(id: ProductId): Promise<{ outcome: PurchaseOutcome; snapshot?: PurchaseSnapshot }>;
  restore(): Promise<PurchaseSnapshot>;
  subscribe(callback: (snapshot: PurchaseSnapshot) => void): Promise<() => void>;
}

export function acceptSnapshot(previous: PurchaseSnapshot | null, incoming: PurchaseSnapshot): PurchaseSnapshot {
  if (!Number.isFinite(incoming.checkedAt) || incoming.checkedAt <= 0) throw new Error('Invalid purchase verification time.');
  if (previous && incoming.checkedAt < previous.checkedAt) return previous;
  return { checkedAt: incoming.checkedAt, owned: [...new Set(incoming.owned.filter(isProductId))] };
}

/** Single purchase lane prevents duplicate sheets and repeated restore/delivery. */
export class PurchaseController {
  private busy = false;
  constructor(private readonly adapter: PurchaseAdapter, private readonly deliver: (snapshot: PurchaseSnapshot) => void) {}
  async purchase(id: ProductId): Promise<PurchaseOutcome> {
    if (this.busy) throw new Error('A purchase or restore is already in progress.');
    this.busy = true;
    try {
      const result = await this.adapter.purchase(id);
      if (result.snapshot) this.deliver(result.snapshot);
      return result.outcome;
    } finally { this.busy = false; }
  }
  async restore(): Promise<void> {
    if (this.busy) throw new Error('A purchase or restore is already in progress.');
    this.busy = true;
    try { this.deliver(await this.adapter.restore()); }
    finally { this.busy = false; }
  }
}
