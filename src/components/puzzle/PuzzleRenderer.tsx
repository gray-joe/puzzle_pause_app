import type {
    ChoicePuzzle,
    ClueRevealPuzzle,
    ConnectionsPuzzle,
    CountdownPuzzle,
    ImageWordPuzzle,
    LadderPuzzle,
    MatchPuzzle,
    NumGridPuzzle,
    OrderPuzzle,
    Puzzle,
    ScrabblePuzzle,
    TextPuzzle,
    WordWheelPuzzle,
    WordsearchPuzzle,
} from '../../api/schemas';
import { Text, View } from 'react-native';
import { useTheme } from '../../theme';
import { Button } from '../Button';
import { ChoicePuzzleView } from './ChoicePuzzle';
import { ClueRevealPuzzleView } from './ClueRevealPuzzle';
import { ConnectionsPuzzleView } from './ConnectionsPuzzle';
import { CountdownPuzzleView } from './CountdownPuzzle';
import { ImageWordPuzzleView } from './ImageWordPuzzle';
import { LadderPuzzleView } from './LadderPuzzle';
import { MatchPuzzleView } from './MatchPuzzle';
import { NumGridPuzzleView } from './NumGridPuzzle';
import { OrderPuzzleView } from './OrderPuzzle';
import { TextAnswerPuzzle } from './TextAnswerPuzzle';
import { ScrabblePuzzleView } from './ScrabblePuzzle';
import { UnsupportedPuzzle } from './UnsupportedPuzzle';
import { WordWheelPuzzleView } from './WordWheelPuzzle';
import { WordsearchPuzzleView } from './WordsearchPuzzle';

export type PuzzleInteractionProps = {
    onSubmit: (guess: string) => void;
    onHint: () => void;
    onGiveUp: () => void;
    isSubmitting: boolean;
    isHinting: boolean;
    isGivingUp: boolean;
    submitError?: string;
    hintsRevealed: string[];
    canHint: boolean;
};

type Props = { puzzle: Puzzle } & PuzzleInteractionProps;

const SCORING_NOTE =
    'Solve within 10 mins for 100 pts, 15 mins for 90, 30 mins for 75, 60 mins for 50. -5 per wrong guess, -10 for a hint.';

export function PuzzleRenderer({ puzzle, ...rest }: Props) {
    const { colors, spacing, typography } = useTheme();
    const isInteractionDisabled = rest.isSubmitting || rest.isHinting || rest.isGivingUp;
    let content;
    let showScoringNote = true;

    switch (puzzle.puzzle_type) {
        case 'word':
        case 'math':
            content = <TextAnswerPuzzle puzzle={puzzle as TextPuzzle} {...rest} />;
            break;
        case 'ladder':
            content = <LadderPuzzleView puzzle={puzzle as LadderPuzzle} {...rest} />;
            break;
        case 'choice':
            content = <ChoicePuzzleView puzzle={puzzle as ChoicePuzzle} {...rest} />;
            break;
        case 'image-word':
            content = <ImageWordPuzzleView puzzle={puzzle as ImageWordPuzzle} {...rest} />;
            break;
        case 'clue-reveal':
            content = <ClueRevealPuzzleView puzzle={puzzle as ClueRevealPuzzle} {...rest} />;
            break;
        case 'countdown':
            content = <CountdownPuzzleView puzzle={puzzle as CountdownPuzzle} {...rest} />;
            break;
        case 'order':
            content = <OrderPuzzleView puzzle={puzzle as OrderPuzzle} {...rest} />;
            break;
        case 'word-wheel':
            content = <WordWheelPuzzleView puzzle={puzzle as WordWheelPuzzle} {...rest} />;
            break;
        case 'scrabble':
            content = <ScrabblePuzzleView puzzle={puzzle as ScrabblePuzzle} {...rest} />;
            break;
        case 'numgrid':
            content = <NumGridPuzzleView puzzle={puzzle as NumGridPuzzle} {...rest} />;
            break;
        case 'wordsearch':
            content = <WordsearchPuzzleView puzzle={puzzle as WordsearchPuzzle} {...rest} />;
            break;
        case 'match':
            content = <MatchPuzzleView puzzle={puzzle as MatchPuzzle} {...rest} />;
            break;
        case 'connections':
            content = <ConnectionsPuzzleView puzzle={puzzle as ConnectionsPuzzle} {...rest} />;
            break;
        default:
            content = <UnsupportedPuzzle />;
            showScoringNote = false;
    }

    return (
        <View style={{ flex: 1, justifyContent: 'center', gap: spacing.lg }}>
            <View pointerEvents={isInteractionDisabled ? 'none' : 'auto'}>{content}</View>
            {showScoringNote && (
                <Text
                    style={[
                        typography.caption,
                        { color: colors.textMuted, lineHeight: 18, textAlign: 'center' },
                    ]}
                >
                    {SCORING_NOTE}
                </Text>
            )}
            <Button
                title="Give up (score 0)"
                variant="secondary"
                onPress={rest.onGiveUp}
                loading={rest.isGivingUp}
                disabled={isInteractionDisabled}
            />
        </View>
    );
}
