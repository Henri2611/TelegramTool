import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useGroupStore } from '../store/useGroupStore';
import { groupsApi } from '../api/groups';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { useTheme } from 'next-themes';
import { getErrorMessage } from '../lib/utils';
import {
  LogOut, RefreshCw, Search, Moon, Sun,
  MessageCircle, SlidersHorizontal, X,
  AlertCircle, Loader2, Users, VolumeX, Volume2,
  Hash
} from 'lucide-react';

export default function DashboardPage() {
  const { token, logout } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const {
    groups, setGroups,
    selectedIds, toggleSelection, selectAll, clearSelection,
    searchQuery, setSearchQuery,
    filterType, setFilterType,
    filterMuted, setFilterMuted,
  } = useGroupStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [localSearch, setLocalSearch] = useState(searchQuery);

  const debouncedSetSearch = useCallback((value: string) => {
    setLocalSearch(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setSearchQuery(value);
    }, 200);
  }, [setSearchQuery]);

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  const fetchGroups = useCallback(async (silent = false) => {
    if (!token) return;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await groupsApi.getGroups(token);
      setGroups(data);
      clearSelection();
      if (!silent) toast.success('Groups loaded successfully');
    } catch (err) {
      const msg = getErrorMessage(err, 'Failed to load groups');
      setError(msg);
      if (!silent) toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [token, setGroups, clearSelection]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const filteredGroups = useMemo(() => {
    return groups.filter(g => {
      const q = localSearch.toLowerCase();
      const matchesSearch = !q || g.title.toLowerCase().includes(q);
      const matchesType = filterType === 'all' || g.type === filterType;
      const matchesMuted = filterMuted === 'all' ||
        (filterMuted === 'muted' && g.is_muted) ||
        (filterMuted === 'unmuted' && !g.is_muted);
      return matchesSearch && matchesType && matchesMuted;
    });
  }, [groups, localSearch, filterType, filterMuted]);

  const handleSelectAll = (checked: boolean) => {
    checked ? selectAll(filteredGroups.map(g => g.id)) : clearSelection();
  };

  const handleLeaveSelected = async () => {
    const size = selectedIds.size;
    if (size === 0 || !token) return;
    setShowConfirm(true);
  };

  const confirmLeave = async () => {
    setShowConfirm(false);
    const size = selectedIds.size;
    if (size === 0 || !token) return;

    setLeaving(true);
    setProgress(0);
    setProgressText('Starting...');
    const idsToLeave = Array.from(selectedIds);

    let failedCount = 0;
    try {
      await groupsApi.leaveGroups(token, idsToLeave, (completed, total, hasError) => {
        setProgress((completed / total) * 100);
        setProgressText(`Processing ${completed} of ${total}...`);
        if (hasError) failedCount++;
      });
      const succeeded = idsToLeave.length - failedCount;
      if (failedCount === 0) {
        toast.success(`Successfully left ${idsToLeave.length} group${idsToLeave.length > 1 ? 's' : ''}!`);
      } else {
        toast.warning(`Left ${succeeded}/${idsToLeave.length} groups. ${failedCount} failed.`);
      }
      clearSelection();
      fetchGroups(true);
    } catch {
      toast.error('An error occurred during the bulk leave process.');
    } finally {
      setLeaving(false);
      setProgress(0);
      setProgressText('');
    }
  };

  const allSelected = filteredGroups.length > 0 && selectedIds.size === filteredGroups.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  return (
    <div className="min-h-screen bg-background">
      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-xl border shadow-lg max-w-md w-full mx-4 p-6 space-y-4">
            <h3 className="text-lg font-bold">Confirm Bulk Leave</h3>
            <p className="text-sm text-muted-foreground">
              You are about to leave <strong>{selectedIds.size}</strong> group{selectedIds.size !== 1 ? 's' : ''}.
              This action is irreversible and will delete chat history.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowConfirm(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmLeave}>
                <LogOut className="w-4 h-4 mr-1.5" />
                Leave {selectedIds.size}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-lg">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-bold">Telegram Manager</h1>
              <p className="text-xs text-muted-foreground">{groups.length} groups</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchGroups()}
              disabled={loading || leaving}
            >
              <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              disabled={leaving}
              className="text-destructive hover:text-destructive"
            >
              <LogOut className="w-4 h-4 mr-1.5" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Progress Banner */}
        {leaving && (
          <div className="p-5 rounded-xl bg-primary/5 border border-primary/20 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{progressText}</span>
              </div>
              <span className="text-sm font-mono tabular-nums text-muted-foreground">
                {Math.round(progress)}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Search & Filters Bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search groups..."
              className="pl-9 h-10"
              value={localSearch}
              onChange={(e) => debouncedSetSearch(e.target.value)}
              disabled={leaving}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={showFilters ? 'bg-accent' : ''}
          >
            <SlidersHorizontal className="w-4 h-4 mr-1.5" />
            Filters
          </Button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="p-4 rounded-xl border bg-card/50 space-y-4 sm:space-y-0 sm:flex sm:gap-4 sm:items-center">
            <div className="flex items-center gap-2">
              <Hash className="w-4 h-4 text-muted-foreground" />
              <select
                className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                disabled={leaving}
              >
                <option value="all">All Types</option>
                <option value="group">Groups</option>
                <option value="channel">Channels</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              {filterMuted === 'muted'
                ? <VolumeX className="w-4 h-4 text-muted-foreground" />
                : <Volume2 className="w-4 h-4 text-muted-foreground" />
              }
              <select
                className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
                value={filterMuted}
                onChange={(e) => setFilterMuted(e.target.value as any)}
                disabled={leaving}
              >
                <option value="all">All Status</option>
                <option value="muted">Muted</option>
                <option value="unmuted">Unmuted</option>
              </select>
            </div>
          </div>
        )}

        {/* Group List Card */}
        <div className="rounded-xl border bg-card">
          {/* Card Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={allSelected}
                onCheckedChange={handleSelectAll}
                disabled={leaving || filteredGroups.length === 0}
                className={someSelected ? 'data-[state=checked]:bg-muted-foreground' : ''}
              />
              <span className="text-sm font-medium">
                {selectedIds.size > 0
                  ? `${selectedIds.size} selected`
                  : `${filteredGroups.length} group${filteredGroups.length !== 1 ? 's' : ''}`
                }
              </span>
            </div>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                {selectedIds.size > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearSelection} disabled={leaving}>
                    <X className="w-4 h-4 mr-1" />
                    Clear
                  </Button>
                )}
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleLeaveSelected}
                  disabled={leaving}
                >
                  <LogOut className="w-4 h-4 mr-1.5" />
                  Leave {selectedIds.size}
                </Button>
              </div>
            )}
          </div>

          {/* Content */}
          {loading ? (
            <div className="p-8 space-y-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 animate-pulse">
                  <div className="w-5 h-5 rounded bg-muted" />
                  <div className="flex-1 h-5 rounded bg-muted" />
                  <div className="w-16 h-5 rounded bg-muted" />
                  <div className="w-16 h-5 rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="p-12 flex flex-col items-center justify-center text-center">
              <AlertCircle className="w-10 h-10 text-destructive mb-4" />
              <h3 className="font-semibold mb-1">Failed to load groups</h3>
              <p className="text-sm text-muted-foreground mb-4">{error}</p>
              <Button onClick={() => fetchGroups()} variant="outline">
                <RefreshCw className="w-4 h-4 mr-1.5" />
                Try Again
              </Button>
            </div>
          ) : filteredGroups.length === 0 ? (
            <div className="p-12 flex flex-col items-center justify-center text-center">
              <Users className="w-10 h-10 text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-1">No groups found</h3>
              <p className="text-sm text-muted-foreground">
                {localSearch || filterType !== 'all' || filterMuted !== 'all'
                  ? 'Try adjusting your filters or search query.'
                  : 'No Telegram groups or channels found. Join some groups first!'}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredGroups.map((group) => {
                const isSelected = selectedIds.has(group.id);
                return (
                  <div
                    key={group.id}
                    className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 ${
                      isSelected ? 'bg-accent/30' : ''
                    }`}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelection(group.id)}
                      disabled={leaving}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{group.title}</p>
                      {group.member_count != null && (
                        <p className="text-xs text-muted-foreground">{group.member_count} members</p>
                      )}
                    </div>
                    <Badge
                      variant={group.type === 'channel' ? 'default' : 'secondary'}
                      className="shrink-0"
                    >
                      {group.type}
                    </Badge>
                    {group.is_muted ? (
                      <Badge variant="outline" className="shrink-0 text-muted-foreground">
                        <VolumeX className="w-3 h-3 mr-1" />
                        Muted
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="shrink-0 text-emerald-600 border-emerald-600/30 dark:text-emerald-400 dark:border-emerald-400/30">
                        <Volume2 className="w-3 h-3 mr-1" />
                        Active
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
