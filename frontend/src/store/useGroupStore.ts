import { create } from 'zustand';
import type { Group } from '../api/groups';

interface GroupState {
  groups: Group[];
  selectedIds: Set<string>;
  searchQuery: string;
  filterType: 'all' | 'group' | 'channel';
  filterMuted: 'all' | 'muted' | 'unmuted';
  
  setGroups: (groups: Group[]) => void;
  toggleSelection: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  
  setSearchQuery: (query: string) => void;
  setFilterType: (type: 'all' | 'group' | 'channel') => void;
  setFilterMuted: (muted: 'all' | 'muted' | 'unmuted') => void;
}

export const useGroupStore = create<GroupState>((set) => ({
  groups: [],
  selectedIds: new Set(),
  searchQuery: '',
  filterType: 'all',
  filterMuted: 'all',

  setGroups: (groups) => set({ groups }),
  
  toggleSelection: (id) => set((state) => {
    const newSelection = new Set(state.selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    return { selectedIds: newSelection };
  }),
  
  selectAll: (ids) => set({ selectedIds: new Set(ids) }),
  
  clearSelection: () => set({ selectedIds: new Set() }),
  
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setFilterType: (filterType) => set({ filterType }),
  setFilterMuted: (filterMuted) => set({ filterMuted }),
}));
