import { useEffect, useState, useMemo } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useGroupStore } from '../store/useGroupStore';
import { groupsApi } from '../api/groups';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Checkbox } from '../components/ui/checkbox';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { toast } from 'sonner';
import { LogOut, RefreshCw, Search } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table"

export default function DashboardPage() {
  const { phone, logout } = useAuthStore();
  const { 
    groups, setGroups, 
    selectedIds, toggleSelection, selectAll, clearSelection,
    searchQuery, setSearchQuery,
    filterType, setFilterType,
    filterMuted, setFilterMuted
  } = useGroupStore();

  const [loading, setLoading] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [progress, setProgress] = useState(0);

  const fetchGroups = async () => {
    if (!phone) return;
    setLoading(true);
    try {
      const data = await groupsApi.getGroups(phone);
      setGroups(data);
      clearSelection();
      toast.success('Groups loaded successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to fetch groups');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, [phone]);

  // Filtering Logic
  const filteredGroups = useMemo(() => {
    return groups.filter(g => {
      const matchesSearch = g.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = filterType === 'all' || g.type === filterType;
      const matchesMuted = filterMuted === 'all' || 
                           (filterMuted === 'muted' && g.is_muted) || 
                           (filterMuted === 'unmuted' && !g.is_muted);
      
      return matchesSearch && matchesType && matchesMuted;
    });
  }, [groups, searchQuery, filterType, filterMuted]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      selectAll(filteredGroups.map(g => g.id));
    } else {
      clearSelection();
    }
  };

  const handleLeaveSelected = async () => {
    if (selectedIds.size === 0 || !phone) return;
    
    const confirmLeave = window.confirm(`Are you sure you want to leave ${selectedIds.size} selected group(s)?\n\nThis process will take approximately ${selectedIds.size * 2} seconds to complete safely.`);
    if (!confirmLeave) return;

    setLeaving(true);
    setProgress(0);
    const idsToLeave = Array.from(selectedIds);
    
    try {
      await groupsApi.leaveGroups(phone, idsToLeave, (completed, total) => {
        setProgress((completed / total) * 100);
      });
      toast.success(`Successfully processed ${idsToLeave.length} groups!`);
      clearSelection();
      fetchGroups(); // Refresh list to reflect changes
    } catch (error) {
      toast.error('An error occurred during the bulk leave process.');
    } finally {
      setLeaving(false);
      setProgress(0);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex justify-between items-center bg-white p-4 rounded-lg border shadow-sm">
          <div>
            <h1 className="text-2xl font-bold">Telegram Manager</h1>
            <p className="text-sm text-gray-500">Logged in as {phone}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={fetchGroups} disabled={loading || leaving}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="destructive" onClick={logout} disabled={leaving}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        {/* Filters and Search */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[250px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <Input 
                placeholder="Search groups..." 
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={leaving}
              />
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Type:</span>
              <select 
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                disabled={leaving}
              >
                <option value="all">All</option>
                <option value="group">Groups</option>
                <option value="channel">Channels</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Status:</span>
              <select 
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
                value={filterMuted}
                onChange={(e) => setFilterMuted(e.target.value as any)}
                disabled={leaving}
              >
                <option value="all">All</option>
                <option value="muted">Muted</option>
                <option value="unmuted">Unmuted</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Data Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Your Groups & Channels ({filteredGroups.length})</CardTitle>
            {selectedIds.size > 0 && (
              <Button 
                variant="destructive" 
                onClick={handleLeaveSelected}
                disabled={leaving}
              >
                Leave {selectedIds.size} Selected
              </Button>
            )}
          </CardHeader>
          <CardContent>
            
            {leaving && (
              <div className="mb-6 space-y-2 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex justify-between text-sm font-medium text-orange-800">
                  <span>Processing... Please do not close or refresh this page.</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}

            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox 
                        checked={filteredGroups.length > 0 && selectedIds.size === filteredGroups.length}
                        onCheckedChange={handleSelectAll}
                        disabled={leaving}
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-gray-500">Loading...</TableCell>
                    </TableRow>
                  ) : filteredGroups.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-gray-500">No groups found.</TableCell>
                    </TableRow>
                  ) : (
                    filteredGroups.map((group) => (
                      <TableRow key={group.id}>
                        <TableCell>
                          <Checkbox 
                            checked={selectedIds.has(group.id)}
                            onCheckedChange={() => toggleSelection(group.id)}
                            disabled={leaving}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{group.title}</TableCell>
                        <TableCell>
                          <Badge variant={group.type === 'channel' ? 'default' : 'secondary'}>
                            {group.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {group.is_muted ? (
                            <Badge variant="outline" className="text-gray-500">Muted</Badge>
                          ) : (
                            <Badge variant="outline" className="text-green-600 border-green-600">Active</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
