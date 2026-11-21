import type {
    CanvasPuzzle,
    ChessPuzzle,
    ChoicePuzzle,
    ClueRevealPuzzle,
    CodewordPuzzle,
    ConnectionsPuzzle,
    CountdownPuzzle,
    CrosswordPuzzle,
    ImageWordPuzzle,
    LadderPuzzle,
    MatchPuzzle,
    NumberSquarePuzzle,
    NumGridPuzzle,
    OrderPuzzle,
    Puzzle,
    ScrabblePuzzle,
    SudokuPuzzle,
    TextPuzzle,
    WordLadderV2Puzzle,
    WordSquarePuzzle,
    WordWheelPuzzle,
    WordsearchPuzzle,
} from '../../api/schemas';
import { Alert, Text, View } from 'react-native';
import { PuzzleDraftProvider, type PuzzleProgressProps } from './PuzzleDraftProvider';
import { draftFingerprint } from '../../lib/puzzleDrafts';
import { useTheme } from '../../theme';
import { Button } from '../Button';
import { PuzzleCompletionStats } from '../PuzzleCompletionStats';
import { formatCompletionStats } from '../../lib/puzzleAnswer';
import { CanvasPuzzleView } from './CanvasPuzzle';
import { ChessPuzzleView } from './ChessPuzzle';
import { ChoicePuzzleView } from './ChoicePuzzle';
import { ClueRevealPuzzleView } from './ClueRevealPuzzle';
import { CodewordPuzzleView } from './CodewordPuzzle';
import { ConnectionsPuzzleView } from './ConnectionsPuzzle';
import { CountdownPuzzleView } from './CountdownPuzzle';
import { CrosswordPuzzleView } from './CrosswordPuzzle';
import { ImageWordPuzzleView } from './ImageWordPuzzle';
import { LadderPuzzleView } from './LadderPuzzle';
import { MatchPuzzleView } from './MatchPuzzle';
import { NumberSquarePuzzleView } from './NumberSquarePuzzle';
import { NumGridPuzzleView } from './NumGridPuzzle';
import { OrderPuzzleView } from './OrderPuzzle';
import { TextAnswerPuzzle } from './TextAnswerPuzzle';
import { ScrabblePuzzleView } from './ScrabblePuzzle';
import { SudokuPuzzleView } from './SudokuPuzzle';
import { UnsupportedPuzzle } from './UnsupportedPuzzle';
import { WordLadderV2PuzzleView } from './WordLadderV2Puzzle';
import { WordSquarePuzzleView } from './WordSquarePuzzle';
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
    hintError?: string;
    hintsRevealed: string[];
    canHint: boolean;
};

type Props = { puzzle: Puzzle; draftOwner?: string } & PuzzleInteractionProps & PuzzleProgressProps;

const SCORING_NOTE =
    'Solve within 10 mins for 100 pts, 15 mins for 90, 30 mins for 75, 60 mins for 50. -5 per wrong guess, -10 for a hint.';

export function PuzzleRenderer({
    puzzle,
    draftOwner,
    draftToken,
    progressMetadata,
    onRestoreProgress,
    onReloadProgress,
    ...rest
}: Props) {
    const { colors, spacing, typography } = useTheme();
    const isInteractionDisabled = rest.isSubmitting || rest.isHinting || rest.isGivingUp;
    const confirmGiveUp = () => {
        Alert.alert(
            'Give up?',
            'This will end the puzzle with a score of 0 and reveal the solution.',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Give up', style: 'destructive', onPress: rest.onGiveUp },
            ]
        );
    };
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
        case 'word-ladder-v2':
            content = <WordLadderV2PuzzleView puzzle={puzzle as WordLadderV2Puzzle} {...rest} />;
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
        case 'chess':
            content = <ChessPuzzleView puzzle={puzzle as ChessPuzzle} {...rest} />;
            break;
        case 'crossword':
            content = <CrosswordPuzzleView puzzle={puzzle as CrosswordPuzzle} {...rest} />;
            break;
        case 'sudoku':
            content = <SudokuPuzzleView puzzle={puzzle as SudokuPuzzle} {...rest} />;
            break;
        case 'codeword':
            content = <CodewordPuzzleView puzzle={puzzle as CodewordPuzzle} {...rest} />;
            break;
        case 'word-square':
            content = <WordSquarePuzzleView puzzle={puzzle as WordSquarePuzzle} {...rest} />;
            break;
        case 'number-square':
            content = <NumberSquarePuzzleView puzzle={puzzle as NumberSquarePuzzle} {...rest} />;
            break;
        case 'canvas':
            content = <CanvasPuzzleView puzzle={puzzle as CanvasPuzzle} {...rest} />;
            break;
        default:
            content = <UnsupportedPuzzle />;
            showScoringNote = false;
    }

    return (
        <View style={{ flex: 1, justifyContent: 'center', gap: spacing.lg }}>
            <View pointerEvents={isInteractionDisabled ? 'none' : 'auto'}>
                {draftOwner && ['sudoku', 'crossword', 'codeword'].includes(puzzle.puzzle_type) ? (
                    <PuzzleDraftProvider
                        key={`${draftOwner}:${draftToken ?? ''}:${puzzle.id}:${draftFingerprint(puzzle)}:${puzzle.raw_question ?? ''}`}
                        owner={draftOwner}
                        puzzle={puzzle}
                        draftToken={draftToken}
                        progressMetadata={progressMetadata}
                        onRestoreProgress={onRestoreProgress}
                        onReloadProgress={onReloadProgress}
                    >
                        {content}
                    </PuzzleDraftProvider>
                ) : (
                    content
                )}
            </View>
            {rest.hintError ? (
                <Text
                    accessibilityRole="alert"
                    style={[typography.caption, { color: colors.error }]}
                >
                    {rest.hintError}
                </Text>
            ) : null}
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
            <PuzzleCompletionStats stats={formatCompletionStats(puzzle.completion_stats)} />
            <Button
                title="Give up (score 0)"
                variant="secondary"
                onPress={confirmGiveUp}
                loading={rest.isGivingUp}
                disabled={isInteractionDisabled}
            />
        </View>
    );
}
