// Every option is read through this one resolver (AR-7): the session's value,
// then the game's, then the account's, then the built-in default. V1 has only
// the account level, saved as the profile's settings item.

import { SOLO_PVE } from '../model/format';
import type { ThemePreference } from '../theme';

export interface Options {
  theme: ThemePreference;
  /** A card type, lowercased, to the id of the layout its cards use when their `layout` column is blank (LY-8). */
  layoutByType: Record<string, string>;
  /** The id of the layout used when nothing else picks one; `null` is the built-in layout (LY-8). */
  defaultLayout: string | null;
  /** The id of the format a new session starts from, chosen in New session… (FS-1, SP-1). */
  defaultFormat: string;
}

export type OptionName = keyof Options;

export const DEFAULT_OPTIONS: Options = {
  theme: 'system',
  layoutByType: {},
  defaultLayout: null,
  defaultFormat: SOLO_PVE.id,
};

export interface OptionLevels {
  session?: Partial<Options>;
  game?: Partial<Options>;
  account?: Partial<Options>;
}

export function resolveOption<K extends OptionName>(name: K, levels: OptionLevels): Options[K] {
  for (const level of [levels.session, levels.game, levels.account]) {
    const value = level?.[name];
    if (value !== undefined) return value as Options[K];
  }
  return DEFAULT_OPTIONS[name];
}
