// Core
export * from './core/brand';
export * from './core/rng';
export * from './core/math';
export * from './core/result';
export * from './core/invariant';
export * from './core/clock';
export * from './core/events';
export * from './core/ids';

// Economy
export * from './economy/ledger';

// Players
export * from './players/positions';
export * from './players/attributes';
export * from './players/mental';
export * from './players/traits';
export * from './players/player';

// Creators & managers
export * from './creators/creator';
export * from './creators/manager';

// Clubs & tactics
export * from './clubs/club';
export * from './tactics/tactics';
export * from './contracts/contract';

// Matches
export * from './matches/events';
export * from './matches/decisions';
export * from './matches/specialRules';
export * from './matches/result';

// League
export * from './league/types';

// Licensing & content
export * from './licensing/identity';
export * from './content/schema';

// League orchestration
export * from './league/fixtures';
export * from './league/standings';

// Persistence
export * from './persistence/storage';
export * from './persistence/save';

// Game state
export * from './game/state';

// --- Content, generators and the base universe ---
export * from './content';

// --- Squad and club management (Workstream C) ---
export * from './transfers/valuation';
export * from './transfers/market';
export * from './transfers/negotiation';
export * from './transfers/scouting';
export * from './contracts/wages';
export * from './contracts/negotiation';
export * from './training/programs';
export * from './training/development';
export * from './training/training';
export * from './facilities/facilities';
export * from './fans/fans';
export * from './sponsors/sponsors';
export * from './economy/cycle';
export * from './economy/audit';

// --- Match simulation (Workstream A) ---
// Formations are re-exported by tactics/vector; DEFAULT_FORMATION_ID comes
// from the content layer so both sides cannot drift apart silently.
export { FORMATIONS, formationById, formationsFor, autoLineup, slotFit } from './tactics/formations';
export { toTacticVector, applyVectorModifiers } from './tactics/vector';
export type { TacticVectorContext } from './tactics/vector';
export * from './matches/simulator';
export * from './matches/ratings';
export * from './matches/specialRuleEngine';

// --- Living world (Workstream D) ---
export * from './media/mediaEngine';
export * from './social/socialEngine';
export * from './rivalries/rivalries';
export * from './simulation/aiClub';
export * from './simulation/opponentModel';
export * from './simulation/worldTick';
export * from './simulation/emergent';
export * from './simulation/cascade';
export * from './progression/objectives';
export * from './progression/balance';
export * from './progression/board';
export * from './progression/legacy';
export * from './analytics/analytics';

// --- Game orchestration ---
export * from './game/newGame';
export * from './game/cycle';
export * from './game/applyResult';
export * from './game/matchSetup';
export * from './game/selectors';
export * from './game/mutations';
export * from './game/eventFactory';
