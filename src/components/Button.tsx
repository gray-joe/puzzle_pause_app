import { ActivityIndicator, Pressable, Text, type ViewStyle } from 'react-native';
import { useTheme } from '../theme';

type Variant = 'primary' | 'secondary';

type Props = {
    title: string;
    onPress?: () => void;
    variant?: Variant;
    loading?: boolean;
    disabled?: boolean;
    style?: ViewStyle;
};

export function Button({
    title,
    onPress,
    variant = 'primary',
    loading = false,
    disabled = false,
    style,
}: Props) {
    const { colors, spacing, typography } = useTheme();
    const isPrimary = variant === 'primary';
    const isDisabled = disabled || loading;

    return (
        <Pressable
            onPress={onPress}
            disabled={isDisabled}
            accessibilityRole="button"
            accessibilityState={{ disabled: isDisabled, busy: loading }}
            style={({ pressed }) => [
                {
                    backgroundColor: isPrimary ? colors.primary : 'transparent',
                    borderColor: isPrimary ? colors.primary : colors.border,
                    borderWidth: 1,
                    paddingVertical: spacing.sm + 4,
                    paddingHorizontal: spacing.lg,
                    borderRadius: 10,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
                },
                style,
            ]}
        >
            {loading ? (
                <ActivityIndicator color={isPrimary ? colors.primaryText : colors.text} />
            ) : (
                <Text
                    style={[
                        typography.button,
                        { color: isPrimary ? colors.primaryText : colors.text },
                    ]}
                >
                    {title}
                </Text>
            )}
        </Pressable>
    );
}
