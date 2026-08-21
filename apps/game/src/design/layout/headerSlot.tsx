import { createContext, useContext, type ReactNode } from 'react';

/**
 * A slot the application can fill for every `Screen` at once.
 *
 * Section navigation belongs directly under a screen's header, but the design
 * system must not know that routes or sections exist — and threading the same
 * element through twenty screens by hand is exactly the sort of duplication
 * that drifts. So the app provides it once here, and any screen that passes its
 * own `headerAccessory` still wins.
 */
const HeaderSlotContext = createContext<ReactNode>(null);

export function HeaderSlotProvider({
  accessory, children,
}: { accessory: ReactNode; children: ReactNode }): ReactNode {
  return <HeaderSlotContext.Provider value={accessory}>{children}</HeaderSlotContext.Provider>;
}

export const useHeaderSlot = (): ReactNode => useContext(HeaderSlotContext);
