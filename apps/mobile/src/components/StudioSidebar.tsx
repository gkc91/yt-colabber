// Geniş ekranda sol menü (Studio düzeni, bizim renklerimiz). Üreticiler bu yapıyı
// YouTube Studio'dan tanıyor: üstte kim olduğun, altında bölümler. Logo ya da ad
// kullanmıyoruz — tanıdık düzen, taklit değil (DESIGN.md §9).
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, View } from 'react-native';

import { Rule } from '@/components/Card';
import { Body, Heading, Meta, Title } from '@/components/Type';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { fonts, layout, radius, space } from '@/design/tokens';
import { useSession } from '@/features/auth/session';
import { useBalance } from '@/features/credits/api';
import { useNiches } from '@/features/onboarding/api';
import { useProfile } from '@/features/profile/api';
import { t } from '@/i18n';

/** Menüde görünen bölümler; alt ekranlar (sonuç, görev) kendi bölümünü vurgular. */
const SECTIONS = ['review/index', 'submit/index', 'profile/index'] as const;
const PARENT: Record<string, (typeof SECTIONS)[number]> = {
  'review/[taskId]': 'review/index',
  'submit/new': 'submit/index',
  'submit/[id]': 'submit/index',
};

export const SIDEBAR_WIDTH = 248;

export function StudioSidebar({ state, descriptors, navigation }: BottomTabBarProps) {
  const colors = Colors[useColorScheme()];
  const { session } = useSession();
  const userId = session?.user.id;
  const profile = useProfile(userId);
  const balance = useBalance(userId);
  const niches = useNiches();

  const current = state.routes[state.index]?.name ?? '';
  const active = PARENT[current] ?? current;
  const niche = niches.data?.find((n) => n.id === profile.data?.niche_id)?.name;
  const name = profile.data?.display_name || session?.user.email?.split('@')[0] || '';

  return (
    <View
      style={[styles.bar, { backgroundColor: colors.background, borderRightColor: colors.border }]}
    >
      <Title style={styles.brand}>Clickable</Title>

      {/* Studio'daki kanal kartının karşılığı: kimsin, hangi nişe test ediyorsun. */}
      <View style={styles.identity}>
        <View style={[styles.avatar, { backgroundColor: colors.text }]}>
          <Heading style={{ color: colors.background }}>{name.slice(0, 1).toUpperCase()}</Heading>
        </View>
        <Body numberOfLines={1} style={styles.name}>
          {name}
        </Body>
        {niche ? <Meta numberOfLines={1}>{niche}</Meta> : null}
      </View>

      <Rule />

      <View style={styles.nav}>
        {SECTIONS.map((name) => {
          const route = state.routes.find((r) => r.name === name);
          if (!route) return null;
          const { options } = descriptors[route.key];
          const focused = active === name;
          const color = focused ? colors.tint : colors.muted;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="link"
              accessibilityState={{ selected: focused }}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
                // Alt ekrandayken bölüme tıklamak bölümün başına döner (Studio gibi).
                else if (current !== name) navigation.navigate(route.name);
              }}
              style={({ hovered }: { hovered?: boolean }) => [
                styles.item,
                (focused || hovered) && { backgroundColor: colors.surface },
              ]}
            >
              {options.tabBarIcon?.({ focused, color, size: 22 })}
              <Body style={[styles.label, focused && styles.labelActive]}>
                {typeof options.title === 'string' ? options.title : route.name}
              </Body>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.footer}>
        <Rule />
        <View style={styles.credits}>
          <Meta style={styles.upper}>{t('credits.balance')}</Meta>
          <Heading style={styles.number}>{String(balance.data ?? '—')}</Heading>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    width: SIDEBAR_WIDTH,
    height: '100%',
    borderRightWidth: StyleSheet.hairlineWidth * 2,
    paddingHorizontal: space.md,
    paddingVertical: space.xl,
    gap: space.xl,
  },
  brand: {
    paddingHorizontal: space.md,
  },
  identity: {
    alignItems: 'center',
    gap: space.xs,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  name: {
    fontFamily: fonts.heading,
  },
  nav: {
    gap: space.xs,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    minHeight: layout.minTouch,
    paddingHorizontal: space.md,
    borderRadius: radius.button,
  },
  label: {
    fontSize: 15,
  },
  labelActive: {
    fontFamily: fonts.heading,
  },
  footer: {
    marginTop: 'auto',
    gap: space.lg,
  },
  credits: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: space.md,
  },
  upper: {
    textTransform: 'uppercase',
  },
  number: {
    fontVariant: ['tabular-nums'],
  },
});
