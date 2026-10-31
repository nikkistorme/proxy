import { readLayoutFile } from '../model/layoutFile';
import emberguard from './emberguard.csv?raw';
import harbourBoard from './harbour-board.csv?raw';
import layoutsText from './layouts.json?raw';
import theFog from './the-fog.csv?raw';
import tidewardens from './tidewardens.csv?raw';

/** One demo deck: where it goes in Co-op PvE, the card set it saves as, and its CSV (DM-5). */
export interface DemoPile {
  pileId: string;
  fileName: string;
  /** Fixed, so loading the demo again replaces the card set instead of adding one. */
  cardSetId: string;
  /** SP-3: the three decks shuffle, the board keeps file order. */
  keepOrder: boolean;
  csv: string;
}

/**
 * DM-5: the demo game's piles and layouts. Only reached by a dynamic `import()`
 * from the Load demo button, so none of it is in the first JavaScript (PF-3).
 */
export const DEMO_PILES: readonly DemoPile[] = [
  { pileId: 'pile-p1-main', fileName: 'emberguard.csv', cardSetId: 'demo-emberguard', keepOrder: false, csv: emberguard },
  { pileId: 'pile-p2-main', fileName: 'tidewardens.csv', cardSetId: 'demo-tidewardens', keepOrder: false, csv: tidewardens },
  { pileId: 'pile-env', fileName: 'the-fog.csv', cardSetId: 'demo-the-fog', keepOrder: false, csv: theFog },
  { pileId: 'pile-board', fileName: 'harbour-board.csv', cardSetId: 'demo-harbour-board', keepOrder: true, csv: harbourBoard },
];

const read = readLayoutFile(layoutsText);
if ('error' in read) throw new Error(`Demo layouts are invalid: ${read.error}`);

export const DEMO_LAYOUTS = read.layouts;
