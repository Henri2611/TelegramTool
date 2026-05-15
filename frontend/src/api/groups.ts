import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:8000',
});

export interface Group {
  id: string;
  title: string;
  type: 'group' | 'channel';
  is_muted: boolean;
}

export const groupsApi = {
  getGroups: async (phone: string): Promise<Group[]> => {
    const { data } = await api.get(`/groups/${encodeURIComponent(phone)}`);
    return data.data;
  },

  leaveGroups: async (
    phone: string, 
    groupIds: string[], 
    onProgress: (completed: number, total: number) => void
  ): Promise<void> => {
    const response = await fetch(`${api.defaults.baseURL}/groups/${encodeURIComponent(phone)}/leave`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
          } else if (data.status === 'error') {
            console.error('Error leaving group:', data);
          }
        } catch (e) {
          console.error("Failed to parse JSON stream chunk:", line);
        }
      }
    }
  }
};

