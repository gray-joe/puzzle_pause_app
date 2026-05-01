import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import { useTheme } from '../../src/theme';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function tabIcon(outline: IoniconsName, filled: IoniconsName) {
    return ({ color, focused }: { color: string; focused: boolean }) => (
        <Ionicons name={focused ? filled : outline} size={22} color={color} />
    );
}

export default function TabsLayout() {
    const { colors } = useTheme();
    const router = useRouter();
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.textMuted,
                tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
            }}
        >
            <Tabs.Screen
                name="(calendar)"
                options={{ title: 'Calendar', tabBarIcon: tabIcon('today-outline', 'today') }}
            />
            <Tabs.Screen
                name="archive"
                options={{
                    title: 'Archive',
                    tabBarIcon: tabIcon('albums-outline', 'albums'),
                }}
                listeners={{
                    tabPress: (event) => {
                        event.preventDefault();
                        router.replace('/archive' as never);
                    },
                }}
            />
            <Tabs.Screen
                name="leagues"
                options={{ title: 'Leagues', tabBarIcon: tabIcon('trophy-outline', 'trophy') }}
            />
            <Tabs.Screen
                name="account"
                options={{ title: 'Account', tabBarIcon: tabIcon('person-outline', 'person') }}
            />
        </Tabs>
    );
}
