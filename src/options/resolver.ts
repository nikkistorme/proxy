// Every option is read through this one resolver (AR-7): the session's value,
// then the game's, then the account's, then the built-in default. V1 has only
// the account level, saved as the profile's settings item.

import type { ThemePreference } from '../theme';

export interface Options {
  theme: ThemePreference;
}

export type OptionName = keyof Options;

export const DEFAULT_OPTIONS: Options = {
  theme: 'system',
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
