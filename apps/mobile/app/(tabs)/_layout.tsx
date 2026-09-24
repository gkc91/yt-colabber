import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { headerTitleStyle } from '@/design/navigationTheme';
import { t } from '@/i18n';

function TabIcon({ name, color }: { name: SymbolViewProps['name']; color: ColorValue }) {
  return <SymbolView name={name} tintColor={color} size={26} />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme].tint,
        tabBarInactiveTintColor: Colors[colorScheme].muted,
        headerTitleStyle,
        // Disable the static render of the header on web
        // to prevent a hydration error in React Navigation.
        headerShown: useClientOnlyValue(false, true),
      }}
    >
      <Tabs.Screen
        name="review/index"
        options={{
          title: t('tabs.review'),
          tabBarIcon: ({ color }) => (
            <TabIcon
              name={{ ios: 'hand.thumbsup', android: 'thumb_up', web: 'thumb_up' }}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="submit/index"
        options={{
          title: t('tabs.submit'),
          tabBarIcon: ({ color }) => (
            <TabIcon
              name={{ ios: 'play.rectangle', android: 'smart_display', web: 'smart_display' }}
              color={color}
            />
          ),
        }}
      />
      {/* Alt ekranlar sekme çubuğunda görünmez; kendi sekmelerinden açılır. */}
      <Tabs.Screen name="review/[taskId]" options={{ href: null, title: t('tabs.review') }} />
      <Tabs.Screen name="submit/new" options={{ href: null, title: t('submit.newTest') }} />
      <Tabs.Screen name="submit/[id]" options={{ href: null, title: t('results.title') }} />
      <Tabs.Screen
        name="profile/index"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color }) => (
            <TabIcon
              name={{ ios: 'person.crop.circle', android: 'person', web: 'person' }}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
