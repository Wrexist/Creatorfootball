import { ROUTES } from '@/app/routes';
import { isProductId, type ProductId } from './catalog';

export function collectionLink(product: ProductId, from: 'campus' | 'content' = 'content'): string {
  return `${ROUTES.store}?pack=${product}&from=${from}`;
}
export function selectedPack(params: URLSearchParams): ProductId | null {
  const value = params.get('pack');
  return value && isProductId(value) ? value : null;
}
export function collectionReturn(params: URLSearchParams): string {
  return params.get('from') === 'campus' ? ROUTES.club3d : ROUTES.contentPacks;
}
export function quoteState(enabled: boolean, ready: boolean, hasPrice: boolean): 'loading' | 'available' | 'unavailable' {
  if (!enabled) return 'unavailable';
  if (!ready) return 'loading';
  return hasPrice ? 'available' : 'unavailable';
}
