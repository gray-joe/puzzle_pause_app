import {
    Text,
    TextInput as RNTextInput,
    View,
    type TextInputProps as RNTextInputProps,
} from 'react-native';
import { useTheme } from '../theme';

type Props = RNTextInputProps & {
    label?: string;
    error?: string;
};

export function TextInput({ label, error, style, ...rest }: Props) {
    const { colors, spacing, typography } = useTheme();
    return (
        <View style={{ gap: spacing.xs }}>
            {label ? (
                <Text style={[typography.caption, { color: colors.textMuted }]}>{label}</Text>
            ) : null}
            <RNTextInput
                placeholderTextColor={colors.textMuted}
                style={[
                    typography.body,
                    {
                        color: colors.text,
                        backgroundColor: colors.surface,
                        borderColor: error ? colors.error : colors.border,
                        borderWidth: 1,
                        borderRadius: 4,
                        paddingVertical: spacing.sm + 2,
                        paddingHorizontal: spacing.md,
                    },
                    style,
                ]}
                {...rest}
            />
            {error ? (
                <Text style={[typography.caption, { color: colors.error }]}>{error}</Text>
            ) : null}
        </View>
    );
}
