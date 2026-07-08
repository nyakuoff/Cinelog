import { useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  BackupImportResult,
  ImportMode,
  ImportSummary,
  LetterboxdItem,
} from '@cinelog/contracts';
import { api, ApiError } from '../lib/api';
import { parseCsv } from '../lib/csv';
import { cn } from '../lib/cn';
import { Button, Card, Input, Spinner } from '../components/ui';

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

      <BackupCard />
      <LetterboxdSyncCard />
      <CsvImportCard />
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
// Live sync — pulls the connected account's public diary RSS on request.
// -------------------------------------------------------------------------

function LetterboxdSyncCard(): JSX.Element {
  const queryClient = useQueryClient();
  const [username, setUsername] = useState('');

  const { data: status, isLoading } = useQuery({
    queryKey: ['letterboxd-status'],
    queryFn: () => api.getLetterboxdStatus(),
  });

  const invalidateStatus = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['letterboxd-status'] });
  };

  const connectMut = useMutation({
    mutationFn: () => api.connectLetterboxd({ username }),
    onSuccess: () => {
      setUsername('');
      invalidateStatus();
    },
  });
  const disconnectMut = useMutation({
    mutationFn: () => api.disconnectLetterboxd(),
    onSuccess: invalidateStatus,
  });
  const syncMut = useMutation({
    mutationFn: () => api.syncLetterboxdNow(),
    onSuccess: () => {
      invalidateStatus();
      void queryClient.invalidateQueries({ queryKey: ['library'] });
    },
  });

  function onConnect(e: FormEvent): void {
    e.preventDefault();
    if (username.trim()) connectMut.mutate();
  }

  return (
    <Card className="mt-6 p-6">
      <div className="mb-1 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-cyan" />
        <h2 className="font-cond text-[15px] font-extrabold uppercase tracking-[0.08em] text-content">
          Live sync
        </h2>
      </div>
      <p className="text-sm text-muted">
        Connect your Letterboxd username to pull recent diary entries (watches, ratings, likes) with
        one click. Letterboxd has no public write API, so this is one-way and limited to your{' '}
        <span className="text-content">~50 most recent entries</span> — use the one-time import below
        to backfill full history.
      </p>

      {isLoading ? (
        <div className="mt-4 flex justify-center py-2">
          <Spinner className="h-5 w-5" />
        </div>
      ) : status?.connectedUsername ? (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface-2/50 p-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-content">
              Connected to <span className="font-medium text-cyan">@{status.connectedUsername}</span>
            </p>
            <p className="text-xs text-muted-2">
              {status.lastSyncedAt
                ? `Last synced ${timeAgo(status.lastSyncedAt)}`
                : 'Never synced yet'}
            </p>
          </div>
          <Button size="sm" variant="primary" disabled={syncMut.isPending} onClick={() => syncMut.mutate()}>
            {syncMut.isPending ? 'Syncing…' : 'Sync now'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={disconnectMut.isPending}
            onClick={() => disconnectMut.mutate()}
          >
            Disconnect
          </Button>
        </div>
      ) : (
        <form onSubmit={onConnect} className="mt-4 flex flex-wrap gap-2">
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="your-letterboxd-username"
            className="flex-1"
          />
          <Button type="submit" variant="primary" disabled={connectMut.isPending || !username.trim()}>
            {connectMut.isPending ? 'Connecting…' : 'Connect'}
          </Button>
        </form>
      )}

      {(connectMut.isError || syncMut.isError || disconnectMut.isError) && (
        <p className="mt-3 rounded-lg border border-rose/30 bg-rose/10 px-3 py-2 text-sm text-rose">
          {errorMessage(connectMut.error ?? syncMut.error ?? disconnectMut.error)}
        </p>
      )}

      {syncMut.data && (
        <div className="mt-3 rounded-xl border border-border bg-surface-2/50 p-3 text-sm">
          <span className="font-cond text-base font-extrabold text-cyan">{syncMut.data.imported}</span>{' '}
          synced · {syncMut.data.failed} not matched of {syncMut.data.processed} recent entries.
        </div>
      )}
    </Card>
  );
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

function errorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Something went wrong';
}

// -------------------------------------------------------------------------
// One-time CSV import — full-history backfill.
// -------------------------------------------------------------------------

