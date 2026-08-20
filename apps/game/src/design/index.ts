/**
 * Creator Football design system.
 *
 * Screens import from `@/design` and nothing else in this folder. That is the
 * whole contract: one entry point, so a primitive can be restructured, split or
 * memoised without touching a single screen.
 *
 * Everything here is self-contained — no UI library, no icon package, no image
 * assets, no remote fonts. The only runtime dependencies are React, `motion`,
 * `clsx` + `tailwind-merge`, and the engine's domain types.
 */

/* --- foundations ------------------------------------------------------ */
export { cn } from './cn';
export { hashSeed, SeedStream, seededPick } from './seed';
export {
  parseColor, toHex, rgba, luminance, contrastRatio, readableOn, pickReadable,
  mix, lighten, darken, type Rgb,
} from './color';
export {
  DURATION, EASE, SPRING, TRANSITION, NO_TRANSITION, VARIANTS,
  ReducedMotionOverrideContext, useReducedMotionPreference, useDesignMotion,
  type DurationToken, type VariantName, type DesignVariants, type DesignMotion,
} from './motion';
export {
  haptics, useHaptics, setHapticDriver, setHapticsEnabled, hapticsEnabled,
  HAPTIC_KINDS, type HapticKind, type HapticDriver,
} from './haptics';
export { useMediaQuery, useReducedTransparency, useCoarsePointer, useCanHover } from './useMediaQuery';
export { useSvgId } from './useSvgId';
export { BREAKPOINTS, useBreakpoint, useIsMobile, useIsWide, type Breakpoint } from './useBreakpoint';

/* --- typography -------------------------------------------------------
   The type scale and the anti-truncation primitives. `NameText` is the one
   screens reach for whenever a club, player or creator name lands in a slot
   whose width the name did not choose. */
export { FitText, EntityName, type FitTextProps, type EntityNameProps } from './typography/FitText';
export { TYPE_CLASS, TYPE_SIZE, NUMERIC_ROLES, type TypeRole } from './typography/type';
export {
  Text, NameText, Numeric,
  type TextProps, type NameTextProps, type NumericProps,
} from './typography/Text';

/* --- surfaces ---------------------------------------------------------
   Shapes that are deliberately not the default card. */
export {
  TEXTURE_CLASS, bleedStyle, type SurfaceTexture,
} from './surfaces/material';
export { HeroSurface, type HeroSurfaceProps } from './surfaces/HeroSurface';
export { MediaCard, type MediaCardProps } from './surfaces/MediaCard';
export {
  StatBlock, DataCell, DataGrid, ListRow,
  type StatBlockProps, type StatBlockTone, type DataCellProps, type DataGridProps,
  type ListRowProps,
} from './surfaces/blocks';
export {
  ScorePanel, type ScorePanelProps, type ScorePanelSide,
} from './surfaces/ScorePanel';

/* --- icons ------------------------------------------------------------ */
export * from './icons';

/* --- glass primitives -------------------------------------------------- */
export {
  GLASS_CLASS, GLASS_FLAT_CLASS, glassClass, RADIUS_CLASS, FOCUS_RING, TOUCH_TARGET,
  type GlassLevel, type RadiusToken,
} from './glass/glassLevel';
export { Portal } from './glass/Portal';
export { useScrollLock, useFocusTrap, useEscapeKey } from './glass/useOverlay';
export { GlassCard, type GlassCardProps } from './glass/GlassCard';
export { GlassPanel, type GlassPanelProps } from './glass/GlassPanel';
export {
  GlassButton, type GlassButtonProps, type GlassButtonVariant, type GlassButtonSize,
} from './glass/GlassButton';
export { GlassIcon, type GlassIconProps, type GlassIconSize } from './glass/GlassIcon';
export { GlassPill, type GlassPillProps, type PillTone, type PillSize } from './glass/GlassPill';
export { GlassTabs, type GlassTabsProps, type TabItem } from './glass/GlassTabs';
export { GlassSegmented, type GlassSegmentedProps, type SegmentedOption } from './glass/GlassSegmented';
export { GlassSheet, SheetCloseRow, type GlassSheetProps, type SheetSize } from './glass/GlassSheet';
export { GlassModal, type GlassModalProps } from './glass/GlassModal';
export { GlassInput, type GlassInputProps } from './glass/GlassInput';
export { GlassSlider, type GlassSliderProps } from './glass/GlassSlider';
export { GlassToggle, type GlassToggleProps } from './glass/GlassToggle';

