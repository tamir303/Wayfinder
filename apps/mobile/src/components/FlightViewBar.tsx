import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import type { FlightSort, FlightViewOptions } from '../features/travel/flight-view';
import { Chip } from './Chip';

const SORTS: FlightSort[] = ['best', 'cheapest', 'fastest'];

type Props = { value: FlightViewOptions; onChange: (next: FlightViewOptions) => void; /** Airlines present in the results. */ airlines: string[] };

export const FlightViewBar = ({ value, onChange, airlines }: Props) => {
  const { t } = useTranslation();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
      {SORTS.map((s) => (
        <Chip key={s} label={t(`flights.sort.${s}`)} selected={value.sort === s} onPress={() => onChange({ ...value, sort: s })} />
      ))}
      <Chip label={t('flights.sort.directOnly')} selected={value.directOnly} onPress={() => onChange({ ...value, directOnly: !value.directOnly })} />
      {airlines.map((a) => {
        const on = value.airlines.includes(a);
        return <Chip key={a} label={a} selected={on} onPress={() => onChange({ ...value, airlines: on ? value.airlines.filter((x) => x !== a) : [...value.airlines, a] })} />;
      })}
    </ScrollView>
  );
};
