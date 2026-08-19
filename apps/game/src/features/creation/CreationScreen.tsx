import { useEffect, type ReactNode } from 'react';
import { trackEvent } from '@cf/engine';
import { Screen } from '@/design';
import { CreationProgress } from './components';

/**
 * The scaffold shared by all three creation steps.
 *
 * It exists so the three steps cannot drift apart: same header, same progress
 * indicator in the same place, same sticky primary action, same
 * no-tab-bar-here decision. A step supplies its content and its one forward
 * action and nothing else.
 */
export interface CreationScreenProps {
  step: string;
  title: ReactNode;
  subtitle?: ReactNode;
  onBack?: () => void;
  footer?: ReactNode;
  children: ReactNode;
}

export function CreationScreen({
  step, title, subtitle, onBack, footer, children,
}: CreationScreenProps): ReactNode {
  // One funnel event per step, fired where the step is rendered rather than
  // where it is navigated to, so a deep link counts the same as a tap.
  useEffect(() => {
    trackEvent('onboarding_step', { step });
  }, [step]);

  return (
    <Screen
      title={title}
      {...(subtitle !== undefined ? { subtitle } : {})}
      {...(onBack ? { onBack } : {})}
      headerAccessory={<CreationProgress current={step} />}
      withTabBar={false}
      {...(footer !== undefined ? { footer } : {})}
    >
      {children}
    </Screen>
  );
}
