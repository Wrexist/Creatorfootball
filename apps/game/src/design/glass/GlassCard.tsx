import { forwardRef, type ReactNode } from 'react';
import { motion } from 'motion/react';
import type { HTMLMotionProps } from 'motion/react';
import { cn } from '../cn';
import { useDesignMotion } from '../motion';
import { haptics } from '../haptics';
import { FOCUS_RING, glassClass, RADIUS_CLASS, type GlassLevel, type RadiusToken } from './glassLevel';

export interface GlassCardProps extends Omit<HTMLMotionProps<'div'>, 'onClick' | 'ref'> {
  level?: GlassLevel;
  radius?: RadiusToken;
  /** The specular top-edge highlight. Off for very small or very dense cards. */
  sheen?: boolean;
  /**
   * Set when this card sits inside another glass surface. Drops the blur and
   * uses the matching solid tint instead — two stacked backdrop-filters is the
   * one performance rule this kit will not bend on.
   */
  nested?: boolean;
  /** Makes the card a real button with press feedback and a focus ring. */
  onPress?: () => void;
  pressable?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children?: ReactNode;
}

const PADDING: Record<NonNullable<GlassCardProps['padding']>, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-5',
};

/**
 * The default container. Almost every grouping in the product is a GlassCard;
 * if a screen needs a box, it reaches for this before it reaches for a div.
 */
export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(function GlassCard(
  {
    level = 2,
    radius = 'lg',
    sheen = true,
    nested = false,
    onPress,
    pressable,
    padding = 'md',
    className,
    children,
    ...rest
  },
  ref,
) {
  const m = useDesignMotion();
  const isPressable = pressable ?? Boolean(onPress);

  return (
    <motion.div
      ref={ref}
      className={cn(
        'relative overflow-hidden',
        glassClass(level, !nested),
        RADIUS_CLASS[radius],
        PADDING[padding],
        sheen && 'glass-sheen',
        isPressable && cn('cursor-pointer select-none', FOCUS_RING),
        className,
      )}
      {...(isPressable
        ? {
            role: 'button',
            tabIndex: 0,
            onClick: () => {
              haptics.impact();
              onPress?.();
            },
            onKeyDown: (event: React.KeyboardEvent) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                haptics.impact();
                onPress?.();
              }
            },
            whileTap: m.reduced ? undefined : { scale: 0.985 },
            transition: m.spring.press,
          }
        : {})}
      {...rest}
    >
      {children}
    </motion.div>
  );
});
