import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:8000' : '');

const api = axios.create({
  baseURL: API_BASE,
});

export interface Group {
  id: string;
  title: string;
  type: 'group' | 'channel';
  is_muted: boolean;
  member_count?: number | null;
}

export const groupsApi = {
  getGroups: async (token: string): Promise<Group[]> => {
    const { data } = await api.get('/groups', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return data.data;
  },

  leaveGroups: async (
    token: string,
    groupIds: string[],
    onProgress: (completed: number, total: number, hasError?: boolean) => void
  ): Promise<void> => {
    const response = await fetch(`${API_BASE}/groups/leave`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ group_ids: groupIds })
    });

    if (!response.body) throw new Error("No response body");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(Boolean);

      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data.status === 'progress') {
            onProgress(data.index, data.total);
          } else if (data.status === 'flood_wait') {
            console.warn('Flood wait:', data.wait_seconds, 'seconds');
          } else if (data.status === 'error') {
            console.error('Error leaving group:', data);
            onProgress(data.index || 0, data.total || 0, true);
          }
        } catch {
          console.error("Failed to parse JSON stream chunk:", line);
        }
      }
    }
  }
};
