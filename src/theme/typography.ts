import { Platform, type TextStyle } from 'react-native';

const FONT = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

export const typography = {
    heading: { fontSize: 24, fontWeight: '400', fontFamily: FONT } satisfies TextStyle,
    title: { fontSize: 18, fontWeight: '400', fontFamily: FONT } satisfies TextStyle,
    body: { fontSize: 15, fontWeight: '400', fontFamily: FONT } satisfies TextStyle,
    caption: { fontSize: 13, fontWeight: '400', fontFamily: FONT } satisfies TextStyle,
    button: { fontSize: 15, fontWeight: '400', fontFamily: FONT } satisfies TextStyle,
} as const;

export type Typography = typeof typography;
