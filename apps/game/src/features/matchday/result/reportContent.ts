/** Coverage is assigned by engine entities, never a substring of a club name. */
export function partitionClubCoverage<T extends { readonly entities: readonly { kind: string; id: string }[] }>(items: readonly T[], clubId: string): { club: T[]; world: T[] } {
  const club: T[] = [];
  const world: T[] = [];
  for (const item of items) {
    (item.entities.some(entity => entity.kind === 'club' && entity.id === clubId) ? club : world).push(item);
  }
  return { club, world };
}