function CsvImportCard(): JSX.Element {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [items, setItems] = useState<LetterboxdItem[]>([]);
  const [mode, setMode] = useState<ImportMode>('watched');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  async function onFile(file: File): Promise<void> {
    setError(null);
    setSummary(null);
    try {
      const rows = parseCsv(await file.text());
      const header = (rows[0] ?? []).map((h) => h.trim().toLowerCase());
      const nameIdx = header.indexOf('name');
      const yearIdx = header.indexOf('year');
      const ratingIdx = header.indexOf('rating');
      if (nameIdx < 0) {
        setError('This doesn’t look like a Letterboxd export — no "Name" column found.');
        setItems([]);
        return;
      }
      const parsed = rows
        .slice(1)
        .filter((r) => r[nameIdx]?.trim())
        .map<LetterboxdItem>((r) => ({
          name: r[nameIdx]!.trim(),
          year: yearIdx >= 0 && r[yearIdx] ? Number.parseInt(r[yearIdx]!, 10) || null : null,
          rating: ratingIdx >= 0 && r[ratingIdx] ? Number.parseFloat(r[ratingIdx]!) || null : null,
        }));
      setFileName(file.name);
      setItems(parsed.slice(0, MAX));
      setMode(file.name.toLowerCase().includes('watchlist') ? 'watchlist' : 'watched');
      if (parsed.length > MAX) setError(`Only the first ${MAX} rows will be imported.`);
    } catch {
      setError('Could not read that file.');
    }
  }

  async function doImport(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const result = await api.importLetterboxd({ mode, items });
      setSummary(result);
      void queryClient.invalidateQueries({ queryKey: ['library'] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mt-6 p-6">
      <h2 className="mb-1 font-cond text-[15px] font-extrabold uppercase tracking-[0.08em] text-content">
        One-time import
      </h2>
      <p className="text-sm text-muted">
        On Letterboxd, go to <span className="text-content">Settings → Import &amp; Export → Export
        your data</span>, unzip it, and drop any of <code className="text-cyan">ratings.csv</code>,{' '}
        <code className="text-cyan">diary.csv</code>, <code className="text-cyan">watched.csv</code>,
        or <code className="text-cyan">watchlist.csv</code> below to backfill your full history.
      </p>

      <button
        onClick={() => inputRef.current?.click()}
        className="mt-4 flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border-hi bg-surface-2/40 px-6 py-10 text-center hover:border-cyan"
      >
        <span className="text-2xl">＋</span>
        <span className="text-sm text-content">
          {fileName ?? 'Choose a Letterboxd .csv file'}
        </span>
        {items.length > 0 && (
          <span className="text-xs text-muted-2">{items.length} titles parsed</span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
        }}
      />

      {items.length > 0 && (
        <>
          <div className="mt-5">
            <p className="mb-2 text-sm font-medium text-muted">Import as</p>
            <div className="flex gap-1.5">
              {(['watched', 'watchlist'] as ImportMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={cn(
                    'rounded-full border px-4 py-1.5 text-sm capitalize transition-colors',
                    mode === m
                      ? 'border-cyan bg-cyan/15 text-cyan'
                      : 'border-border text-muted hover:text-content',
                  )}
                >
                  {m === 'watched' ? 'Watched & rated' : 'Watchlist'}
                </button>
              ))}
            </div>
          </div>

          <Button
            variant="primary"
            size="lg"
            className="mt-6 w-full"
            disabled={busy}
            onClick={() => void doImport()}
          >
            {busy ? (
              <>
                <Spinner className="h-4 w-4" /> Importing {items.length}…
              </>
            ) : (
              `Import ${items.length} titles`
            )}
          </Button>
          {busy && (
            <p className="mt-2 text-center text-xs text-muted-2">
              Matching each title to TMDB — this can take a moment for large libraries.
            </p>
          )}
        </>
      )}

      {error && (
        <p className="mt-4 rounded-lg border border-rose/30 bg-rose/10 px-3 py-2 text-sm text-rose">
          {error}
        </p>
      )}

      {summary && (
        <div className="mt-5 rounded-xl border border-border bg-surface-2/50 p-4">
          <p className="text-sm">
            <span className="font-cond text-lg font-extrabold text-cyan">{summary.imported}</span>{' '}
            imported · <span className="text-muted-2">{summary.failed} not matched</span> of{' '}
            {summary.total}.
          </p>
          {summary.failures.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-muted-2 hover:text-content">
                Show titles we couldn’t match
              </summary>
              <ul className="mt-2 max-h-40 overflow-y-auto text-xs text-muted">
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
