import React, { type ReactElement } from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';

export function render(element: ReactElement) {
    let renderer: TestRenderer.ReactTestRenderer | null = null;
    act(() => {
        renderer = TestRenderer.create(element);
    });
    return renderer!;
}

export function update(renderer: TestRenderer.ReactTestRenderer, element: ReactElement) {
    act(() => {
        renderer.update(element);
    });
}

export function press(node: ReactTestInstance) {
    act(() => {
        node.props.onPress?.();
    });
}

export async function pressAsync(node: ReactTestInstance) {
    await act(async () => {
        await node.props.onPress?.();
    });
}

export function changeText(node: ReactTestInstance, value: string) {
    act(() => {
        node.props.onChangeText?.(value);
    });
}

export function submitEditing(node: ReactTestInstance) {
    act(() => {
        node.props.onSubmitEditing?.();
    });
}

export async function submitEditingAsync(node: ReactTestInstance) {
    await act(async () => {
        await node.props.onSubmitEditing?.();
    });
}

export function textContent(node: ReactTestInstance): string {
    return node.children
        .map((child) => (typeof child === 'string' ? child : textContent(child)))
        .join('');
}

export function allText(renderer: TestRenderer.ReactTestRenderer): string {
    return findAllByHost(renderer, 'Text').map(textContent).join('\n');
}

export function findPressableByText(renderer: TestRenderer.ReactTestRenderer, text: string) {
    return findAllByHost(renderer, 'Pressable').find((node) => textContent(node).includes(text));
}

export function findByHost(renderer: TestRenderer.ReactTestRenderer, type: string) {
    return renderer.root.findByType(type as React.ElementType);
}

export function findAllByHost(renderer: TestRenderer.ReactTestRenderer, type: string) {
    return renderer.root.findAllByType(type as React.ElementType);
}
