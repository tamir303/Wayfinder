import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import type { FlightSort, FlightViewOptions } from '../features/travel/flight-view';
import { Chip } from './Chip';

const SORTS: FlightSort[] = ['best', 'cheapest', 'fastest'];

type Props = { value: FlightViewOptions; onChange: (next: FlightViewOptions) => void };

export const FlightViewBar = ({ value, onChange }: Props) => {
  const { t } = useTranslation();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
      {SORTS.map((s) => (
        <Chip key={s} label={t(`flights.sort.${s}`)} selected={value.sort === s} onPress={() => onChange({ ...value, sort: s })} />
      ))}
      <Chip label={t('flights.sort.directOnly')} selected={value.directOnly} onPress={() => onChange({ ...value, directOnly: !value.directOnly })} />
    </ScrollView>
  );
};
