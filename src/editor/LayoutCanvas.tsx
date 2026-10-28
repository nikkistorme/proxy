import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react';
import { CardFace } from '../components/CardFace';
import type { LayoutItem } from '../layouts/LayoutsProvider';
import { contrastWarning, describeRatio } from '../model/contrast';
import { boxValue, MIN_TEXT_PT, type LayoutBox, type LayoutOrientation, type TextFit } from '../model/layout';
import {
  addedBoxRect,
  BOX_STEP,
  describeBoxContent,
  describeBoxPlace,
  describeBoxSize,
  isDrawn,
  moveBox,
  newBox,
  rectFromPoints,
  resizeBox,
  resizeFromCorner,
  sampleFace,
  type BoxRect,
  type Corner,
  type Point,
} from '../model/layoutBoxes';
import { BoxProperties } from './BoxProperties';

const CORNERS: Corner[] = ['nw', 'ne', 'sw', 'se'];
/** Pointer travel, in CSS px, before pressing on a box counts as dragging it. */
const DRAG_THRESHOLD = 3;
/** Used before the stage is measured, and where it can't be (tests). */
const FALLBACK_WIDTH = 240;

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-BOX_STEP, 0],
  ArrowRight: [BOX_STEP, 0],
  ArrowUp: [0, -BOX_STEP],
  ArrowDown: [0, BOX_STEP],
};

type Drag =
  | { kind: 'draw'; start: Point }
  | {
      kind: 'move' | 'resize';
      box: LayoutBox;
      corner?: Corner;
      client: Point;
      moved: boolean;
    };

const boxName = (index: number) => `Box ${index + 1}`;

/** What's wrong with a box: short, for its name on the canvas, and long, for the properties panel (LY-4, A11Y-9). */
interface BoxWarnings {
  short: string[];
  long: string[];
}