/* --- domain ----------------------------------------------------------- */
export {
  PlayerPortrait, CreatorAvatar, portraitFeatures,
  type PlayerPortraitProps, type CreatorAvatarProps, type PortraitShape, type PortraitFeatures,
} from './domain/PlayerPortrait';
export { ClubBadge, type ClubBadgeProps } from './domain/ClubBadge';
export {
  PlayerCard, PlayerFormPip,
  type PlayerCardProps, type PlayerCardVariant, type PlayerCardClub, type PlayerFormPipProps,
} from './domain/PlayerCard';
export { CreatorCard, type CreatorCardProps, type CreatorCardVariant } from './domain/CreatorCard';
export { ClubCard, type ClubCardProps, type ClubCardVariant } from './domain/ClubCard';
export { MatchCard, type MatchCardProps, type MatchCardSide, type MatchCardVariant } from './domain/MatchCard';
export { NewsCard, SocialPost, type NewsCardProps, type SocialPostProps } from './domain/feed';
export { StatCard, type StatCardProps } from './domain/StatCard';
export {
  RatingBadge, PositionChip, TraitChip, FormGuide,
  type RatingBadgeProps, type RatingScale, type RatingSize,
  type PositionChipProps, type TraitChipProps, type FormGuideProps, type FormResult,
} from './domain/chips';
export {
  ProgressBar, AttributeBar, MomentumBar, Sparkline,
  type ProgressBarProps, type AttributeBarProps, type MomentumBarProps, type SparklineProps,
  type BarTone,
} from './domain/bars';
export {
  Counter, MoneyLabel, TrendIndicator, ScoreDisplay, formatMoney, formatCount, setCurrencySymbol,
  type CounterProps, type MoneyLabelProps, type TrendIndicatorProps, type ScoreDisplayProps,
} from './domain/numbers';
export {
  Timeline, MatchEventRow, type TimelineProps, type TimelineItem, type MatchEventRowProps,
} from './domain/Timeline';

/* --- feedback --------------------------------------------------------- */
export { Skeleton, SkeletonRegion, type SkeletonProps } from './feedback/Skeleton';
export { EmptyState, ErrorState, type EmptyStateProps, type ErrorStateProps } from './feedback/states';
export {
  ToastProvider, useToast, type ToastOptions, type ToastTone,
} from './feedback/Toast';
export {
  Confirm, ConfirmProvider, useConfirm, type ConfirmProps, type ConfirmOptions,
} from './feedback/Confirm';

/* --- layout & navigation ---------------------------------------------- */
export { Screen, ScreenBleed, type ScreenProps } from './layout/Screen';
export {
  TabBar, SideNav, AppShell, TAB_DESTINATIONS,
  type TabBarProps, type SideNavProps, type AppShellProps, type TabId,
} from './layout/TabBar';
export { CardRail, type CardRailProps } from './layout/CardRail';
export {
  SectionHeader, Divider, KeyValueRow, StatGrid, Accordion,
  type SectionHeaderProps, type DividerProps, type KeyValueRowProps,
  type StatGridProps, type AccordionItemProps,
} from './layout/structure';

/* --- hero moments ----------------------------------------------------- */
export {
  ShinyText, SpotlightCard, GlareHover, GradualBlur,
  type ShinyTextProps, type SpotlightCardProps, type GlareHoverProps, type GradualBlurProps,
} from './hero/effects';
export {
  HeroReveal, GoalBurst, TrophyMoment, SigningMoment,
  type HeroRevealProps, type GoalBurstProps, type TrophyMomentProps, type SigningMomentProps,
} from './hero/moments';
