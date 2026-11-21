import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { errorMessage } from '../features/geo/suggest-ui-state';
import i18n from '../i18n';
import { ApiClientError } from '../lib/api-error';

type Props<T> = { query: UseQueryResult<T>; children: (data: T) => ReactNode };

export function QueryState<T>({ query, children }: Props<T>) {
  if (query.isPending) {
    return (
      <View className="items-center py-8" accessibilityLabel={i18n.t('common.loading')}>
        <ActivityIndicator />
      </View>
    );
  }
  if (query.error) {
    const code = query.error instanceof ApiClientError ? query.error.code : 'PROVIDER_DOWN';
    return <Text className="py-4 text-danger" accessibilityRole="alert">{errorMessage(code)}</Text>;
  }
  return <>{children(query.data as T)}</>;
}
