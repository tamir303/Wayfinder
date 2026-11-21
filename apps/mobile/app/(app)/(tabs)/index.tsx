import type { GeoSuggestion } from '@wayfinder/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { Button } from '../../../src/components/Button';
import { Chip } from '../../../src/components/Chip';
import { Input } from '../../../src/components/Input';
import { Screen } from '../../../src/components/Screen';
import { SuggestionRow } from '../../../src/components/SuggestionRow';
import { toSuggestUiState } from '../../../src/features/geo/suggest-ui-state';
import { useGeoSuggest } from '../../../src/features/geo/useGeoSuggest';
import { defaultTripDate, isValidFutureDate } from '../../../src/lib/format';

const CABINS = ['economy', 'premium', 'business', 'first'] as const;

type FieldProps = { label: string; value: GeoSuggestion | null; onChange: (v: GeoSuggestion | null) => void };

const AirportField = ({ label, value, onChange }: FieldProps) => {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const query = useGeoSuggest(text);
  const state = toSuggestUiState({ text, isFetching: query.isFetching, error: query.error, data: query.data });
  return (
    <View>
      <Input
        label={label}
        value={value ? `${value.city} (${value.code})` : text}
        placeholder={t('flights.airportPlaceholder')}
        onChangeText={(t) => {
          onChange(null);
          setText(t);
        }}
      />
      {!value && state.kind === 'results' ? (
        <View className="mt-1 overflow-hidden rounded-card border border-line">
          {state.items.map((item) => (
            <SuggestionRow key={item.code} {...item} onPress={() => onChange(item)} />
          ))}
        </View>
      ) : null}
      {!value && state.kind === 'error' ? <Text className="pt-1 text-danger">{state.message}</Text> : null}
      {!value && state.kind === 'empty' ? <Text className="pt-1 text-ink-muted">{t('flights.noAirports')}</Text> : null}
    </View>
  );
};

export default function FlightSearch() {
  const { t } = useTranslation();
  const router = useRouter();
  const [from, setFrom] = useState<GeoSuggestion | null>(null);
  const [to, setTo] = useState<GeoSuggestion | null>(null);
  const [date, setDate] = useState(defaultTripDate());
  const [adults, setAdults] = useState(1);
  const [cabin, setCabin] = useState<(typeof CABINS)[number]>('economy');

  const dateOk = isValidFutureDate(date);
  const sameAirport = !!from && !!to && from.code === to.code;
  const canSearch = !!from && !!to && dateOk && !sameAirport;

  return (
    <Screen title={t('flights.title')} subtitle={t('flights.subtitle')}>
      <AirportField label={t('flights.from')} value={from} onChange={setFrom} />
      <AirportField label={t('flights.to')} value={to} onChange={setTo} />
      <Input label={t('flights.dateLabel')} value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation" />
      {!dateOk ? <Text className="text-danger">{t('flights.dateInvalid')}</Text> : null}
      {sameAirport ? <Text className="text-danger">{t('flights.sameAirport')}</Text> : null}
      <View className="flex-row items-center justify-between">
        <Text className="text-base text-ink">{t('flights.passengers')}</Text>
        <View className="flex-row items-center gap-4">
          <Pressable accessibilityLabel={t('flights.fewer')} accessibilityRole="button" disabled={adults <= 1} onPress={() => setAdults(adults - 1)} className="h-9 w-9 items-center justify-center rounded-full border border-line"><Text className="text-lg text-ink">−</Text></Pressable>
          <Text accessibilityLabel={t('flights.passengerCount', { count: adults })} className="w-6 text-center text-lg font-semibold text-ink">{adults}</Text>
          <Pressable accessibilityLabel={t('flights.more')} accessibilityRole="button" disabled={adults >= 9} onPress={() => setAdults(adults + 1)} className="h-9 w-9 items-center justify-center rounded-full border border-line"><Text className="text-lg text-ink">+</Text></Pressable>
        </View>
      </View>
      <View className="flex-row flex-wrap gap-2">
        {CABINS.map((c) => (
          <Chip key={c} label={t(`flights.cabin.${c}`)} selected={cabin === c} onPress={() => setCabin(c)} />
        ))}
      </View>
      <Button
        label={t('flights.search')}
        disabled={!canSearch}
        onPress={() => router.push({ pathname: '/flights/results', params: { from: from!.code, to: to!.code, date, adults: String(adults), cabin } })}
      />
    </Screen>
  );
}
