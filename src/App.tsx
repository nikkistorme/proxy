import { useRef, useState, type ChangeEvent } from 'react';
import './App.css';
import { CardArt } from './components/CardArt';
import { ImportResults, type ImportSummary } from './components/ImportResults';
import { importCards } from './csv/importCards';
import type { CardDefinition } from './model/card';
import { mergeImport } from './model/mergeImport';

export function App() {
  const [definitions, setDefinitions] = useState<CardDefinition[]>([]);
  const [summary, setSummary] = useState<ImportSummary>();
  const chooseRef = useRef<HTMLButtonElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    // Clear the input so choosing the same file again still re-imports it.
    input.value = '';
    if (!file) return;

    const { cards, problems } = importCards(await file.text());
    const merged = mergeImport(definitions, cards, () => crypto.randomUUID());
    setDefinitions(merged.definitions);
    setSummary({
      fileName: file.name,
      cardCount: cards.length,
      added: merged.added.length,
      updated: merged.updated.length,
      missingNames: merged.definitions.filter((d) => d.missing).map((d) => d.front.name),
      problems,
    });
  }

  function closeResults() {
    setSummary(undefined);
    chooseRef.current?.focus();
  }

  return (
    <main className="app">
      <h1>Proxy</h1>

      {/* Temporary: stands in for the Start and setup screen until it's built. */}
      <section className="interim-import" aria-labelledby="import-heading">
        <h2 id="import-heading">Import a deck</h2>
        <p className="interim-import__note">
          Temporary panel for testing CSV import. Importing again updates the same deck.
        </p>
        <button ref={chooseRef} type="button" className="button button--primary" onClick={() => fileRef.current?.click()}>
          Choose CSV file
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          hidden
          data-testid="csv-file"
          onChange={(event) => void handleFile(event)}
        />
      </section>

      {definitions.length > 0 && (
        <section aria-labelledby="deck-heading">
          <h2 id="deck-heading">Deck ({definitions.length} cards)</h2>
          <ul className="card-grid">
            {definitions.map((definition) => (
              <li key={definition.id} className="card-grid__item">
                <div className="card-grid__frame">
                  <CardArt name={definition.front.name} image={definition.front.image} />
                </div>
                <span className="card-grid__name">
                  {definition.front.name}
                  {definition.back && <span className="card-grid__meta"> · double-faced</span>}
                  {definition.missing && <span className="card-grid__meta"> · missing from CSV</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ImportResults summary={summary} onClose={closeResults} />
    </main>
  );
}
