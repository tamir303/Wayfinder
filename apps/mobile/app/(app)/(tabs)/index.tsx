import type { GeoSuggestion } from '@wayfinder/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { Button } from '../../../src/components/Button';
import { Chip } from '../../../src/components/Chip';
import { DatePicker } from '../../../src/components/DatePicker';
import { Input } from '../../../src/components/Input';
import { Screen } from '../../../src/components/Screen';
import { SuggestionRow } from '../../../src/components/SuggestionRow';
import { toSuggestUiState } from '../../../src/features/geo/suggest-ui-state';
import { useGeoSuggest } from '../../../src/features/geo/useGeoSuggest';
import { useDeleteSavedSearch, useSavedSearches } from '../../../src/features/flights/saved';
import { useRecentAirports, useRecentSearches, type RecentSearch } from '../../../src/features/flights/useRecents';
import { arrow } from '../../../src/i18n';
import { addDays, defaultTripDate, isoDate, isValidFutureDate } from '../../../src/lib/format';

const CABINS = ['economy', 'premium', 'business', 'first'] as const;

type FieldProps = { label: string; value: GeoSuggestion | null; onChange: (v: GeoSuggestion | null) => void; recents: GeoSuggestion[] };

const AirportField = ({ label, value, onChange, recents }: FieldProps) => {
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
      {!value && text.trim() === '' && recents.length > 0 ? (
        <View className="flex-row flex-wrap gap-2 pt-2" accessibilityLabel={t('flights.recentAirports')}>
          {recents.map((a) => (
            <Chip key={a.code} label={`${a.code} · ${a.city}`} onPress={() => onChange(a)} />
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
  const [tripType, setTripType] = useState<'oneWay' | 'roundTrip'>('oneWay');
  const [date, setDate] = useState(defaultTripDate());
  const [returnDate, setReturnDate] = useState(addDays(defaultTripDate(), 7));
  const [adults, setAdults] = useState(1);
  const [cabin, setCabin] = useState<(typeof CABINS)[number]>('economy');
  const recentAirports = useRecentAirports();
  const recentSearches = useRecentSearches();
  const savedSearches = useSavedSearches();
  const deleteSaved = useDeleteSavedSearch();

  const dateOk = isValidFutureDate(date);
  const sameAirport = !!from && !!to && from.code === to.code;
  const roundTrip = tripType === 'roundTrip';
  const returnOk = !roundTrip || (isValidFutureDate(returnDate) && returnDate > date);
  const canSearch = !!from && !!to && dateOk && returnOk && !sameAirport;

  // Re-use a past search. Dates that have passed fall back to the defaults so the form stays valid.
  const applyRecent = (r: RecentSearch) => {
    const today = isoDate(new Date());
    const nextDate = r.date >= today ? r.date : defaultTripDate();
    setFrom(r.from);
    setTo(r.to);
    setAdults(r.adults);
    setCabin(r.cabin);
    setDate(nextDate);
    setTripType(r.returnDate ? 'roundTrip' : 'oneWay');
    setReturnDate(r.returnDate && r.returnDate > nextDate ? r.returnDate : addDays(nextDate, 7));
  };

  return (
    <Screen title={t('flights.title')} subtitle={t('flights.subtitle')}>
      <View className="flex-row gap-2">
        {(['oneWay', 'roundTrip'] as const).map((k) => (
          <Chip key={k} label={t(`flights.tripType.${k}`)} selected={tripType === k} onPress={() => setTripType(k)} />
        ))}
      </View>
      <AirportField label={t('flights.from')} value={from} onChange={setFrom} recents={recentAirports.items} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('flights.swap')}
        disabled={!from && !to}
        onPress={() => {
          setFrom(to);
          setTo(from);
        }}
        className="self-center rounded-full border border-line px-4 py-1"
      >
        <Text className="text-lg text-brand">⇅</Text>
      </Pressable>
      <AirportField label={t('flights.to')} value={to} onChange={setTo} recents={recentAirports.items} />
      <DatePicker
        testID="flight-date"
        label={t('flights.dateLabel')}
        value={date}
        minDate={isoDate(new Date())}
        onChange={(d) => {
          setDate(d);
          if (returnDate <= d) setReturnDate(addDays(d, 7)); // keep the return after the departure
        }}
      />
      {!dateOk ? <Text className="text-danger">{t('flights.dateInvalid')}</Text> : null}
      {roundTrip ? <DatePicker testID="flight-return" label={t('flights.returnLabel')} value={returnDate} minDate={addDays(date, 1)} onChange={setReturnDate} /> : null}
      {roundTrip && dateOk && !returnOk ? <Text className="text-danger">{t('flights.returnInvalid')}</Text> : null}
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
        onPress={() => {
          recentAirports.add(to!);
          recentAirports.add(from!);
          recentSearches.add({ from: from!, to: to!, date, returnDate: roundTrip ? returnDate : undefined, adults, cabin });
          router.push({ pathname: '/flights/results', params: { from: from!.code, to: to!.code, date, ...(roundTrip ? { returnDate } : {}), adults: String(adults), cabin } });
        }}
      />
      {(savedSearches.data?.searches.length ?? 0) > 0 ? (
        <View className="gap-2 pt-2">
          <Text accessibilityRole="header" className="text-lg font-semibold text-ink">{t('flights.savedSearches')}</Text>
          {savedSearches.data!.searches.map((s) => (
            <View key={s.id} className="flex-row items-center rounded-card border border-line">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${t('flights.savedSearches')}: ${s.from} ${s.to} ${s.date}`}
                onPress={() =>
                  applyRecent({ from: { code: s.from, name: s.from, city: s.from }, to: { code: s.to, name: s.to, city: s.to }, date: s.date, adults: s.adults, cabin: s.cabin })
                }
                className="flex-1 px-4 py-3"
              >
                <Text className="text-base text-ink">{s.from} {arrow()} {s.to}</Text>
                <Text className="text-sm text-ink-muted">{s.date} · {t('flights.passengerCount', { count: s.adults })}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={t('flights.deleteSaved', { route: `${s.from} ${s.to}` })} onPress={() => deleteSaved.mutate(s.id)} className="px-4 py-3">
                <Text className="text-brand">✕</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      {recentSearches.items.length > 0 ? (
        <View className="gap-2 pt-2">
          <Text accessibilityRole="header" className="text-lg font-semibold text-ink">{t('flights.recentSearches')}</Text>
          {recentSearches.items.map((r) => (
            <Pressable
              key={`${r.from.code}-${r.to.code}-${r.date}-${r.returnDate ?? ''}`}
              accessibilityRole="button"
              accessibilityLabel={`${r.from.code} ${r.to.code} ${r.date}${r.returnDate ? ` ${r.returnDate}` : ''}`}
              onPress={() => applyRecent(r)}
              className="rounded-card border border-line px-4 py-3"
            >
              <Text className="text-base text-ink">{r.from.code} {arrow()} {r.to.code}</Text>
              <Text className="text-sm text-ink-muted">{r.date}{r.returnDate ? ` – ${r.returnDate}` : ''} · {t('flights.passengerCount', { count: r.adults })}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}
