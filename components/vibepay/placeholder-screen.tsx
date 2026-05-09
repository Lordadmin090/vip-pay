import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { hiddenRefreshControl, PullRefreshSkeletonOverlay } from '@/components/vibepay/pull-refresh';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';
import { VibeHeader } from './vibe-header';
import { VibeScreen, vibeColors } from './vibe-screen';

export function PlaceholderScreen({
  title,
  backgroundImage,
  sourceHint,
  actions,
}: {
  title: string;
  backgroundImage?: number;
  sourceHint?: string;
  actions?: Array<{ label: string; onPress: () => void; icon?: React.ComponentProps<typeof Ionicons>['name'] }>;
}) {
  const { refreshing, onRefresh } = usePullToRefresh(async () => {
    await new Promise<void>((r) => setTimeout(r, 700));
  });

  return (
    <VibeScreen backgroundImage={backgroundImage}>
      <View style={styles.flexFill}>
      <VibeHeader title={title} />
      <ScrollView
        refreshControl={hiddenRefreshControl(refreshing, onRefresh)}
        contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Imported route</Text>
          <Text style={styles.cardBody}>
            {sourceHint
              ? `This corresponds to ${sourceHint} in export-react.`
              : 'This corresponds to an export-react page.'}
          </Text>
        </View>
        {actions?.length ? (
          <View style={styles.actions}>
            {actions.map((a) => (
              <Pressable
                key={a.label}
                onPress={a.onPress}
                style={({ pressed }) => [styles.actionBtn, pressed && { transform: [{ scale: 0.98 }] }]}>
                <View style={styles.actionLeft}>
                  {a.icon ? <Ionicons name={a.icon} size={18} color="#fff" /> : null}
                  <Text style={styles.actionText}>{a.label}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={vibeColors.muted} />
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>
      <PullRefreshSkeletonOverlay visible={refreshing} />
      </View>
    </VibeScreen>
  );
}

const styles = StyleSheet.create({
  flexFill: { flex: 1 },
  container: {
    padding: 18,
    gap: 12,
  },
  card: {
    backgroundColor: vibeColors.card,
    borderWidth: 1,
    borderColor: vibeColors.border,
    borderRadius: 22,
    padding: 16,
  },
  cardTitle: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 14,
    marginBottom: 6,
  },
  cardBody: {
    color: vibeColors.muted,
    fontWeight: '600',
    fontSize: 12,
    lineHeight: 18,
  },
  actions: {
    gap: 10,
  },
  actionBtn: {
    backgroundColor: 'rgba(18,18,18,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
});

