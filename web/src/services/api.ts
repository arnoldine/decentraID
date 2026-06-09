const BASE_URL = '/api';

export async function adminLogin(username: string, password: string): Promise<{ token: string; role: string; username: string }> {
  const res = await fetch(`${BASE_URL}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Login failed' }));
    throw new Error(err.error ?? 'Login failed');
  }
  return res.json();
}

export async function mobileLogin(username: string, password: string): Promise<{ token: string; role: string; username: string }> {
  const res = await fetch(`${BASE_URL}/mobile/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Login failed' }));
    throw new Error(err.error ?? 'Login failed');
  }
  return res.json();
}

export async function getVerificationReports(
  token: string,
  page: number,
  limit: number,
  filters?: { verified?: boolean; pinNumber?: string }
): Promise<{ reports: any[]; total: number; page: number; totalPages: number }> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (filters?.verified !== undefined) params.set('verified', String(filters.verified));
  if (filters?.pinNumber) params.set('pinNumber', filters.pinNumber);

  const res = await fetch(`${BASE_URL}/admin/verification-reports?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch reports');
  return res.json();
}

export async function getVerificationStats(token: string): Promise<{ total: number; successful: number; failed: number }> {
  const res = await fetch(`${BASE_URL}/admin/verification-stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}

export async function getVerificationSettings(token: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/admin/verification-settings`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch settings');
  return res.json();
}

export async function updateVerificationSettings(token: string, settings: any): Promise<any> {
  const res = await fetch(`${BASE_URL}/admin/verification-settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error('Failed to update settings');
  return res.json();
}

export async function getUsers(token: string): Promise<any[]> {
  const res = await fetch(`${BASE_URL}/admin/users`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch users');
  return res.json();
}

export async function createUser(token: string, user: { username: string; password: string; role: string }): Promise<any> {
  const res = await fetch(`${BASE_URL}/admin/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(user),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to create user' }));
    throw new Error(err.error ?? 'Failed to create user');
  }
  return res.json();
}

export async function deleteUser(token: string, userId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/admin/users/${userId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to delete user');
}

export async function getMobileSettings(token: string): Promise<any> {
  const res = await fetch(`${BASE_URL}/mobile/settings`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch mobile settings');
  return res.json();
}

export async function submitVerification(
  token: string,
  data: { pinNumber: string; image: string; livenessPassed: boolean }
): Promise<any> {
  const res = await fetch(`${BASE_URL}/mobile/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Verification failed' }));
    throw new Error(err.error ?? 'Verification failed');
  }
  return res.json();
}
