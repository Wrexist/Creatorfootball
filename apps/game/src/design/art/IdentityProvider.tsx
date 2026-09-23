import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { GameState } from '@cf/engine';
import type { IllustratedGameState } from './identity';

const IdentityContext = createContext<ReadonlyMap<string,string>>(new Map());
export function IdentityProvider({state,children}: {state:GameState | null; children:ReactNode}): ReactNode {
  const identities = (state as IllustratedGameState | null)?.visualIdentity;
  const players = state?.players;
  const creators = state?.creators;
  const value = useMemo(() => {
    const map = new Map<string,string>();
    for (const [id,asset] of Object.entries(identities?.players ?? {})) {
      const seed = players?.[id]?.portraitSeed;
      if (seed) map.set(seed,asset);
    }
    for (const [id,asset] of Object.entries(identities?.creators ?? {})) {
      const seed = creators?.[id]?.avatarSeed;
      if (seed) map.set(seed,asset);
    }
    return map;
  },[identities,players,creators]);
  return <IdentityContext.Provider value={value}>{children}</IdentityContext.Provider>;
}
export function usePortraitAsset(seed:string): string | undefined { return useContext(IdentityContext).get(seed); }
