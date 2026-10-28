import { useId, useRef, useState, type ChangeEvent } from 'react';
import type { LayoutItem } from '../layouts/LayoutsProvider';
import { LAYOUT_FILE_NAME, layoutsToFile, mergeImportedLayouts, readLayoutFile } from '../model/layoutFile';

interface LayoutFilesProps {
  /** The saved layouts, in list order. */
  layouts: readonly LayoutItem[];
  /** Saves one imported layout. */
  onImport: (layout: LayoutItem) => void;
  announce: (text: string) => void;
}

const count = (n: number) => `${n} ${n === 1 ? 'layout' : 'layouts'}`;

/** Exporting layouts to a JSON file and importing them from one (LY-9), below the layout list. */
export function LayoutFiles({ layouts, onImport, announce }: LayoutFilesProps) {
  const headingId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  /** What the last export or import did, shown under the buttons as well as announced. */
  const [result, setResult] = useState<{ text: string; error?: boolean }>();

  function report(text: string, error?: boolean) {
    setResult({ text, error });
    announce(text);
  }

  function exportLayouts() {
    const url = URL.createObjectURL(new Blob([layoutsToFile(layouts)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = LAYOUT_FILE_NAME;
    link.click();
    // Firefox needs the URL a moment after the click.
    setTimeout(() => URL.revokeObjectURL(url), 0);
    report(`Exported ${count(layouts.length)} to ${LAYOUT_FILE_NAME}.`);
  }

  async function importLayouts(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    // Cleared so choosing the same file again still imports it.
    input.value = '';
    if (!file) return;
    const read = readLayoutFile(await file.text());
    if ('error' in read) {
      report(`Couldn't import ${file.name}. ${read.error}`, true);
      return;
    }
    const imported = mergeImportedLayouts(layouts, read.layouts);
    imported.forEach(onImport);
    const renamed = imported.flatMap((layout, i) => (layout.name === read.layouts[i]?.name ? [] : [`${read.layouts[i]?.name} to ${layout.name}`]));
    const names = renamed.length > 0 ? ` Names already in use were changed: ${renamed.join(', ')}.` : '';
    report(`Imported ${count(imported.length)} from ${file.name}.${names}`);
  }

  return (
    <section className="layout-files" aria-labelledby={headingId}>
      <h3 id={headingId} className="layout-choices__title">
        Layout files
      </h3>
      <p className="layout-choices__intro">
        Export saves your layouts to a file, to keep or share. Importing a file adds its layouts, and replaces any that came from the same layout.
      </p>
      <div className="layout-files__actions">
        <button type="button" className="button" disabled={layouts.length === 0} onClick={exportLayouts}>
          Export layouts
        </button>
        <button type="button" className="button" onClick={() => fileRef.current?.click()}>
          Import layouts…
        </button>
        <input ref={fileRef} type="file" accept=".json,application/json" hidden data-testid="layout-file" onChange={(event) => void importLayouts(event)} />
      </div>
      {result && <p className={result.error ? 'form-error layout-files__result' : 'layout-files__result'}>{result.text}</p>}
    </section>
  );
}
