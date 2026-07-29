import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { BackupImportResult, ImportSummary, LetterboxdItem } from '@cinelog/contracts';
import { api, ApiError } from '../lib/api';
import { parseCsv } from '../lib/csv';
import { parseLetterboxdZip, type ParsedExport } from '../lib/letterboxdZip';
import { Button, Card, Spinner } from '../components/ui';

const MAX = 2000;

export function ImportPage(): JSX.Element {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <p className="mb-2 font-cond text-xs font-bold uppercase tracking-[0.2em] text-gold">
        Import &amp; backup
      </p>
      <h1 className="font-cond text-3xl font-extrabold uppercase tracking-tight">
        Your data
      </h1>

      <LetterboxdImportCard />
      <BackupCard />
    </div>
  );
}

// -------------------------------------------------------------------------
// Cinelog backup — export/import the user's full library as JSON.
// -------------------------------------------------------------------------

function BackupCard(): JSX.Element {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BackupImportResult | null>(null);

  async function onExport(): Promise<void> {
    setError(null);
    setExporting(true);
    try {
      const data = await api.exportBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cinelog-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Export failed.');
    } finally {
      setExporting(false);
    }
  }

  async function onImportFile(file: File): Promise<void> {
    setError(null);
    setResult(null);
    setImporting(true);
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const res = await api.importBackup(parsed as never);
      setResult(res);
      void queryClient.invalidateQueries({ queryKey: ['library'] });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof SyntaxError
            ? 'That file isn’t valid JSON.'
            : 'Import failed.',
      );
    } finally {
      setImporting(false);
    }
  }

  return (
    <Card className="mt-6 p-6">
      <div className="mb-1 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-gold" />
        <h2 className="font-cond text-[15px] font-extrabold uppercase tracking-[0.08em] text-content">
          Backup &amp; restore
        </h2>
      </div>
      <p className="text-sm text-muted">
        Download everything you’ve tracked — statuses, ratings, watch history, episode ratings, and
        artwork picks — as a single JSON file. Import it to restore onto this or another account
        (it merges, never wipes).
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="primary" disabled={exporting} onClick={() => void onExport()}>
          {exporting ? 'Exporting…' : '↓ Export backup'}
        </Button>
        <Button variant="secondary" disabled={importing} onClick={() => inputRef.current?.click()}>
          {importing ? 'Restoring…' : '↑ Import backup'}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onImportFile(f);
            e.target.value = '';
          }}
        />
      </div>

      {importing && (
        <p className="mt-3 text-xs text-muted-2">
          Restoring — titles not already cached are re-fetched from TMDB, so a large library can take
          a moment.
        </p>
      )}

      {error && (
        <p className="mt-3 rounded-lg border border-rose/30 bg-rose/10 px-3 py-2 text-sm text-rose">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-4 rounded-xl border border-border bg-surface-2/50 p-4 text-sm">
          <p>
            <span className="font-cond text-lg font-extrabold text-gold">{result.itemsImported}</span>{' '}
            of {result.itemsProcessed} titles restored · {result.ratingsImported} ratings ·{' '}
            {result.watchEventsImported} watches · {result.episodeRatingsImported} episode ratings.
          </p>
          {result.failures.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-muted-2 hover:text-content">
                {result.failed} couldn’t be restored
              </summary>
              <ul className="mt-2 max-h-40 overflow-y-auto text-xs text-muted">
                {result.failures.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </Card>
  );
}

// -------------------------------------------------------------------------
// Letterboxd import — takes the whole export archive.
// -------------------------------------------------------------------------

function LetterboxdImportCard(): JSX.Element {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedExport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  /**
   * Takes the whole export. A .zip is unzipped and merged in the browser; a
   * bare .csv still works for anyone who only kept one file, and is routed by
   * filename so a watchlist doesn't get imported as watched history.
   */
  async function onFile(file: File): Promise<void> {
    setError(null);
    setSummary(null);
    setFileName(file.name);
    try {
      if (file.name.toLowerCase().endsWith('.zip')) {
        const result = parseLetterboxdZip(new Uint8Array(await file.arrayBuffer()));
        if (result.items.length === 0 && result.watchlistItems.length === 0) {
          setError(
            "That archive didn't contain any of the files this reads — expected ratings.csv, diary.csv, watched.csv, watchlist.csv, reviews.csv, or likes/films.csv.",
          );
          setParsed(null);
          return;
        }
        setParsed(result);
        return;
      }

      // Single-CSV fallback.
      const rows = parseCsv(await file.text());
      const header = (rows[0] ?? []).map((h) => h.trim().toLowerCase());
      const col = (name: string): number => header.indexOf(name);
      if (col('name') < 0) {
        setError('This doesn\u2019t look like a Letterboxd export \u2014 no "Name" column found.');
        setParsed(null);
        return;
      }
      const dateIdx = col('watched date') >= 0 ? col('watched date') : col('date');
      const rows2 = rows
        .slice(1)
        .filter((r) => r[col('name')]?.trim())
        .map<LetterboxdItem>((r) => ({
          name: r[col('name')]!.trim(),
          year: col('year') >= 0 && r[col('year')] ? Number.parseInt(r[col('year')]!, 10) || null : null,
          rating:
            col('rating') >= 0 && r[col('rating')]
              ? Number.parseFloat(r[col('rating')]!) || null
              : null,
          watchedDate: dateIdx >= 0 && r[dateIdx]?.trim() ? r[dateIdx]!.trim() : null,
          liked: false,
          review: col('review') >= 0 ? r[col('review')]?.trim() || null : null,
          isRewatch: (r[col('rewatch')] ?? '').toLowerCase() === 'yes',
          isSpoiler: false,
        }));
      const isWatchlist = file.name.toLowerCase().includes('watchlist');
      setParsed({
        items: isWatchlist ? [] : rows2,
        watchlistItems: isWatchlist ? rows2 : [],
        filesFound: [file.name],
        filesSkipped: [],
      });
    } catch {
      setError('Could not read that file.');
      setParsed(null);
    }
  }

  const total = (parsed?.items.length ?? 0) + (parsed?.watchlistItems.length ?? 0);
  const overLimit = total > MAX;

  async function doImport(): Promise<void> {
    if (!parsed) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.importLetterboxd({
        mode: 'watched',
        items: parsed.items.slice(0, MAX),
        watchlistItems: parsed.watchlistItems.slice(0, MAX),
      });
      setSummary(result);
      void queryClient.invalidateQueries({ queryKey: ['library'] });
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
      void queryClient.invalidateQueries({ queryKey: ['activity'] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mt-6 p-6">
      <h2 className="mb-1 font-cond text-[15px] font-extrabold uppercase tracking-[0.08em] text-content">
        Import from Letterboxd
      </h2>
      <p className="text-sm leading-relaxed text-muted">
        On Letterboxd, go to <span className="text-content">Settings &rarr; Import &amp; Export &rarr;
        Export your data</span> and drop the <code className="font-data text-cyan">.zip</code> here as
        it downloaded &mdash; no unzipping, no picking files. It reads your ratings, diary dates,
        rewatches, likes, reviews, and watchlist, and merges them into one entry per title.
      </p>

      <button
        onClick={() => inputRef.current?.click()}
        className="mt-4 flex w-full flex-col items-center justify-center gap-2 rounded-sm border border-dashed border-border-hi bg-surface-2/40 px-6 py-10 text-center hover:border-gold"
      >
        <span className="font-cond text-2xl font-extrabold text-muted">+</span>
        <span className="text-sm text-content">
          {fileName ?? 'Choose your Letterboxd export (.zip)'}
        </span>
        {parsed && (
          <span className="font-data text-[11px] text-muted-2">
            {parsed.items.length} watched &middot; {parsed.watchlistItems.length} watchlist
          </span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".zip,.csv,application/zip,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
          e.target.value = '';
        }}
      />

      {parsed && total > 0 && (
        <>
          {parsed.filesFound.length > 0 && (
            <p className="mt-4 font-data text-[11px] leading-relaxed text-muted-2">
              read: {parsed.filesFound.join('  ')}
            </p>
          )}
          {parsed.filesSkipped.length > 0 && (
            <p className="mt-1 font-data text-[11px] leading-relaxed text-muted-2">
              not imported: {parsed.filesSkipped.join('  ')}
            </p>
          )}
          {overLimit && (
            <p className="mt-3 rounded-sm border border-gold/40 bg-gold/10 px-3 py-2 text-sm text-gold">
              That export has {total} titles; only the first {MAX} of each set will be imported.
            </p>
          )}

          <Button
            variant="primary"
            size="lg"
            className="mt-5 w-full"
            disabled={busy}
            onClick={() => void doImport()}
          >
            {busy ? (
              <>
                <Spinner className="h-4 w-4" /> Importing&hellip;
              </>
            ) : (
              `Import ${Math.min(total, MAX * 2)} titles`
            )}
          </Button>
          {busy && (
            <p className="mt-2 text-center text-xs text-muted-2">
              Matching each title against TMDB &mdash; a large library takes a few minutes.
            </p>
          )}
        </>
      )}

      {error && (
        <p className="mt-4 rounded-sm border border-rose/30 bg-rose/10 px-3 py-2 text-sm text-rose">
          {error}
        </p>
      )}

      {summary && (
        <div className="mt-5 rounded-sm border border-border bg-surface-2/50 p-4">
          <p className="text-sm">
            <span className="font-data text-lg font-bold text-gold">{summary.imported}</span> of{' '}
            {summary.total} titles imported
            {summary.failed > 0 && (
              <span className="text-muted-2"> &middot; {summary.failed} not matched</span>
            )}
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
            {[
              ['Ratings', summary.ratingsImported],
              ['Diary entries', summary.diaryEntriesImported],
              ['Likes', summary.likesImported],
              ['Reviews', summary.reviewsImported],
              ['Watchlist', summary.watchlistImported],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex items-baseline gap-2">
                <dt className="text-muted">{label}</dt>
                <span
                  aria-hidden="true"
                  className="min-w-2 flex-1 border-b border-dotted border-border"
                />
                <dd className="font-data font-bold text-content">{value}</dd>
              </div>
            ))}
          </dl>
          {summary.failures.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-muted-2 hover:text-content">
                Show titles we couldn&rsquo;t match
              </summary>
              <ul className="mt-2 max-h-40 overflow-y-auto font-data text-[11px] text-muted">
                {summary.failures.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </Card>
  );
}
