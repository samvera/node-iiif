import * as v2 from './v2';
import * as v3 from './v3';
import type { VersionModule } from './contracts';

export const Versions: Record<2 | 3, VersionModule> = {
  2: v2 as unknown as VersionModule,
  3: v3 as unknown as VersionModule
};

export default Versions;
