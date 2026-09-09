import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { ChessPuzzle } from '../../api/schemas';
import { useTheme } from '../../theme';
import { Button } from '../Button';
import type { PuzzleInteractionProps } from './PuzzleRenderer';

type Props = { puzzle: ChessPuzzle } & PuzzleInteractionProps;

type ChessIconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const PIECES: Record<string, { icon: ChessIconName; name: string; isWhite: boolean }> = {
    K: { icon: 'chess-king', name: 'white king', isWhite: true },
    Q: { icon: 'chess-queen', name: 'white queen', isWhite: true },
    R: { icon: 'chess-rook', name: 'white rook', isWhite: true },
    B: { icon: 'chess-bishop', name: 'white bishop', isWhite: true },
    N: { icon: 'chess-knight', name: 'white knight', isWhite: true },
    P: { icon: 'chess-pawn', name: 'white pawn', isWhite: true },
    k: { icon: 'chess-king', name: 'black king', isWhite: false },
    q: { icon: 'chess-queen', name: 'black queen', isWhite: false },
    r: { icon: 'chess-rook', name: 'black rook', isWhite: false },
    b: { icon: 'chess-bishop', name: 'black bishop', isWhite: false },
    n: { icon: 'chess-knight', name: 'black knight', isWhite: false },
    p: { icon: 'chess-pawn', name: 'black pawn', isWhite: false },
};

type Promotion = 'q' | 'r' | 'b' | 'n';

const PROMOTIONS: { value: Promotion; label: string }[] = [
    { value: 'q', label: 'Queen' },
    { value: 'r', label: 'Rook' },
    { value: 'b', label: 'Bishop' },
    { value: 'n', label: 'Knight' },
];

function parseFenBoard(fen: string): (keyof typeof PIECES | null)[][] {
    const board = fen.split(/\s+/)[0] ?? '';
    return board.split('/').map((rank) => {
        const squares: (keyof typeof PIECES | null)[] = [];
        for (const character of rank) {
            const emptySquares = Number(character);
            if (Number.isInteger(emptySquares) && emptySquares > 0) {
                squares.push(...Array<null>(emptySquares).fill(null));
            } else {
                squares.push(character);
            }
        }
        return squares;
    });
}

