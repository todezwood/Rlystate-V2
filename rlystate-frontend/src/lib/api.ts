export const API_BASE: string = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export async function api(path: string, options: RequestInit = {}): Promise<Response> {
  const userId = localStorage.getItem('rlystate_user_id');

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  if (userId) {
    headers['Authorization'] = `Bearer ${userId}`;
  }

  // Default to JSON content type for POST/PUT/PATCH unless already set
  if (options.body && typeof options.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
}
