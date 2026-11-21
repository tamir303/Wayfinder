import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

const Block = ({ className }: { className: string }) => <View className={`rounded bg-surface-muted ${className}`} />;

/** Placeholder cards shaped like flight results, shown while the search runs (it can take several seconds). */
export const FlightListSkeleton = () => {
  const { t } = useTranslation();
  return (
    <View className="gap-3" accessibilityLabel={t('common.loading')}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} className="gap-3 rounded-card border border-line p-4">
          <Block className="h-3 w-1/3" />
          <View className="flex-row items-center justify-between">
            <Block className="h-6 w-14" />
            <Block className="h-px flex-1" />
            <Block className="h-6 w-14" />
          </View>
          <Block className="h-6 w-20" />
        </View>
      ))}
    </View>
  );
};
