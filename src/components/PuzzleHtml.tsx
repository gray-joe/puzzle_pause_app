import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import RenderHtml from 'react-native-render-html';
import { useTheme } from '../theme';

const IGNORED_TAGS = [
    'script',
    'iframe',
    'object',
    'embed',
    'form',
    'input',
    'button',
    'style',
    'link',
];

const TAGS_STYLES = {
    p: { marginTop: 0, marginBottom: 0 },
    b: { fontWeight: '700' as const },
    strong: { fontWeight: '700' as const },
};

type Props = { html: string };

export function PuzzleHtml({ html }: Props) {
    const { width } = useWindowDimensions();
    const { colors, typography } = useTheme();

    const baseStyle = useMemo(
        () => ({ fontSize: 21, lineHeight: 30, color: colors.text }),
        [typography.body.fontSize, colors.text]
    );

    return (
        <RenderHtml
            contentWidth={width}
            source={{ html }}
            ignoredDomTags={IGNORED_TAGS}
            baseStyle={baseStyle}
            tagsStyles={TAGS_STYLES}
        />
    );
}