export function ChessPuzzleView({
    puzzle,
    onSubmit,
    onHint,
    isSubmitting,
    isHinting,
    submitError,
    hintsRevealed,
    canHint,
}: Props) {
    const [selectedSource, setSelectedSource] = useState<string | null>(null);
    const [selectedPiece, setSelectedPiece] = useState<keyof typeof PIECES | null>(null);
    const [selectedDestination, setSelectedDestination] = useState<string | null>(null);
    const [promotion, setPromotion] = useState<Promotion | null>(null);
    const { colors, spacing, typography } = useTheme();
    const fenFields = puzzle.question.fen.trim().split(/\s+/);
    const sideToMove = fenFields[1] === 'b' ? 'Black' : 'White';
    const whiteToMove = sideToMove === 'White';
    const board = parseFenBoard(puzzle.question.fen);
    const displayRankIndexes = whiteToMove
        ? Array.from({ length: 8 }, (_, index) => index)
        : Array.from({ length: 8 }, (_, index) => 7 - index);
    const displayFileIndexes = whiteToMove
        ? Array.from({ length: 8 }, (_, index) => index)
        : Array.from({ length: 8 }, (_, index) => 7 - index);
    const requiresPromotion =
        selectedDestination != null &&
        ((selectedPiece === 'P' && selectedDestination.endsWith('8')) ||
            (selectedPiece === 'p' && selectedDestination.endsWith('1')));
    const move =
        selectedSource && selectedDestination && (!requiresPromotion || promotion)
            ? `${selectedSource}${selectedDestination}${promotion ?? ''}`.toLowerCase()
            : null;

    const handleSubmit = () => {
        if (move) onSubmit(move);
    };

    const selectSquare = (square: string, pieceCode: keyof typeof PIECES | null) => {
        const piece = pieceCode ? PIECES[pieceCode] : null;
        const isOwnPiece = piece?.isWhite === whiteToMove;

        if (!selectedSource) {
            if (isOwnPiece) {
                setSelectedSource(square);
                setSelectedPiece(pieceCode);
            }
            return;
        }

        if (square === selectedSource) {
            setSelectedSource(null);
            setSelectedPiece(null);
            setSelectedDestination(null);
            setPromotion(null);
        } else if (isOwnPiece) {
            setSelectedSource(square);
            setSelectedPiece(pieceCode);
            setSelectedDestination(null);
            setPromotion(null);
        } else {
            setSelectedDestination(square);
            setPromotion(null);
        }
    };

    return (
        <View style={{ gap: spacing.lg }}>
            <View style={{ gap: spacing.xs }}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                    #{puzzle.puzzle_number} · {puzzle.puzzle_name}
                </Text>
                <Text style={[typography.title, { color: colors.text }]}>
                    {sideToMove} to move, mate in 1
                </Text>
            </View>

            <View
                accessibilityLabel={`Chess position. ${sideToMove} to move`}
                style={{
                    width: '100%',
                    maxWidth: 360,
                    aspectRatio: 1,
                    alignSelf: 'center',
                    borderWidth: 1,
                    borderColor: colors.border,
                }}
            >
                {displayRankIndexes.map((rankIndex) => (
                    <View key={rankIndex} style={{ flex: 1, flexDirection: 'row' }}>
                        {displayFileIndexes.map((fileIndex) => {
                            const pieceCode = board[rankIndex]?.[fileIndex] ?? null;
                            const piece = pieceCode ? PIECES[pieceCode] : null;
                            const square = `${String.fromCharCode(97 + fileIndex)}${8 - rankIndex}`;
                            const isSelectedSource = square === selectedSource;
                            const isSelectedDestination = square === selectedDestination;
                            return (
                                <Pressable
                                    key={square}
                                    accessibilityLabel={`${square}, ${piece?.name ?? 'empty'}`}
                                    accessibilityRole="button"
                                    accessibilityState={{ selected: isSelectedSource }}
                                    onPress={() => selectSquare(square, pieceCode)}
                                    style={{
                                        flex: 1,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        backgroundColor: isSelectedSource
                                            ? '#f6d365'
                                            : isSelectedDestination
                                              ? '#7fc8a9'
                                              : (rankIndex + fileIndex) % 2 === 0
                                                ? '#f0d9b5'
                                                : '#b58863',
                                    }}
                                >
                                    {piece && (
                                        <MaterialCommunityIcons
                                            name={piece.icon}
                                            size={34}
                                            color={piece.isWhite ? '#f7f7f7' : '#20242a'}
                                            accessibilityElementsHidden
                                        />
                                    )}
                                </Pressable>
                            );
                        })}
                    </View>
                ))}
            </View>

            {hintsRevealed.length > 0 && (
                <View
                    style={{
                        gap: spacing.xs,
                        padding: spacing.sm,
                        backgroundColor: colors.surface,
                        borderRadius: 8,
                    }}
                >
                    {hintsRevealed.map((hint, index) => (
                        <Text key={index} style={[typography.caption, { color: colors.textMuted }]}>
                            Hint: {hint}
                        </Text>
                    ))}
                </View>
            )}

            <View style={{ gap: spacing.sm }}>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                    {selectedSource
                        ? selectedDestination
                            ? `Move: ${selectedSource} → ${selectedDestination}`
                            : `Selected ${selectedSource}. Choose a destination.`
                        : `Tap a ${sideToMove.toLowerCase()} piece, then its destination.`}
                </Text>
                {requiresPromotion && (
                    <View style={{ gap: spacing.xs }}>
                        <Text style={[typography.caption, { color: colors.text }]}>Promote to</Text>
                        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                            {PROMOTIONS.map((option) => (
                                <Button
                                    key={option.value}
                                    title={option.label}
                                    variant={promotion === option.value ? 'primary' : 'secondary'}
                                    onPress={() => setPromotion(option.value)}
                                    style={{ flex: 1, paddingHorizontal: spacing.xs }}
                                />
                            ))}
                        </View>
                    </View>
                )}
                {submitError && (
                    <Text style={[typography.caption, { color: colors.error }]}>{submitError}</Text>
                )}
                <Button
                    title="Submit"
                    onPress={handleSubmit}
                    loading={isSubmitting}
                    disabled={!move}
                />
                {canHint && (
                    <Button title="Hint" variant="secondary" onPress={onHint} loading={isHinting} />
                )}
            </View>
        </View>
    );
}
