import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Native shell configuration. The web build is the single source of truth for
 * both platforms; nothing iOS-specific may leak into the domain layer.
 */
const config: CapacitorConfig = {
  appId: 'com.creatorfootball.app',
  appName: 'Creator Football',
  webDir: 'dist',
  ios: {
    contentInset: 'never',
    backgroundColor: '#08090B',
    preferredContentMode: 'mobile',
  },
  android: {
    backgroundColor: '#08090B',
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      backgroundColor: '#08090B',
      showSpinner: false,
      launchAutoHide: false,
    },
    Haptics: {},
    StatusBar: { style: 'DARK', backgroundColor: '#08090B' },
  },
};

export default config;
