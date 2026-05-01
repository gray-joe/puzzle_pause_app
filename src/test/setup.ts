import React from 'react';
import { vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

export const routerMock = {
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
};
export const clipboardSetStringAsyncMock = vi.fn(() => Promise.resolve());
const secureStoreMock = vi.hoisted(() => ({
    getItemAsync: vi.fn(() => Promise.resolve(null)),
    setItemAsync: vi.fn(() => Promise.resolve()),
    deleteItemAsync: vi.fn(() => Promise.resolve()),
}));

export const localSearchParamsMock = vi.fn(() => ({}));
export const segmentsMock = vi.fn((): string[] => []);
export const navigationRefMock = { current: {} };

function nativeComponent(name: string) {
    return React.forwardRef<unknown, { children?: React.ReactNode } & Record<string, any>>(
        ({ children, ...props }, ref) =>
            React.createElement(name as React.ElementType, { ...props, ref }, children)
    );
}

const FlatList = ({ data = [], renderItem, keyExtractor, ...props }: Record<string, any>) =>
    React.createElement(
        'FlatList' as React.ElementType,
        props,
        data.map((item: unknown, index: number) =>
            React.createElement(
                React.Fragment,
                { key: keyExtractor ? keyExtractor(item, index) : index },
                renderItem?.({ item, index })
            )
        )
    );

vi.mock('react-native', () => ({
    ActivityIndicator: nativeComponent('ActivityIndicator'),
    Alert: { alert: vi.fn() },
    FlatList,
    Image: nativeComponent('Image'),
    Pressable: nativeComponent('Pressable'),
    RefreshControl: nativeComponent('RefreshControl'),
    ScrollView: nativeComponent('ScrollView'),
    Text: nativeComponent('Text'),
    TextInput: nativeComponent('TextInput'),
    View: nativeComponent('View'),
    Platform: {
        OS: 'ios',
        select: (values: Record<string, unknown>) => values.ios ?? values.default,
    },
    StyleSheet: {
        create: <T>(styles: T) => styles,
        flatten: (style: unknown) => style,
    },
    useColorScheme: vi.fn(() => 'light'),
    useWindowDimensions: vi.fn(() => ({ width: 360, height: 640, scale: 2, fontScale: 1 })),
}));

vi.mock('react-native-safe-area-context', () => ({
    SafeAreaProvider: nativeComponent('SafeAreaProvider'),
    SafeAreaView: nativeComponent('SafeAreaView'),
}));

vi.mock('react-native-render-html', () => ({
    default: nativeComponent('RenderHtml'),
}));

vi.mock('expo-router', () => {
    const Stack = nativeComponent('Stack') as any;
    Stack.Screen = nativeComponent('Stack.Screen');
    const Tabs = nativeComponent('Tabs') as any;
    Tabs.Screen = nativeComponent('Tabs.Screen');
    return {
        Stack,
        Tabs,
        Slot: nativeComponent('Slot'),
        useRouter: () => routerMock,
        useLocalSearchParams: localSearchParamsMock,
        useSegments: segmentsMock,
        useNavigationContainerRef: () => navigationRefMock,
    };
});

vi.mock('@expo/vector-icons', () => ({
    Ionicons: nativeComponent('Ionicons'),
}));

vi.mock('expo-status-bar', () => ({
    StatusBar: nativeComponent('StatusBar'),
}));

vi.mock('expo-clipboard', () => ({
    setStringAsync: clipboardSetStringAsyncMock,
}));

vi.mock('expo-secure-store', () => ({
    getItemAsync: secureStoreMock.getItemAsync,
    setItemAsync: secureStoreMock.setItemAsync,
    deleteItemAsync: secureStoreMock.deleteItemAsync,
}));

vi.mock('@sentry/react-native', () => ({
    init: vi.fn(),
    reactNavigationIntegration: vi.fn(() => ({ registerNavigationContainer: vi.fn() })),
    setUser: vi.fn(),
    wrap: vi.fn((component) => component),
}));
