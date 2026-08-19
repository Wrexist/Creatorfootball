import { setAnalyticsSink, trackEvent, type AnalyticsEventName } from '@cf/engine';
import { screenNameFor } from './routes';

/**
 * The app's analytics pipe.
 *
 * The engine owns the event *schema* and rejects any name that is not in it —
 * a typo must never quietly create a new metric. This module owns the
 * *transport*: it installs the sink the engine writes into, so engine-side
 * events (match completed, objective claimed) and app-side events (screen
 * views) arrive at one place, in one order, buffered replay included.
 *
 * Screen views are the one thing that cannot go through `trackEvent`: there is
 * no `screen_view` name in the engine's schema, and that schema belongs to
 * another workstream. A screen view is therefore written straight to the sink
 * here, and where a screen genuinely maps onto a schema event (opening the
 * store, reading objectives) we *also* fire the real engine event so the
 * funnels that already exist keep working.
 */

export type AnalyticsSinkFn = (name: string, props: Record<string, unknown>) => void;

let sink: AnalyticsSinkFn | null = null;

/** Screens whose view is also a first-class event in the engine's schema. */
const SCHEMA_EVENT_FOR_SCREEN: Partial<Record<string, AnalyticsEventName>> = {
  store: 'store_opened',
  objectives: 'objective_viewed',
  rivalries: 'rivalry_viewed',
  history: 'legacy_viewed',
  market: 'transfer_viewed',
  playerSearch: 'transfer_viewed',
};

/**
 * Development transport. A shipping build passes its own function; nothing
 * else in the app changes.
 */
const consoleSink: AnalyticsSinkFn = (name, props) => {
  if (import.meta.env.DEV) console.debug('[analytics]', name, props);
};

export function installAnalytics(next: AnalyticsSinkFn = consoleSink): void {
  sink = next;
  // Engine events fired before this point are buffered and replay in order.
  setAnalyticsSink(next);
}

export function emit(name: string, props: Record<string, unknown> = {}): void {
  sink?.(name, props);
}

/**
 * Record a navigation. `screenNameFor` maps a pathname back to its key in the
 * frozen route table, so changing a URL never silently renames a metric.
 */
export function trackScreenView(pathname: string, props: Record<string, unknown> = {}): void {
  const screen = screenNameFor(pathname);
  emit('screen_view', { screen, pathname, ...props });
  const schemaEvent = SCHEMA_EVENT_FOR_SCREEN[screen];
  if (schemaEvent) trackEvent(schemaEvent, { screen, ...props });
}
