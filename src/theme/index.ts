import { useColorScheme } from 'react-native';
import { colors, type ColorScheme, type ThemeColors } from './colors';
import { spacing } from './spacing';
import { typography } from './typography';

export { colors, spacing, typography };
export type { ColorScheme, ThemeColors };

export function useTheme() {
    const scheme: ColorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
    return { colors: colors[scheme], spacing, typography, scheme };
}
