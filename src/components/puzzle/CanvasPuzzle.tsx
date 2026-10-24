import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Ellipse, Line, Polygon, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import type { CanvasPuzzle, CanvasShape } from '../../api/schemas';
import { TextInput } from '../TextInput';
import { GridPuzzleFrame } from './grid';
import type { PuzzleInteractionProps } from './PuzzleRenderer';

type Props = { puzzle: CanvasPuzzle } & PuzzleInteractionProps;

function arrowHead(x1: number, y1: number, x2: number, y2: number, strokeWidth: number): string {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const length = 10 + 3 * strokeWidth;
    const point = (offset: number) =>
        `${x2 - length * Math.cos(angle + offset)},${y2 - length * Math.sin(angle + offset)}`;
    return `${x2},${y2} ${point(Math.PI / 7)} ${point(-Math.PI / 7)}`;
}

function CanvasShapeView({ shape }: { shape: CanvasShape }) {
    const fill = shape.fill ?? 'none';
    const stroke = shape.stroke ?? 'none';
    const strokeWidth = shape.strokeWidth ?? 1;
    const paint = { fill, stroke, strokeWidth };

    switch (shape.type) {
        case 'rect':
            return <Rect x={shape.x} y={shape.y} width={shape.w} height={shape.h} {...paint} />;
        case 'ellipse':
            return <Ellipse cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} {...paint} />;
        case 'line':
            return (
                <>
                    <Line x1={shape.x1} y1={shape.y1} x2={shape.x2} y2={shape.y2} {...paint} />
                    {shape.arrow && stroke !== 'none' && (
                        <Polygon
                            points={arrowHead(shape.x1, shape.y1, shape.x2, shape.y2, strokeWidth)}
                            fill={stroke}
                        />
                    )}
                </>
            );
        case 'path':
            return (
                <Polyline
                    points={shape.points.map(([x, y]) => `${x},${y}`).join(' ')}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            );
        case 'text':
            return (
                <SvgText
                    x={shape.x}
                    y={shape.y}
                    fontSize={shape.size}
                    fontFamily="sans-serif"
                    fill={shape.fill ?? '#e0e0e0'}
                    stroke={stroke}
                    strokeWidth={stroke === 'none' ? 0 : strokeWidth}
                >
                    {shape.text}
                </SvgText>
            );
    }
}

/** Draws a canvas question's shapes in its fixed 800×600 scene, scaled to the available width. */
function CanvasDrawing({ question }: { question: CanvasPuzzle['question'] }) {
    return (
        <View
            accessible
            accessibilityRole="image"
            accessibilityLabel={question.alt ?? 'Puzzle picture'}
            style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 8, overflow: 'hidden' }}
        >
            <Svg width="100%" height="100%" viewBox="0 0 800 600">
                <Rect
                    x={0}
                    y={0}
                    width={800}
                    height={600}
                    fill={question.background ?? '#15191e'}
                />
                {question.shapes.map((shape, index) => (
                    <CanvasShapeView key={index} shape={shape} />
                ))}
            </Svg>
        </View>
    );
}

export function CanvasPuzzleView({ puzzle, onSubmit, ...rest }: Props) {
    const [guess, setGuess] = useState('');
    const handleSubmit = () => {
        if (guess.trim()) onSubmit(guess.trim());
    };

    return (
        <GridPuzzleFrame
            puzzleNumber={puzzle.puzzle_number}
            puzzleName={puzzle.puzzle_name}
            prompt={puzzle.question.prompt}
            canSubmit={!!guess.trim()}
            onSubmit={handleSubmit}
            {...rest}
        >
            <CanvasDrawing question={puzzle.question} />
            <TextInput
                label="Your answer"
                value={guess}
                onChangeText={setGuess}
                editable={!rest.isSubmitting}
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
            />
        </GridPuzzleFrame>
    );
}
