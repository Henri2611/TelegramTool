import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuthStore } from '../store/useAuthStore';
import { useGroupStore } from '../store/useGroupStore';
import { groupsApi } from '../api/groups';
import type { Group } from '../api/groups';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { useTheme } from 'next-themes';
import { getErrorMessage } from '../lib/utils';
import {
  LogOut, RefreshCw, Search, Moon, Sun,
  X, AlertCircle, Loader2, Users, VolumeX, Volume2,
  ArrowUpDown, AlertTriangle, Hash, Megaphone,
} from 'lucide-react';

// ── Sub-components ────────────────────────────────────────────────────────────

function TgMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.2-.04-.28-.02-.12.02-1.96 1.25-5.54 3.69-.52.36-1 .53-1.42.52-.47-.01-1.37-.26-2.03-.48-.82-.27-1.47-.42-1.42-.88.03-.25.38-.51 1.07-.78 4.19-1.82 6.98-3.02 8.38-3.61 3.99-1.66 4.82-1.95 5.36-1.96.12 0 .38.03.55.17.14.12.18.28.2.45-.02.07-.02.14-.04.23z" />
    </svg>
  );
}

function GroupAvatar({ title, id }: { title: string; id: string }) {
  const hue = Math.abs(
    id.split('').reduce((h, c) => ((h << 5) - h) + c.charCodeAt(0), 0)
  ) % 360;
  return (
    <div
      className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0 select-none"
      style={{ backgroundColor: `hsl(${hue}, 48%, 40%)` }}
    >
      {title.charAt(0).toUpperCase()}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  iconClass,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  iconClass: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconClass}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xl font-bold tabular-nums leading-none">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function GroupRow({
  group,
  isSelected,
  onToggle,
  disabled,
}: {
  group: Group;
  isSelected: boolean;
  onToggle: () => void;
  disabled: boolean;
}) {
  return (
    <div
      onClick={() => !disabled && onToggle()}
      className={[
        'flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors select-none',
        'relative border-l-2',
        isSelected
          ? 'border-l-primary bg-primary/[0.06] hover:bg-primary/[0.09]'
          : 'border-l-transparent hover:bg-muted/40',
        disabled ? 'cursor-default opacity-60 pointer-events-none' : '',
      ].join(' ')}
    >
      <Checkbox
        checked={isSelected}
        onCheckedChange={onToggle}
        disabled={disabled}
        onClick={(e) => e.stopPropagation()}
        className="shrink-0"
      />
      <GroupAvatar title={group.title} id={group.id} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight truncate">{group.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {group.member_count != null
            ? `${group.member_count.toLocaleString()} members`
            : 'Unknown size'}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Badge
          variant={group.type === 'channel' ? 'default' : 'secondary'}
          className="text-[10px] h-5 px-1.5 capitalize"
        >
          {group.type}
        </Badge>
        {group.is_muted ? (
          <Badge variant="outline" className="text-[10px] h-5 px-1.5 text-muted-foreground">
            <VolumeX className="w-2.5 h-2.5" />
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="text-[10px] h-5 px-1.5 text-emerald-600 border-emerald-600/20 dark:text-emerald-400 dark:border-emerald-400/20"
          >
            <Volume2 className="w-2.5 h-2.5" />
          </Badge>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { token, phone, logout } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const {
    groups, setGroups,
    selectedIds, toggleSelection, selectAll, clearSelection,
    searchQuery, setSearchQuery,
    filterType, setFilterType,
    filterMuted, setFilterMuted,
    sortBy, sortDir, setSortBy,
  } = useGroupStore();

  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [leaving,      setLeaving]      = useState(false);
  const [progress,     setProgress]     = useState(0);
  const [progressText, setProgressText] = useState('');
  const [showConfirm,  setShowConfirm]  = useState(false);

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [localSearch,  setLocalSearch]  = useState(searchQuery);

  const debouncedSetSearch = useCallback((value: string) => {
    setLocalSearch(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => setSearchQuery(value), 200);
  }, [setSearchQuery]);

  useEffect(() => () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); }, []);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchGroups = useCallback(async (silent = false) => {
    if (!token) return;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await groupsApi.getGroups(token);
      setGroups(data);
      clearSelection();
      if (!silent) toast.success(`Loaded ${data.length} groups`);
    } catch (err) {
      const msg = getErrorMessage(err, 'Failed to load groups');
      setError(msg);
      if (!silent) toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [token, setGroups, clearSelection]);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  // ── Derived data ───────────────────────────────────────────────────────────

  const filteredGroups = useMemo(() =>
    groups.filter((g) => {
      const q = localSearch.toLowerCase();
      return (
        (!q || g.title.toLowerCase().includes(q)) &&
        (filterType  === 'all' || g.type     === filterType) &&
        (filterMuted === 'all' ||
          (filterMuted === 'muted'   &&  g.is_muted) ||
          (filterMuted === 'unmuted' && !g.is_muted))
      );
    }),
  [groups, localSearch, filterType, filterMuted]);

  const sortedGroups = useMemo(() => {
    return [...filteredGroups].sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'name')    cmp = a.title.localeCompare(b.title);
      if (sortBy === 'members') cmp = (a.member_count ?? 0) - (b.member_count ?? 0);
      if (sortBy === 'type')    cmp = a.type.localeCompare(b.type);
      return sortDir === 'desc' ? -cmp : cmp;
    });
  }, [filteredGroups, sortBy, sortDir]);

  const stats = useMemo(() => ({
    total:    groups.length,
    groups:   groups.filter((g) => g.type === 'group').length,
    channels: groups.filter((g) => g.type === 'channel').length,
    muted:    groups.filter((g) => g.is_muted).length,
  }), [groups]);

  // ── Selection helpers ──────────────────────────────────────────────────────

  const allSelected  = sortedGroups.length > 0 && sortedGroups.every((g) => selectedIds.has(g.id));
  const someSelected = selectedIds.size > 0 && !allSelected;

  const handleSelectAll = (checked: boolean) =>
    checked ? selectAll(sortedGroups.map((g) => g.id)) : clearSelection();

  const selectMuted    = () => selectAll(sortedGroups.filter((g) => g.is_muted).map((g) => g.id));
  const selectChannels = () => selectAll(sortedGroups.filter((g) => g.type === 'channel').map((g) => g.id));

  // ── Leave action ───────────────────────────────────────────────────────────

  const confirmLeave = async () => {
    setShowConfirm(false);
    if (selectedIds.size === 0 || !token) return;
    setLeaving(true);
    setProgress(0);
    setProgressText('Starting…');
    const idsToLeave = Array.from(selectedIds);
    let failedCount = 0;
    try {
      await groupsApi.leaveGroups(token, idsToLeave, (completed, total, hasError) => {
        setProgress((completed / total) * 100);
        setProgressText(`Leaving ${completed} of ${total}…`);
        if (hasError) failedCount++;
      });
      const succeeded = idsToLeave.length - failedCount;
      failedCount === 0
        ? toast.success(`Left ${idsToLeave.length} group${idsToLeave.length > 1 ? 's' : ''}`)
        : toast.warning(`Left ${succeeded}/${idsToLeave.length}. ${failedCount} failed.`);
      clearSelection();
      fetchGroups(true);
    } catch {
      toast.error('Something went wrong during the bulk leave.');
    } finally {
      setLeaving(false);
      setProgress(0);
      setProgressText('');
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">

      {/* ── Confirmation modal ───────────────────────────────────────────── */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setShowConfirm(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0,  scale: 1 }}
              exit={{ opacity: 0,   y: 16, scale: 0.97 }}
              transition={{ duration: 0.18 }}
              className="bg-card rounded-2xl border shadow-xl max-w-sm w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center mb-4">
                <AlertTriangle className="w-6 h-6 text-destructive" />
              </div>
              <h3 className="text-lg font-bold mb-1">
                Leave {selectedIds.size} group{selectedIds.size !== 1 ? 's' : ''}?
              </h3>
              <p className="text-sm text-muted-foreground mb-5">
                You'll be removed from {selectedIds.size} chat
                {selectedIds.size !== 1 ? 's' : ''}. This cannot be undone and may delete chat history.
              </p>
              <div className="flex gap-2.5">
                <Button variant="outline" className="flex-1" onClick={() => setShowConfirm(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" className="flex-1" onClick={confirmLeave}>
                  Leave {selectedIds.size}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-lg">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <TgMark className="w-4 h-4 text-primary" />
            </div>
            <span className="font-semibold text-sm hidden sm:block">Telegram Manager</span>
            {phone && (
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-mono truncate max-w-[160px]">
                {phone}
              </span>
            )}
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            <Button
              variant="ghost" size="icon" className="h-8 w-8"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost" size="icon" className="h-8 w-8"
              onClick={() => fetchGroups()}
              disabled={loading || leaving}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="ghost" size="sm" className="h-8 gap-1.5 text-muted-foreground hover:text-destructive"
              onClick={logout}
              disabled={leaving}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-xs">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-5 space-y-4 pb-28">

        {/* ── Progress banner ────────────────────────────────────────────── */}
        <AnimatePresence>
          {leaving && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1,  y: 0 }}
              exit={{ opacity: 0,    y: -8 }}
              className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {progressText}
                </div>
                <span className="text-xs font-mono tabular-nums text-muted-foreground">
                  {Math.round(progress)}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-primary/15 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Stat cards ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total"    value={stats.total}    icon={Users}    iconClass="bg-primary/10 text-primary" />
          <StatCard label="Groups"   value={stats.groups}   icon={Hash}     iconClass="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" />
          <StatCard label="Channels" value={stats.channels} icon={Megaphone} iconClass="bg-violet-500/10 text-violet-600 dark:text-violet-400" />
          <StatCard label="Muted"    value={stats.muted}    icon={VolumeX}  iconClass="bg-amber-500/10 text-amber-600 dark:text-amber-400" />
        </div>

        {/* ── Search ─────────────────────────────────────────────────────── */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search groups and channels…"
            className="pl-9 pr-9 h-10"
            value={localSearch}
            onChange={(e) => debouncedSetSearch(e.target.value)}
            disabled={leaving}
          />
          {localSearch && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => debouncedSetSearch('')}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* ── Filters + sort ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none">
          <div className="flex gap-1.5 shrink-0">
            {(['all', 'group', 'channel'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                disabled={leaving}
                className={[
                  'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
                  filterType === t
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70',
                ].join(' ')}
              >
                {t === 'all' ? 'All types' : t === 'group' ? 'Groups' : 'Channels'}
              </button>
            ))}
          </div>

          <div className="w-px h-4 bg-border shrink-0" />

          <div className="flex gap-1.5 shrink-0">
            {(['all', 'muted', 'unmuted'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setFilterMuted(m)}
                disabled={leaving}
                className={[
                  'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
                  filterMuted === m
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70',
                ].join(' ')}
              >
                {m === 'all' ? 'All status' : m === 'muted' ? 'Muted' : 'Active'}
              </button>
            ))}
          </div>

          <div className="ml-auto shrink-0 flex items-center gap-1.5">
            <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
            <select
              className="h-8 rounded-lg border border-input bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring/50"
              value={`${sortBy}:${sortDir}`}
              onChange={(e) => {
                const [by, dir] = e.target.value.split(':') as [typeof sortBy, typeof sortDir];
                setSortBy(by, dir);
              }}
              disabled={leaving}
            >
              <option value="name:asc">Name A–Z</option>
              <option value="name:desc">Name Z–A</option>
              <option value="members:desc">Most members</option>
              <option value="members:asc">Fewest members</option>
              <option value="type:asc">By type</option>
            </select>
          </div>
        </div>

        {/* ── Group list card ─────────────────────────────────────────────── */}
        <div className="rounded-xl border bg-card overflow-hidden">

          {/* List header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/20">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={allSelected || someSelected}
                onCheckedChange={handleSelectAll}
                disabled={leaving || sortedGroups.length === 0}
              />
              <span className="text-sm text-muted-foreground">
                {selectedIds.size > 0 ? (
                  <span className="font-medium text-foreground">{selectedIds.size} selected</span>
                ) : (
                  <>
                    {filteredGroups.length} result{filteredGroups.length !== 1 ? 's' : ''}
                    {filteredGroups.length !== groups.length && (
                      <span className="ml-1">of {groups.length}</span>
                    )}
                  </>
                )}
              </span>
            </div>

            {/* Quick selects — only when nothing is selected */}
            {!leaving && groups.length > 0 && selectedIds.size === 0 && (
              <div className="flex items-center gap-1">
                {stats.muted > 0 && (
                  <button
                    onClick={selectMuted}
                    className="text-xs text-muted-foreground hover:text-foreground px-2.5 py-1 rounded-lg hover:bg-muted transition-colors"
                  >
                    Select muted
                  </button>
                )}
                {stats.channels > 0 && (
                  <button
                    onClick={selectChannels}
                    className="text-xs text-muted-foreground hover:text-foreground px-2.5 py-1 rounded-lg hover:bg-muted transition-colors"
                  >
                    Select channels
                  </button>
                )}
              </div>
            )}
          </div>

          {/* List body */}
          {loading ? (
            <div className="divide-y">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
                  <div className="w-4 h-4 rounded bg-muted shrink-0" />
                  <div className="w-9 h-9 rounded-xl bg-muted shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 bg-muted rounded" style={{ width: `${30 + (i * 17) % 40}%` }} />
                    <div className="h-3 bg-muted rounded" style={{ width: `${15 + (i * 11) % 20}%` }} />
                  </div>
                  <div className="flex gap-1.5">
                    <div className="w-14 h-5 bg-muted rounded-full" />
                    <div className="w-8 h-5 bg-muted rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="py-16 flex flex-col items-center text-center px-6">
              <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center mb-4">
                <AlertCircle className="w-6 h-6 text-destructive" />
              </div>
              <h3 className="font-semibold mb-1">Failed to load</h3>
              <p className="text-sm text-muted-foreground mb-5 max-w-xs">{error}</p>
              <Button onClick={() => fetchGroups()} variant="outline" size="sm">
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Try again
              </Button>
            </div>
          ) : sortedGroups.length === 0 ? (
            <div className="py-16 flex flex-col items-center text-center px-6">
              <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mb-1">No results</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                {localSearch || filterType !== 'all' || filterMuted !== 'all'
                  ? 'Try adjusting your search or filters.'
                  : 'No Telegram groups or channels found.'}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {sortedGroups.map((group) => (
                <GroupRow
                  key={group.id}
                  group={group}
                  isSelected={selectedIds.has(group.id)}
                  onToggle={() => toggleSelection(group.id)}
                  disabled={leaving}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ── Floating action bar ──────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedIds.size > 0 && !leaving && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ type: 'spring', stiffness: 420, damping: 38 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 pl-4 pr-2 py-2 rounded-2xl border bg-background/95 backdrop-blur-xl shadow-2xl shadow-black/15 dark:shadow-black/40"
          >
            <span className="text-sm font-medium tabular-nums text-foreground whitespace-nowrap">
              {selectedIds.size} selected
            </span>
            <div className="w-px h-5 bg-border mx-0.5" />
            <Button
              variant="ghost" size="sm" className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={clearSelection}
            >
              <X className="w-3.5 h-3.5" />
              Clear
            </Button>
            <Button
              variant="destructive" size="sm" className="h-8 gap-1.5"
              onClick={() => setShowConfirm(true)}
            >
              <LogOut className="w-3.5 h-3.5" />
              Leave {selectedIds.size}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
