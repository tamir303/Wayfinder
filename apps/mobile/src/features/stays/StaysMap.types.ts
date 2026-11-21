import type { Stay } from '@wayfinder/shared';

export type StaysMapProps = {
  stays: Stay[];
  selectedId?: string | undefined;
  onSelect: (stay: Stay) => void;
  /** MapLibre style URL from the API (MapTiler). Null until a tile provider is configured. */
  styleUrl: string | null;
};
