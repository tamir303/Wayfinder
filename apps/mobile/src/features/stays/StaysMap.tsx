import { StaysMapPlaceholder } from './StaysMapPlaceholder';
import type { StaysMapProps } from './StaysMap.types';

// Native: placeholder for now. A MapLibre native map needs a dev-client build to verify (see StaysMap.web.tsx
// for the web implementation, which has the same props).
export const StaysMap = ({ stays, selectedId, onSelect }: StaysMapProps) => <StaysMapPlaceholder stays={stays} selectedId={selectedId} onSelect={onSelect} />;
