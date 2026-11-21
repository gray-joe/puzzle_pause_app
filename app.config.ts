import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
    if (process.env.EXPO_PUBLIC_APP_ENV !== 'e2e') return config as ExpoConfig;

    return {
        ...config,
        name: 'Puzzle Pause E2E',
        slug: config.slug!,
        scheme: 'puzzlepause-e2e',
        ios: {
            ...config.ios,
            bundleIdentifier: 'app.puzzlepause.mobile.e2e',
            // Local HTTP API access is limited to this test build.
            infoPlist: {
                ...config.ios?.infoPlist,
                NSAppTransportSecurity: { NSAllowsArbitraryLoads: true },
            },
        },
    };
};
