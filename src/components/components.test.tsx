import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { allText, findAllByHost, findByHost, press, render } from '../test/render';
import { Button } from './Button';
import { QueryStateView } from './QueryStateView';
import { Screen } from './Screen';
import { TextInput } from './TextInput';

describe('Button', () => {
    it('renders an enabled button with accessible state', () => {
        const onPress = vi.fn();
        const renderer = render(<Button title="Play" onPress={onPress} />);

        const button = findByHost(renderer, 'Pressable');

        expect(allText(renderer)).toContain('Play');
        expect(button.props.accessibilityRole).toBe('button');
        expect(button.props.accessibilityState).toEqual({ disabled: false, busy: false });

        press(button);

        expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('marks loading buttons as disabled and busy', () => {
        const renderer = render(<Button title="Saving" loading />);

        const button = findByHost(renderer, 'Pressable');

        expect(button.props.disabled).toBe(true);
        expect(button.props.accessibilityState).toEqual({ disabled: true, busy: true });
        expect(findAllByHost(renderer, 'ActivityIndicator')).toHaveLength(1);
        expect(allText(renderer)).not.toContain('Saving');
    });
});

describe('TextInput', () => {
    it('renders label, forwards input props, and shows validation errors', () => {
        const onChangeText = vi.fn();
        const renderer = render(
            <TextInput
                label="Email"
                value="user@example.com"
                error="Invalid email"
                onChangeText={onChangeText}
                keyboardType="email-address"
            />
        );

        const input = findByHost(renderer, 'TextInput');

        expect(allText(renderer)).toContain('Email');
        expect(allText(renderer)).toContain('Invalid email');
        expect(input.props.value).toBe('user@example.com');
        expect(input.props.keyboardType).toBe('email-address');
        expect(input.props.onChangeText).toBe(onChangeText);
    });
});

describe('QueryStateView', () => {
    it('renders a loading indicator while data is loading', () => {
        const renderer = render(
            <QueryStateView isLoading={true}>
                <Button title="Hidden" />
            </QueryStateView>
        );

        expect(findAllByHost(renderer, 'ActivityIndicator')).toHaveLength(1);
        expect(allText(renderer)).not.toContain('Hidden');
    });

    it('renders errors with retry action', () => {
        const onRetry = vi.fn();
        const renderer = render(
            <QueryStateView isLoading={false} error={new Error('Failed to load')} onRetry={onRetry}>
                <Button title="Hidden" />
            </QueryStateView>
        );

        expect(allText(renderer)).toContain('Failed to load');
        expect(allText(renderer)).toContain('Try again');

        press(findByHost(renderer, 'Pressable'));

        expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('renders empty and success states', () => {
        const emptyRenderer = render(
            <QueryStateView isLoading={false} isEmpty emptyMessage="No puzzles yet.">
                <Button title="Hidden" />
            </QueryStateView>
        );
        const successRenderer = render(
            <QueryStateView isLoading={false}>
                <Button title="Visible" />
            </QueryStateView>
        );

        expect(allText(emptyRenderer)).toContain('No puzzles yet.');
        expect(allText(successRenderer)).toContain('Visible');
    });
});

describe('Screen', () => {
    it('renders non-scrollable content in a safe area', () => {
        const renderer = render(
            <Screen>
                <Button title="Ready" />
            </Screen>
        );

        expect(findAllByHost(renderer, 'SafeAreaView')).toHaveLength(1);
        expect(findAllByHost(renderer, 'ScrollView')).toHaveLength(0);
        expect(allText(renderer)).toContain('Ready');
    });

    it('adds refresh control for scrollable screens with refresh handlers', () => {
        const onRefresh = vi.fn();
        const renderer = render(
            <Screen scrollable refreshing onRefresh={onRefresh}>
                <Button title="Refreshable" />
            </Screen>
        );

        const scrollView = findByHost(renderer, 'ScrollView');
        const refreshControl = scrollView.props.refreshControl;

        expect(refreshControl.props.refreshing).toBe(true);
        expect(refreshControl.props.onRefresh).toBe(onRefresh);
        expect(allText(renderer)).toContain('Refreshable');
    });
});
