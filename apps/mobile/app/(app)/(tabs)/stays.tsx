import type { Stay } from '@wayfinder/shared';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { Button } from '../../../src/components/Button';
import { StayCard } from '../../../src/components/cards';
import { Chip } from '../../../src/components/Chip';
import { Input } from '../../../src/components/Input';
import { QueryState } from '../../../src/components/QueryState';
import { Screen } from '../../../src/components/Screen';
import { useFavorites, useStaySearch, useStaySuggest, useToggleFavorite, type StayTrip } from '../../../src/features/stays/hooks';
import { projectPins, sortStays, type StaySort } from '../../../src/features/stays/map';
import { addDays, defaultTripDate, formatPrice, isValidFutureDate, nightsBetween } from '../../../src/lib/format';

type View_ = 'list' | 'map' | 'saved';
const SORTS: StaySort[] = ['recommended', 'cheapest', 'topRated'];
const MAX_NIGHTS = 30;

// Placeholder map: pins are projected from the stays' real coordinates until MapLibre is wired in.
const MapPlaceholder = ({ stays, selectedId, onSelect }: { stays: Stay[]; selectedId?: string | undefined; onSelect: (s: Stay) => void }) => {
  const { t } = useTranslation();
  const pins = Object.fromEntries(projectPins(stays).map((p) => [p.id, p]));
  return (
    <View accessibilityLabel={t('stays.map')} className="relative h-56 overflow-hidden rounded-card bg-brand-soft">
      <View className="absolute left-[10%] top-0 h-full w-1 bg-surface" />
      <View className="absolute left-[55%] top-0 h-full w-2 bg-surface" />
      <View className="absolute left-0 top-[45%] h-2 w-full bg-surface" />
      {stays.map((s) => {
        const on = s.id === selectedId;
        const pin = pins[s.id]!;
        return (
          <Pressable
            key={s.id}
            accessibilityRole="button"
            accessibilityLabel={t('stays.pin', { name: s.name, price: formatPrice(s.pricePerNight, s.currency) })}
            onPress={() => onSelect(s)}
            style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
            className={`absolute rounded-full border px-2.5 py-1 ${on ? 'border-brand-dark bg-brand' : 'border-line bg-surface'}`}
          >
            <Text className={`text-sm font-bold ${on ? 'text-white' : 'text-ink'}`}>{formatPrice(s.pricePerNight, s.currency)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
};

export default function Stays() {
  const { t } = useTranslation();
  const router = useRouter();
  const [dest, setDest] = useState('');
  const [picked, setPicked] = useState(false);
  const [checkIn, setCheckIn] = useState(defaultTripDate());
  const [checkOut, setCheckOut] = useState(addDays(defaultTripDate(), 4));
  const [adults, setAdults] = useState(2);
  const [trip, setTrip] = useState<StayTrip | null>(null);
  const [view, setView] = useState<View_>('list');
  const [sort, setSort] = useState<StaySort>('recommended');
  const [selectedId, setSelectedId] = useState<string | undefined>();

  const suggest = useStaySuggest(picked ? '' : dest);
  const search = useStaySearch(trip);
  const favorites = useFavorites();
  const toggle = useToggleFavorite();

  const nights = nightsBetween(checkIn, checkOut);
  const datesOk = isValidFutureDate(checkIn) && /^\d{4}-\d{2}-\d{2}$/.test(checkOut) && nights >= 1 && nights <= MAX_NIGHTS;
  const canSearch = dest.trim().length >= 2 && datesOk;
  const tripNights = trip ? nightsBetween(trip.checkIn, trip.checkOut) : 0;
  const favoriteIds = new Set((favorites.data?.favorites ?? []).map((f) => f.id));

  const open = (id: string) => {
    const q = trip?.q ?? dest.trim();
    router.push({ pathname: '/stays/detail', params: { id, q: q || 'stays', checkIn: trip?.checkIn ?? checkIn, checkOut: trip?.checkOut ?? checkOut, adults: String(trip?.adults ?? adults) } });
  };
  const toggleFavorite = (s: Stay) =>
    toggle.mutate({ stay: { id: s.id, name: s.name, thumbnail: s.thumbnail, stars: s.stars, rating: s.rating, lat: s.lat, lng: s.lng }, on: !favoriteIds.has(s.id) });

  return (
    <Screen title={t('stays.title')} subtitle={t('stays.subtitle')}>
      <View>
        <Input
          label={t('stays.destination')}
          value={dest}
          placeholder={t('stays.destinationPlaceholder')}
          onChangeText={(v) => {
            setDest(v);
            setPicked(false);
          }}
        />
        {!picked && (suggest.data?.suggestions.length ?? 0) > 0 ? (
          <View className="mt-1 overflow-hidden rounded-card border border-line">
            {suggest.data!.suggestions.map((s) => (
              <Pressable
                key={`${s.text}-${s.propertyToken ?? ''}`}
                accessibilityRole="button"
                accessibilityLabel={s.location ? `${s.text}, ${s.location}` : s.text}
                onPress={() => {
                  setDest(s.text);
                  setPicked(true);
                }}
                className="border-b border-line px-gutter py-3"
              >
                <Text className="text-base text-ink">{s.text}</Text>
                {s.location ? <Text className="text-sm text-ink-muted">{s.location}</Text> : null}
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
      <Input label={t('stays.checkIn')} accessibilityLabel={t('stays.checkIn')} value={checkIn} onChangeText={setCheckIn} keyboardType="numbers-and-punctuation" />
      <Input label={t('stays.checkOut')} accessibilityLabel={t('stays.checkOut')} value={checkOut} onChangeText={setCheckOut} keyboardType="numbers-and-punctuation" />
      {!datesOk ? <Text className="text-danger">{t('stays.datesInvalid')}</Text> : null}
      <View className="flex-row items-center justify-between">
        <Text className="text-base text-ink">{t('stays.guests')}</Text>
        <View className="flex-row items-center gap-4">
          <Pressable accessibilityLabel={t('stays.fewerGuests')} accessibilityRole="button" disabled={adults <= 1} onPress={() => setAdults(adults - 1)} className="h-9 w-9 items-center justify-center rounded-full border border-line"><Text className="text-lg text-ink">−</Text></Pressable>
          <Text accessibilityLabel={t('stays.guestCount', { count: adults })} className="w-6 text-center text-lg font-semibold text-ink">{adults}</Text>
          <Pressable accessibilityLabel={t('stays.moreGuests')} accessibilityRole="button" disabled={adults >= 9} onPress={() => setAdults(adults + 1)} className="h-9 w-9 items-center justify-center rounded-full border border-line"><Text className="text-lg text-ink">+</Text></Pressable>
        </View>
      </View>
      <Button
        label={t('stays.search')}
        disabled={!canSearch}
        onPress={() => {
          setTrip({ q: dest.trim(), checkIn, checkOut, adults });
          setView('list');
          setSelectedId(undefined);
        }}
      />

      <View className="flex-row flex-wrap gap-2 pt-2">
        {(['list', 'map', 'saved'] as const).map((v) => (
          <Chip key={v} label={t(`stays.views.${v}`)} selected={view === v} onPress={() => setView(v)} />
        ))}
      </View>

      {view === 'saved' ? (
        <QueryState query={favorites}>
          {({ favorites: list }) =>
            list.length === 0 ? (
              <Text className="py-2 text-ink-muted">{t('stays.noSaved')}</Text>
            ) : (
              <View className="gap-3">
                {list.map((f) => (
                  <View key={f.id} className="flex-row items-center rounded-card border border-line bg-surface">
                    <Pressable accessibilityRole="button" accessibilityLabel={f.name} onPress={() => open(f.id)} className="flex-1 p-3">
                      <Text className="text-base font-semibold text-ink">{f.name}</Text>
                      {f.rating !== null ? <Text className="text-sm text-ink-muted">★ {f.rating.toFixed(1)}</Text> : null}
                    </Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel={t('stays.unsave', { name: f.name })} onPress={() => toggle.mutate({ stay: f, on: false })} className="p-3">
                      <Text className="text-brand">✕</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )
          }
        </QueryState>
      ) : trip === null ? null : (
        <QueryState query={search}>
          {({ stays }) => {
            if (stays.length === 0) return <Text className="py-2 text-ink-muted">{t('stays.none')}</Text>;
            const sorted = sortStays(stays, sort);
            const selected = stays.find((s) => s.id === selectedId);
            return (
              <View className="gap-3">
                <View className="flex-row flex-wrap gap-2">
                  {SORTS.map((s) => (
                    <Chip key={s} label={t(`stays.sort.${s}`)} selected={sort === s} onPress={() => setSort(s)} />
                  ))}
                </View>
                {view === 'map' ? <MapPlaceholder stays={sorted} selectedId={selectedId} onSelect={(s) => setSelectedId(s.id)} /> : null}
                {view === 'map' && selected ? (
                  <View className="gap-2 rounded-card border border-brand p-4" accessibilityLabel={t('stays.selected', { name: selected.name })}>
                    <Text className="text-lg font-semibold text-ink">{selected.name}</Text>
                    <Text className="text-ink-muted">{selected.amenities.join(' · ')}</Text>
                    <Button label={t('stays.viewDeal')} onPress={() => void WebBrowser.openBrowserAsync(selected.dealUrl)} />
                  </View>
                ) : null}
                {sorted.map((s) => (
                  <StayCard
                    key={s.id}
                    stay={s}
                    nights={tripNights}
                    selected={s.id === selectedId}
                    favorite={favoriteIds.has(s.id)}
                    onToggleFavorite={() => toggleFavorite(s)}
                    onPress={() => (view === 'map' ? setSelectedId(s.id) : open(s.id))}
                  />
                ))}
              </View>
            );
          }}
        </QueryState>
      )}
    </Screen>
  );
}
