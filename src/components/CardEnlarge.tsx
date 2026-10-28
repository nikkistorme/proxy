import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { SessionState } from '../model/session';
import { useLayoutFor } from '../layouts/LayoutsProvider';
import { CardFace } from './CardFace';
import { ENLARGE_GAP, enlargeSpot, type Box } from './enlargePlacement';
import './CardEnlarge.css';

/** The enlarged card's width, from the Main and TableDark boards. */
export const ENLARGE_WIDTH = 216;
/** The preview's padding and border, each side together, from `CardEnlarge.css`. */
const FRAME_PX = 11;
/** How long the flip takes, each half. */
const FLIP_HALF_MS = 140;

interface CardEnlargeProps {
  session: SessionState;
  cardId: string;
  /** Where the card is on screen. */
  anchor: Box;
  /** Opened by a key or the menu: focus moves in, and returns to the card when it closes. */
  takeFocus: boolean;
  /** `refocus` says whether focus should go back to the card. */
  onClose: (refocus: boolean) => void;
  /** A hover preview stays open while the pointer is over it, so its button can be pressed. */
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
}

function reducedMotion(): boolean {
  return typeof window.matchMedia !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * TT-9: one card at a readable size, the same at any table zoom. It's always
 * upright, however the card is turned on the table. A double-faced card shows one
 * face at a time, with a button that flips the preview (not the card) to the other.
 */
export function CardEnlarge({ session, cardId, anchor, takeFocus, onClose, onPointerEnter, onPointerLeave }: CardEnlargeProps) {
  const card = session.cards[cardId];
  const definition = card && session.definitions[card.definitionId];
  const back = definition?.back;
  // A face-down card opens on its front.
  const [side, setSide] = useState<'front' | 'back'>(card?.side === 'back' && back ? 'back' : 'front');
  const face = side === 'back' && back ? back : definition?.front;
  const layout = useLayoutFor(face ?? { name: '', fields: {} });
  const ref = useRef<HTMLDivElement>(null);
  const faceRef = useRef<HTMLDivElement>(null);
  const flipRef = useRef<HTMLButtonElement>(null);
  const [spot, setSpot] = useState<{ left: number; top: number }>();

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    setSpot(enlargeSpot(anchor, { width: element.offsetWidth, height: element.offsetHeight }, { width: window.innerWidth, height: window.innerHeight }));
  }, [anchor, layout.orientation]);

  // Focus moves in once it's placed: a hidden element can't take focus.
  const focused = useRef(false);
  useLayoutEffect(() => {
    if (!takeFocus || !spot || focused.current) return;
    focused.current = true;
    (flipRef.current ?? ref.current)?.focus();
  }, [takeFocus, spot]);

  // Escape or I closes it, and so does focus leaving it.
  // Native listeners, since the preview is a dialog, not a control.
  const latest = useRef({ takeFocus, onClose, onPointerEnter, onPointerLeave });
  useLayoutEffect(() => {
    latest.current = { takeFocus, onClose, onPointerEnter, onPointerLeave };
  });
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const letter = (event.key === 'i' || event.key === 'I') && !event.altKey && !event.ctrlKey && !event.metaKey;
      if (event.key !== 'Escape' && !letter) return;
      event.preventDefault();
      event.stopPropagation();
      latest.current.onClose(true);
    };
    const onFocusOut = (event: FocusEvent) => {
      const to = event.relatedTarget;
      if (latest.current.takeFocus && to instanceof Node && !element.contains(to)) latest.current.onClose(false);
    };
    const onEnter = () => latest.current.onPointerEnter?.();
    const onLeave = () => latest.current.onPointerLeave?.();
    element.addEventListener('keydown', onKeyDown);
    element.addEventListener('focusout', onFocusOut);
    element.addEventListener('pointerenter', onEnter);
    element.addEventListener('pointerleave', onLeave);
    return () => {
      element.removeEventListener('keydown', onKeyDown);
      element.removeEventListener('focusout', onFocusOut);
      element.removeEventListener('pointerenter', onEnter);
      element.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  if (!definition || !face) return null;
  const other = side === 'back' ? 'front' : 'back';

  function flip() {
    const element = faceRef.current;
    if (reducedMotion() || !element || typeof element.animate !== 'function') {
      setSide(other);
      return;
    }
    // Turn edge-on, swap the face, and turn back: a card flipping over.
    element
      .animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration: FLIP_HALF_MS, easing: 'ease-in' })
      .finished.then(() => {
        setSide(other);
        element.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: FLIP_HALF_MS, easing: 'ease-out' });
      })
      .catch(() => setSide(other));
  }

  // A landscape layout shows upright, so the preview turns on its side; on a narrow phone it shrinks to fit.
  const landscape = layout.orientation === 'landscape';
  const width = landscape ? Math.min(ENLARGE_WIDTH, Math.floor(((window.innerWidth - 2 * ENLARGE_GAP - 2 * FRAME_PX) * 240) / 336)) : ENLARGE_WIDTH;
  const shown = landscape ? Math.round((width * 336) / 240) : width;
  const style = { left: spot?.left ?? 0, top: spot?.top ?? 0, visibility: spot ? 'visible' : 'hidden' } as CSSProperties;
  return (
    <div ref={ref} role="dialog" aria-label={`Enlarged: ${face.name}`} className="card-enlarge" style={style} tabIndex={-1}>
      <div ref={faceRef} className="card-enlarge__face">
        <CardFace face={face} width={width} layout={layout} upright />
      </div>
      <div className="card-enlarge__footer" style={{ maxWidth: shown }}>
        <span>{[face.name, face.type].filter(Boolean).join(' · ')}</span>
        <span aria-hidden="true">
          <kbd>I</kbd> close
        </span>
      </div>
      {back && (
        <button ref={flipRef} type="button" className="button card-enlarge__flip" onClick={flip}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 12a8 8 0 0 1 14-5.3M20 4v4h-4M20 12a8 8 0 0 1-14 5.3M4 20v-4h4" />
          </svg>
          {other === 'back' ? 'Show back' : 'Show front'}
        </button>
      )}
    </div>
  );
}