/** The stage's size, so the card can fill it at the card's own proportions. */
function useStageSize(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const measure = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

interface LayoutCanvasProps {
  layout: LayoutItem;
  /** Called with the changed layout on every edit, to save it. */
  onChange: (layout: LayoutItem) => void;
  /** Back to the list. */
  onBack: () => void;
  announce: (text: string) => void;
  /** Column names from the loaded cards, suggested for column boxes. */
  columns?: readonly string[];
}

const NO_COLUMNS: readonly string[] = [];

/**
 * The layout editor's canvas (LY-2): the card drawn from the layout, with each
 * box as a button over it. Boxes are added by button or drawn by pointer, and
 * moved and resized by pointer or with the arrow keys (Shift resizes).
 */
export function LayoutCanvas({ layout, onChange, onBack, announce, columns = NO_COLUMNS }: LayoutCanvasProps) {
  const headingId = useId();
  const hintId = useId();
  const stageRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const [selectedId, setSelectedId] = useState<string>();
  const [draft, setDraft] = useState<BoxRect>();
  const drag = useRef<Drag>(undefined);
  /** The box button, or Add box, to focus once the canvas has rendered. */
  const pendingFocus = useRef<string>(undefined);
  /** The latest layout, for pointer moves between renders. */
  const latest = useRef(layout);
  useLayoutEffect(() => {
    latest.current = layout;
  });

  const landscape = layout.orientation === 'landscape';
  const stage = useStageSize(stageRef);
  // The canvas fills the stage at the card's proportions: 240 × 336, or turned for landscape.
  const aspect = landscape ? 336 / 240 : 240 / 336;
  const shown =
    stage.width && stage.height ? Math.floor(Math.min(stage.width, stage.height * aspect)) : landscape ? (FALLBACK_WIDTH * 336) / 240 : FALLBACK_WIDTH;
  const cardWidth = landscape ? Math.round((shown * 240) / 336) : shown;

  const selectedIndex = layout.boxes.findIndex((box) => box.id === selectedId);
  const selected = layout.boxes[selectedIndex];
  const face = useMemo(() => sampleFace(layout.boxes), [layout.boxes]);
  /** Boxes whose text still overflows at the smallest size, as the card reports them. */
  const [clipped, setClipped] = useState<Record<string, boolean>>({});
  const onFit = useCallback((id: string, fit: TextFit) => {
    setClipped((current) => (current[id] === fit.clipped ? current : { ...current, [id]: fit.clipped }));
  }, []);

  function warningsFor(box: LayoutBox, index: number): BoxWarnings {
    const warnings: BoxWarnings = { short: [], long: [] };
    // A box that draws no text reports no new fit and has no text to read, so it has no warnings.
    if (box.content.kind === 'color' || !boxValue(face, box.content)) return warnings;
    if (clipped[box.id]) {
      warnings.short.push('text clipped');
      warnings.long.push(`Text is clipped: it doesn't fit even at ${MIN_TEXT_PT} pt. Make the box bigger or the text smaller.`);
    }
    const contrast = contrastWarning(layout.boxes, index);
    if (contrast) {
      warnings.short.push(`low contrast ${describeRatio(contrast.ratio)}`);
      warnings.long.push(`Low contrast: ${describeRatio(contrast.ratio)} against the background. Text this size needs at least ${contrast.minimum} to 1.`);
    }
    return warnings;
  }

  useEffect(() => {
    addRef.current?.focus();
  }, []);

  // Runs after every render, so it finds boxes that have just appeared.
  useEffect(() => {
    const id = pendingFocus.current;
    if (!id) return;
    pendingFocus.current = undefined;
    if (id === 'add') addRef.current?.focus();
    else overlayRef.current?.querySelector<HTMLElement>(`[data-box-id="${id}"] button`)?.focus();
  });

  function setBoxes(boxes: LayoutBox[]) {
    onChange({ ...latest.current, boxes });
  }

  function updateBox(box: LayoutBox) {
    setBoxes(latest.current.boxes.map((current) => (current.id === box.id ? box : current)));
  }

  function insert(rect: BoxRect) {
    const box = newBox(rect);
    setBoxes([...latest.current.boxes, box]);
    setSelectedId(box.id);
    pendingFocus.current = box.id;
    announce(`Added ${boxName(latest.current.boxes.length)}, ${describeBoxPlace(box)}, ${describeBoxSize(box)}.`);
  }

  function remove(id: string) {
    const boxes = latest.current.boxes;
    const index = boxes.findIndex((box) => box.id === id);
    if (index < 0) return;
    const rest = boxes.filter((box) => box.id !== id);
    setBoxes(rest);
    // Focus goes to the box that took its place, else the one before, else Add box.
    const next = rest[index] ?? rest[index - 1];
    setSelectedId(next?.id);
    pendingFocus.current = next?.id ?? 'add';
    announce(`Deleted ${boxName(index)}.`);
  }

  function setOrientation(orientation: LayoutOrientation) {
    onChange({ ...latest.current, orientation });
    announce(orientation === 'landscape' ? 'Landscape.' : 'Portrait.');
  }

  function onBoxKeyDown(event: KeyboardEvent, box: LayoutBox, index: number) {
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      remove(box.id);
      return;
    }
    const step = ARROWS[event.key];
    if (!step || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    if (event.shiftKey) {
      const resized = resizeBox(box, ...step);
      updateBox(resized);
      announce(`${boxName(index)} ${describeBoxSize(resized)}.`);
    } else {
      const moved = moveBox(box, ...step);
      updateBox(moved);
      announce(`${boxName(index)} ${describeBoxPlace(moved)}.`);
    }
  }

  /** A pointer's place on the card, in percent. */
  function toCard(event: PointerEvent): Point {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height) return { x: 0, y: 0 };
    return {
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    };
  }

  function startDrag(event: PointerEvent, next: Drag) {
    if (event.button !== 0) return;
    event.preventDefault();
    overlayRef.current?.setPointerCapture?.(event.pointerId);
    drag.current = next;
  }

  function onOverlayPointerDown(event: PointerEvent) {
    if (event.target !== overlayRef.current) return;
    setSelectedId(undefined);
    startDrag(event, { kind: 'draw', start: toCard(event) });
  }

  function onBoxPointerDown(event: PointerEvent, box: LayoutBox, corner?: Corner) {
    event.stopPropagation();
    setSelectedId(box.id);
    // Safari doesn't focus buttons on click; focus keeps the keyboard on the box just picked.
    overlayRef.current?.querySelector<HTMLElement>(`[data-box-id="${box.id}"] button`)?.focus();
    startDrag(event, {
      kind: corner ? 'resize' : 'move',
      box,
      corner,
      client: { x: event.clientX, y: event.clientY },
      moved: false,
    });
  }

  function onPointerMove(event: PointerEvent) {
    const current = drag.current;
    if (!current) return;
    if (current.kind === 'draw') {
      const point = toCard(event);
      setDraft(isDrawn(current.start, point) ? rectFromPoints(current.start, point) : undefined);
      return;
    }
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect?.width || !rect.height) return;
    const px = {
      x: event.clientX - current.client.x,
      y: event.clientY - current.client.y,
    };
    if (!current.moved && Math.hypot(px.x, px.y) < DRAG_THRESHOLD) return;
    current.moved = true;
    const dx = (px.x / rect.width) * 100;
    const dy = (px.y / rect.height) * 100;
    updateBox(current.kind === 'move' ? moveBox(current.box, dx, dy) : resizeFromCorner(current.box, current.corner ?? 'se', dx, dy));
  }

  function onPointerUp(event: PointerEvent) {
    const current = drag.current;
    drag.current = undefined;
    if (!current) return;
    if (current.kind === 'draw') {
      const end = toCard(event);
      setDraft(undefined);
      if (isDrawn(current.start, end)) insert(rectFromPoints(current.start, end));
      return;
    }
    if (!current.moved) return;
    const index = latest.current.boxes.findIndex((box) => box.id === current.box.id);
    const box = latest.current.boxes[index];
    if (!box) return;
    announce(current.kind === 'move' ? `${boxName(index)} ${describeBoxPlace(box)}.` : `${boxName(index)} ${describeBoxSize(box)}.`);
  }

  function onPointerCancel() {
    drag.current = undefined;
    setDraft(undefined);
  }

  return (
    <section className="layout-canvas" aria-labelledby={headingId}>
      <div className="layout-canvas__bar">
        <button type="button" className="button layout-editor__back" onClick={onBack}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M15 6l-6 6 6 6" />
          </svg>
          Back to layouts
        </button>
        <h3 id={headingId} className="layout-canvas__title">
          {layout.name}
        </h3>
      </div>

      <div className="layout-canvas__tools">
        <fieldset className="layout-canvas__orientation">
          <legend className="visually-hidden">Orientation</legend>
          {(['portrait', 'landscape'] as const).map((value) => (
            <label key={value} className="layout-canvas__option">
              <input
                type="radio"
                name={`${headingId}-orientation`}
                value={value}
                checked={layout.orientation === value}
                onChange={() => setOrientation(value)}
              />
              {value === 'portrait' ? 'Portrait' : 'Landscape'}
            </label>
          ))}
        </fieldset>
        <button ref={addRef} type="button" className="button button--primary layout-canvas__add" onClick={() => insert(addedBoxRect(latest.current.boxes))}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add box
        </button>
        {/* Always there, so choosing a box doesn't reflow the tools and resize the card. */}
        <button type="button" className="button layout-canvas__delete" aria-disabled={!selected} onClick={() => selected && remove(selected.id)}>
          {selected ? `Delete ${boxName(selectedIndex)}` : 'Delete box'}
        </button>
      </div>

      <p id={hintId} className="layout-canvas__hint">
        Drag on the card to draw a box. Arrow keys move the chosen box, Shift + arrow keys resize it, and Delete removes it.
      </p>

      <div className="layout-canvas__work">
        <div ref={stageRef} className="layout-canvas__stage">
          <div className="layout-canvas__card" style={{ width: shown }}>
            {/* The boxes over the card name themselves; a sample card's text says nothing more. */}
            <div aria-hidden="true">
              <CardFace face={face} layout={layout} width={cardWidth} upright onFit={onFit} />
            </div>
            <div
              ref={overlayRef}
              className="layout-canvas__boxes"
              role="group"
              aria-label={`Boxes on ${layout.name}`}
              onPointerDown={onOverlayPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerCancel}
            >
              {layout.boxes.map((box, index) => {
                const warnings = warningsFor(box, index);
                return (
                  <div
                    key={box.id}
                    data-box-id={box.id}
                    className={`layout-canvas__box${box.id === selectedId ? ' layout-canvas__box--selected' : ''}`}
                    style={{
                      left: `${box.x}%`,
                      top: `${box.y}%`,
                      width: `${box.width}%`,
                      height: `${box.height}%`,
                    }}
                  >
                    <button
                      type="button"
                      className="layout-canvas__box-button"
                      aria-label={[boxName(index), describeBoxContent(box.content), describeBoxPlace(box), describeBoxSize(box), ...warnings.short].join(', ')}
                      aria-describedby={hintId}
                      onFocus={() => setSelectedId(box.id)}
                      onKeyDown={(event) => onBoxKeyDown(event, box, index)}
                      onPointerDown={(event) => onBoxPointerDown(event, box)}
                    >
                      <span className="layout-canvas__box-number" aria-hidden="true">
                        {index + 1}
                      </span>
                      {warnings.short.length > 0 && (
                        <span className="layout-canvas__box-warning" aria-hidden="true">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round">
                            <path d="M12 3l10 18H2z" />
                            <path d="M12 10v4M12 17.5v.5" strokeLinecap="round" />
                          </svg>
                        </span>
                      )}
                    </button>
                    {box.id === selectedId &&
                      CORNERS.map((corner) => (
                        <span
                          key={corner}
                          className={`layout-canvas__handle layout-canvas__handle--${corner}`}
                          data-corner={corner}
                          aria-hidden="true"
                          onPointerDown={(event) => onBoxPointerDown(event, box, corner)}
                        />
                      ))}
                  </div>
                );
              })}
              {draft && (
                <div
                  className="layout-canvas__draft"
                  aria-hidden="true"
                  style={{
                    left: `${draft.x}%`,
                    top: `${draft.y}%`,
                    width: `${draft.width}%`,
                    height: `${draft.height}%`,
                  }}
                />
              )}
            </div>
          </div>
        </div>
        <BoxProperties
          box={selected}
          name={selected && boxName(selectedIndex)}
          columns={columns}
          warnings={selected && warningsFor(selected, selectedIndex).long}
          onChange={updateBox}
        />
      </div>
    </section>
  );
}
