export const colors = {
    light: {
        background: '#f5f5f7',
        surface: '#e8eaed',
        text: '#15191e',
        textMuted: '#606060',
        primary: '#0d9e7d',
        primaryText: '#ffffff',
        secondary: '#c97a1a',
        gaveUp: '#ff9f43',
        gaveUpText: '#15191e',
        border: '#d0d0d0',
        error: '#c0392b',
        success: '#0d9e7d',
    },
    dark: {
        background: '#15191e',
        surface: '#1c2129',
        text: '#e0e0e0',
        textMuted: '#808080',
        primary: '#4ecca3',
        primaryText: '#15191e',
        secondary: '#ff9f43',
        gaveUp: '#ff9f43',
        gaveUpText: '#15191e',
        border: '#3a3a3a',
        error: '#ff6b6b',
        success: '#4ecca3',
    },
} as const;

export type ColorScheme = keyof typeof colors;
export type ThemeColors = (typeof colors)['light'];
