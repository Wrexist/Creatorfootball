import type { ReactNode, SVGProps } from 'react';
import { cn } from './cn';

/**
 * The icon set.
 *
 * Hand-drawn on a 24px grid with a 1.5px stroke, round caps and round joins, so
 * the whole set shares one optical weight with the SF-adjacent type. No icon
 * package: a dependency would bring hundreds of glyphs we never ship, a second
 * stroke language, and a licence to track. ~58 icons is the entire product's
 * vocabulary and it fits in one reviewable file.
 *
 * Accessibility contract: an icon is `aria-hidden` by default, because the vast
 * majority sit next to a visible text label and announcing them twice is noise.
 * Pass `label` for the icon-only case — `GlassIcon` and `TabBar` enforce this.
 */

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'ref'> {
  /** Rendered size in px. 20 for inline, 24 for controls, 28+ for empty states. */
  size?: number | string;
  /** Accessible name. Required whenever the icon is the only content. */
  label?: string;
  strokeWidth?: number;
}

export type IconComponent = (props: IconProps) => ReactNode;

function IconBase({
  size = 24,
  label,
  strokeWidth = 1.5,
  className,
  children,
  ...rest
}: IconProps): ReactNode {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      // `shrink-0` because icons inside flex rows must never be squashed by a
      // long label — a squashed icon is the most common polish bug in a kit.
      className={cn('shrink-0', className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

function icon(name: string, node: ReactNode): IconComponent {
  const Component = (props: IconProps): ReactNode => <IconBase {...props}>{node}</IconBase>;
  Component.displayName = name;
  return Component;
}

/* --- navigation ---------------------------------------------------- */

export const IconHome = icon('IconHome', (
  <>
    <path d="M3.2 10.7 12 3.4l8.8 7.3" />
    <path d="M5.6 9.4V19a2 2 0 0 0 2 2h8.8a2 2 0 0 0 2-2V9.4" />
    <path d="M9.6 21v-5.4a1 1 0 0 1 1-1h2.8a1 1 0 0 1 1 1V21" />
  </>
));

export const IconClub = icon('IconClub', (
  <>
    <path d="M12 3.2 4.8 6v5.9c0 4.1 2.9 7.6 7.2 8.9 4.3-1.3 7.2-4.8 7.2-8.9V6L12 3.2Z" />
    <path d="M12 8.4v6.4" />
    <path d="M9 11.6h6" />
  </>
));

export const IconSquad = icon('IconSquad', (
  <>
    <circle cx="9" cy="8.2" r="3.2" />
    <path d="M3 19.4c0-3 2.7-4.9 6-4.9s6 1.9 6 4.9" />
    <path d="M16.2 5.5a3.2 3.2 0 0 1 0 6.2" />
    <path d="M17.6 14.9c2.1.6 3.4 2.2 3.4 4.5" />
  </>
));

export const IconMatchday = icon('IconMatchday', (
  <>
    <rect x="2.5" y="4.5" width="19" height="15" rx="2.4" />
    <path d="M12 4.5v15" />
    <circle cx="12" cy="12" r="2.6" />
    <path d="M2.5 9.2h2.9v5.6H2.5M21.5 9.2h-2.9v5.6h2.9" />
  </>
));

export const IconMarket = icon('IconMarket', (
  <>
    <path d="M20.3 13.4 13.4 20.3a2 2 0 0 1-2.9 0l-6.3-6.3a2 2 0 0 1-.6-1.4V5.4a1.7 1.7 0 0 1 1.7-1.7h7.2a2 2 0 0 1 1.4.6l6.4 6.4a2 2 0 0 1 0 2.7Z" />
    <circle cx="8.4" cy="8.4" r="1.4" />
  </>
));

export const IconLeague = icon('IconLeague', (
  <>
    <rect x="3" y="3.6" width="18" height="16.8" rx="2.4" />
    <path d="M3 8.6h18" />
    <path d="M8 8.6v11.8" />
    <path d="M11.4 12.4h6.2M11.4 16.5h6.2" />
  </>
));

export const IconSocial = icon('IconSocial', (
  <>
    <path d="M20.6 12.2c0 4-3.8 7.2-8.6 7.2a10 10 0 0 1-2.6-.34L4.2 20.8l1.2-3.5A6.7 6.7 0 0 1 3.4 12.2C3.4 8.2 7.2 5 12 5s8.6 3.2 8.6 7.2Z" />
    <path d="M8.8 11.6h6.4M8.8 14.6h4" />
  </>
));

export const IconSettings = icon('IconSettings', (
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.3 14.2a1.5 1.5 0 0 0 .3 1.7l.05.05a1.8 1.8 0 1 1-2.55 2.55l-.05-.05a1.5 1.5 0 0 0-2.55 1.07v.14a1.8 1.8 0 1 1-3.6 0v-.07a1.5 1.5 0 0 0-2.6-1.02l-.05.05A1.8 1.8 0 1 1 3.7 15.9l.05-.05a1.5 1.5 0 0 0-1.07-2.55h-.14a1.8 1.8 0 1 1 0-3.6h.07A1.5 1.5 0 0 0 3.63 7.1l-.05-.05A1.8 1.8 0 1 1 6.13 4.5l.05.05a1.5 1.5 0 0 0 1.7.3h.07a1.5 1.5 0 0 0 .9-1.37v-.14a1.8 1.8 0 1 1 3.6 0v.07a1.5 1.5 0 0 0 2.55 1.07l.05-.05a1.8 1.8 0 1 1 2.55 2.55l-.05.05a1.5 1.5 0 0 0-.3 1.7v.07a1.5 1.5 0 0 0 1.37.9h.14a1.8 1.8 0 1 1 0 3.6h-.07a1.5 1.5 0 0 0-1.37.9Z" />
  </>
));

/* --- direction ------------------------------------------------------ */

export const IconChevronLeft = icon('IconChevronLeft', <path d="M14.5 5.5 8 12l6.5 6.5" />);
export const IconChevronRight = icon('IconChevronRight', <path d="M9.5 5.5 16 12l-6.5 6.5" />);
export const IconChevronUp = icon('IconChevronUp', <path d="M5.5 14.5 12 8l6.5 6.5" />);
export const IconChevronDown = icon('IconChevronDown', <path d="M5.5 9.5 12 16l6.5-6.5" />);
export const IconChevronsUpDown = icon('IconChevronsUpDown', (
  <>
    <path d="M8 9.5 12 5.5l4 4" />
    <path d="M8 14.5 12 18.5l4-4" />
  </>
));

export const IconArrowLeft = icon('IconArrowLeft', (
  <>
    <path d="M20 12H4" />
    <path d="M10 6 4 12l6 6" />
  </>
));
export const IconArrowRight = icon('IconArrowRight', (
  <>
    <path d="M4 12h16" />
    <path d="M14 6l6 6-6 6" />
  </>
));
export const IconArrowUp = icon('IconArrowUp', (
  <>
    <path d="M12 20V4" />
    <path d="M6 10l6-6 6 6" />
  </>
));
export const IconArrowDown = icon('IconArrowDown', (
  <>
    <path d="M12 4v16" />
    <path d="M6 14l6 6 6-6" />
  </>
));

/* --- actions -------------------------------------------------------- */

export const IconPlus = icon('IconPlus', <path d="M12 5v14M5 12h14" />);
export const IconMinus = icon('IconMinus', <path d="M5 12h14" />);
export const IconCheck = icon('IconCheck', <path d="M4.8 12.6 9.6 17.4 19.2 6.8" />);
export const IconX = icon('IconX', <path d="M6 6l12 12M18 6 6 18" />);
export const IconMore = icon('IconMore', (
  <>
    <circle cx="5.5" cy="12" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="18.5" cy="12" r="1.1" fill="currentColor" stroke="none" />
  </>
));
export const IconEdit = icon('IconEdit', (
  <>
    <path d="M4 20.2h4.2L19.4 9a2.1 2.1 0 0 0 0-3l-1.4-1.4a2.1 2.1 0 0 0-3 0L3.8 15.9V20.2Z" />
    <path d="M14.6 6.4 18 9.8" />
  </>
));
export const IconSearch = icon('IconSearch', (
  <>
    <circle cx="10.8" cy="10.8" r="6.3" />
    <path d="M15.4 15.4 20.5 20.5" />
  </>
));
export const IconFilter = icon('IconFilter', (
  <path d="M3.6 5.2h16.8l-6.5 7.6v6.3l-3.8 1.8v-8.1L3.6 5.2Z" />
));
export const IconSort = icon('IconSort', (
  <>
    <path d="M7 4.5v15M7 4.5 4 7.8M7 4.5l3 3.3" />
    <path d="M17 19.5v-15M17 19.5l-3-3.3M17 19.5l3-3.3" />
  </>
));
export const IconShare = icon('IconShare', (
  <>
    <path d="M12 3.4v11.4" />
    <path d="M8.2 7.2 12 3.4l3.8 3.8" />
    <path d="M6.4 11.2H5.6a2 2 0 0 0-2 2v5.4a2 2 0 0 0 2 2h12.8a2 2 0 0 0 2-2v-5.4a2 2 0 0 0-2-2h-.8" />
  </>
));
export const IconEye = icon('IconEye', (
  <>
    <path d="M2.6 12S6 5.8 12 5.8 21.4 12 21.4 12 18 18.2 12 18.2 2.6 12 2.6 12Z" />
    <circle cx="12" cy="12" r="2.9" />
  </>
));

/* --- football ------------------------------------------------------- */

export const IconBall = icon('IconBall', (
  <>
    <circle cx="12" cy="12" r="8.8" />
    <path d="M12 7.4 15.9 10.2 14.4 14.8H9.6L8.1 10.2 12 7.4Z" />
    <path d="M12 3.2v4.2M20.4 9.6l-4.5.6M17.1 19l-2.7-4.2M6.9 19l2.7-4.2M3.6 9.6l4.5.6" />
  </>
));

export const IconWhistle = icon('IconWhistle', (
  <>
    <path d="M13.8 8.4H20a1.6 1.6 0 0 1 1.6 1.6v1.2a1.6 1.6 0 0 1-1.6 1.6h-6.2" />
    <circle cx="8.4" cy="12.6" r="5.4" />
    <circle cx="8.4" cy="12.6" r="1.6" />
    <path d="M12.4 6.4 15.6 4" />
  </>
));

export const IconCard = icon('IconCard', (
  <rect x="6.6" y="2.9" width="11" height="15.4" rx="1.8" transform="rotate(12 12 12)" />
));

export const IconSwap = icon('IconSwap', (
  <>
    <path d="M8 20V4M8 4 4.5 7.6M8 4l3.5 3.6" />
    <path d="M16 4v16M16 20l-3.5-3.6M16 20l3.5-3.6" />
  </>
));

export const IconTactics = icon('IconTactics', (
  <>
    <rect x="3.4" y="3.4" width="17.2" height="17.2" rx="2.4" />
    <path d="M12 3.4v17.2" />
    <circle cx="7.4" cy="8.6" r="1.3" />
    <circle cx="7.4" cy="15.4" r="1.3" />
    <path d="M15.2 7.4 18.4 10.6M18.4 7.4l-3.2 3.2" />
    <circle cx="16.8" cy="15.4" r="1.6" />
  </>
));

export const IconTraining = icon('IconTraining', (
  <>
    <path d="M9.4 20.4 12 4.2l2.6 16.2Z" />
    <path d="M3.6 20.4h16.8" />
    <path d="M10.3 14.8h3.4M10.8 10.6h2.4" />
  </>
));

export const IconScout = icon('IconScout', (
  <>
    <circle cx="6.6" cy="14.6" r="4" />
    <circle cx="17.4" cy="14.6" r="4" />
    <path d="M10.6 14.6h2.8" />
    <path d="M5.6 10.8 7.2 4.6a1 1 0 0 1 1-.7h1.1M18.4 10.8 16.8 4.6a1 1 0 0 0-1-.7h-1.1" />
  </>
));

export const IconInjury = icon('IconInjury', (
  <>
    <rect x="3.4" y="6.4" width="17.2" height="12.4" rx="2.6" />
    <path d="M12 10.2v5M9.5 12.7h5" />
    <path d="M8.8 6.4V5.2a1.6 1.6 0 0 1 1.6-1.6h3.2a1.6 1.6 0 0 1 1.6 1.6v1.2" />
  </>
));

export const IconStadium = icon('IconStadium', (
  <>
    <path d="M2.6 8.6c0-2 4.2-3.6 9.4-3.6s9.4 1.6 9.4 3.6-4.2 3.6-9.4 3.6-9.4-1.6-9.4-3.6Z" />
    <path d="M2.6 8.6v6.2c0 2 4.2 3.6 9.4 3.6s9.4-1.6 9.4-3.6V8.6" />
    <path d="M7.6 11.4v6.4M16.4 11.4v6.4" />
  </>
));

export const IconFans = icon('IconFans', (
  <>
    <circle cx="6.4" cy="8.4" r="2.2" />
    <circle cx="12" cy="6.8" r="2.4" />
    <circle cx="17.6" cy="8.4" r="2.2" />
    <path d="M2.6 18.4c0-2.5 1.7-4.2 3.8-4.2s3.8 1.7 3.8 4.2" />
    <path d="M8 19.6c0-2.8 1.8-4.6 4-4.6s4 1.8 4 4.6" />
    <path d="M13.8 18.4c0-2.5 1.7-4.2 3.8-4.2s3.8 1.7 3.8 4.2" />
  </>
));

/* --- economy & rewards --------------------------------------------- */

export const IconMoney = icon('IconMoney', (
  <>
    <rect x="2.6" y="6" width="18.8" height="12" rx="2.2" />
    <circle cx="12" cy="12" r="2.8" />
    <path d="M6.2 9.6v4.8M17.8 9.6v4.8" />
  </>
));

export const IconSponsor = icon('IconSponsor', (
  <>
    <path d="M12 3.2 14.3 5l2.9-.3 1 2.7 2.5 1.5-1 2.7 1 2.7-2.5 1.5-1 2.7-2.9-.3L12 20.8 9.7 19l-2.9.3-1-2.7L3.3 15l1-2.7-1-2.7 2.5-1.5 1-2.7 2.9.3L12 3.2Z" />
    <path d="M9.4 12.2 11.3 14.1 15 10.4" />
  </>
));

export const IconTrophy = icon('IconTrophy', (
  <>
    <path d="M7.4 4.2h9.2v5.2a4.6 4.6 0 0 1-9.2 0V4.2Z" />
    <path d="M7.4 5.8H5a1.4 1.4 0 0 0-1.4 1.4c0 2.3 1.7 3.7 3.8 4M16.6 5.8H19a1.4 1.4 0 0 1 1.4 1.4c0 2.3-1.7 3.7-3.8 4" />
    <path d="M12 14v3.6M8.6 20.4h6.8a3.4 3.4 0 0 0-3.4-2.8 3.4 3.4 0 0 0-3.4 2.8Z" />
  </>
));

export const IconStar = icon('IconStar', (
  <path d="m12 3.6 2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 17.5l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3.6Z" />
));

export const IconFlame = icon('IconFlame', (
  <>
    <path d="M12 2.8s5.6 4 5.6 9.4a5.6 5.6 0 1 1-11.2 0c0-2 .9-3.7 1.9-5 .3 1.2 1.1 2.1 2 2.1 1.4 0 2-1.4 1.7-6.5Z" />
    <path d="M12 20.6a2.6 2.6 0 0 0 2.6-2.6c0-1.6-2.6-3.8-2.6-3.8s-2.6 2.2-2.6 3.8a2.6 2.6 0 0 0 2.6 2.6Z" />
  </>
));

/* --- data ----------------------------------------------------------- */

export const IconTrendUp = icon('IconTrendUp', (
  <>
    <path d="M3.4 16.6 9.2 10.8l3.4 3.4 7.6-7.6" />
    <path d="M15.4 6.6h5.2v5.2" />
  </>
));

export const IconTrendDown = icon('IconTrendDown', (
  <>
    <path d="M3.4 7.4 9.2 13.2l3.4-3.4 7.6 7.6" />
    <path d="M15.4 17.4h5.2v-5.2" />
  </>
));

export const IconCalendar = icon('IconCalendar', (
  <>
    <rect x="3.4" y="5.4" width="17.2" height="15.2" rx="2.4" />
    <path d="M3.4 10h17.2" />
    <path d="M8.4 3.4v3.6M15.6 3.4v3.6" />
    <circle cx="8.6" cy="14" r="1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="14" r="1" fill="currentColor" stroke="none" />
  </>
));

export const IconClock = icon('IconClock', (
  <>
    <circle cx="12" cy="12" r="8.8" />
    <path d="M12 6.8V12l3.4 2.2" />
  </>
));

/* --- status --------------------------------------------------------- */

export const IconLock = icon('IconLock', (
  <>
    <rect x="4.4" y="10.2" width="15.2" height="10.4" rx="2.4" />
    <path d="M7.8 10.2V7.6a4.2 4.2 0 0 1 8.4 0v2.6" />
    <path d="M12 14.2v2.4" />
  </>
));

export const IconInfo = icon('IconInfo', (
  <>
    <circle cx="12" cy="12" r="8.8" />
    <path d="M12 11v5.4" />
    <circle cx="12" cy="7.9" r="1" fill="currentColor" stroke="none" />
  </>
));

export const IconWarning = icon('IconWarning', (
  <>
    <path d="M10.3 4.1 2.6 17.4a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.1a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9.4v4.2" />
    <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" />
  </>
));

export const IconShield = icon('IconShield', (
  <path d="M12 3.2 4.8 6v5.9c0 4.1 2.9 7.6 7.2 8.9 4.3-1.3 7.2-4.8 7.2-8.9V6L12 3.2Z" />
));

export const IconVerified = icon('IconVerified', (
  <>
    <path d="m12 2.8 2.3 1.9 3-.2 1 2.8 2.5 1.6-1 2.9 1 2.9-2.5 1.6-1 2.8-3-.2L12 21.2 9.7 19.3l-3 .2-1-2.8-2.5-1.6 1-2.9-1-2.9 2.5-1.6 1-2.8 3 .2L12 2.8Z" />
    <path d="M9.2 12.1 11.1 14 14.8 9.9" />
  </>
));

export const IconBell = icon('IconBell', (
  <>
    <path d="M18.2 16.6H5.8s1.6-1.6 1.6-4.4V10a4.6 4.6 0 0 1 9.2 0v2.2c0 2.8 1.6 4.4 1.6 4.4Z" />
    <path d="M10.2 19.4a2 2 0 0 0 3.6 0" />
  </>
));

/* --- social --------------------------------------------------------- */

export const IconHeart = icon('IconHeart', (
  <path d="M12 20.2s-7.8-4.6-7.8-9.9a4.3 4.3 0 0 1 7.8-2.5 4.3 4.3 0 0 1 7.8 2.5c0 5.3-7.8 9.9-7.8 9.9Z" />
));

export const IconRepost = icon('IconRepost', (
  <>
    <path d="M5 9.4V7.8a2.6 2.6 0 0 1 2.6-2.6h9.6" />
    <path d="M14.4 2.6 17.6 5.2l-3.2 2.6" />
    <path d="M19 14.6v1.6a2.6 2.6 0 0 1-2.6 2.6H6.8" />
    <path d="M9.6 21.4 6.4 18.8l3.2-2.6" />
  </>
));

export const IconReply = icon('IconReply', (
  <>
    <path d="M9.6 5.4 3.6 10.6l6 5.2" />
    <path d="M3.6 10.6h8.8a7.4 7.4 0 0 1 7.4 7.4v1" />
  </>
));

/* --- playback ------------------------------------------------------- */

export const IconPlay = icon('IconPlay', (
  <path d="M7.6 4.9 19 12 7.6 19.1V4.9Z" />
));

export const IconPause = icon('IconPause', (
  <>
    <rect x="6.6" y="4.8" width="3.8" height="14.4" rx="1.4" />
    <rect x="13.6" y="4.8" width="3.8" height="14.4" rx="1.4" />
  </>
));

export const IconFastForward = icon('IconFastForward', (
  <>
    <path d="M3.4 5.6 11 12l-7.6 6.4V5.6Z" />
    <path d="M12.4 5.6 20 12l-7.6 6.4V5.6Z" />
  </>
));

export const IconSkip = icon('IconSkip', (
  <>
    <path d="M5 5.6 13.6 12 5 18.4V5.6Z" />
    <path d="M18.4 4.8v14.4" />
  </>
));

/* --- registry -------------------------------------------------------- */

/**
 * Name → component, for the Gallery and for data-driven surfaces (objective
 * templates, store offers) that carry an icon name as a string.
 */
export const ICONS = {
  home: IconHome, club: IconClub, squad: IconSquad, matchday: IconMatchday,
  market: IconMarket, league: IconLeague, social: IconSocial, settings: IconSettings,
  chevronLeft: IconChevronLeft, chevronRight: IconChevronRight, chevronUp: IconChevronUp,
  chevronDown: IconChevronDown, chevronsUpDown: IconChevronsUpDown,
  arrowLeft: IconArrowLeft, arrowRight: IconArrowRight, arrowUp: IconArrowUp,
  arrowDown: IconArrowDown, plus: IconPlus, minus: IconMinus, check: IconCheck,
  x: IconX, more: IconMore, edit: IconEdit, search: IconSearch, filter: IconFilter,
  sort: IconSort, share: IconShare, eye: IconEye, ball: IconBall, whistle: IconWhistle,
  card: IconCard, swap: IconSwap, tactics: IconTactics, training: IconTraining,
  scout: IconScout, injury: IconInjury, stadium: IconStadium, fans: IconFans,
  money: IconMoney, sponsor: IconSponsor, trophy: IconTrophy, star: IconStar,
  flame: IconFlame, trendUp: IconTrendUp, trendDown: IconTrendDown,
  calendar: IconCalendar, clock: IconClock, lock: IconLock, info: IconInfo,
  warning: IconWarning, shield: IconShield, verified: IconVerified, bell: IconBell,
  heart: IconHeart, repost: IconRepost, reply: IconReply, play: IconPlay,
  pause: IconPause, fastForward: IconFastForward, skip: IconSkip,
} as const satisfies Record<string, IconComponent>;

export type IconName = keyof typeof ICONS;
export const ICON_NAMES = Object.keys(ICONS) as IconName[];

export interface NamedIconProps extends IconProps {
  name: IconName;
}

/** Data-driven form: `<Icon name={objective.icon} />`. */
export function Icon({ name, ...rest }: NamedIconProps): ReactNode {
  const Component = ICONS[name];
  return <Component {...rest} />;
}
