const API_BASE = process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:3001/api';

/**
 * Run a lead search.
 * LinkedIn: { platform: 'linkedin', search, location, jobTitles, limit }
 * Reddit:   { platform: 'reddit', searchTerms, subreddits, limit }
 */
export async function searchLeads(payload) {
  let res;
  try {
    res = await fetch(`${API_BASE}/leads/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error('Cannot reach the backend. Is it running on port 3001?');
  }
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error('Unexpected response from the backend.');
  }
  if (!data.success) throw new Error(data.error || 'Search failed.');
  return data;
}

export function exportToCSV(data, filename) {
  if (!data || data.length === 0) return;
  const keys = Object.keys(data[0]).filter((k) => k !== '_raw');
  const csvRows = [
    keys.join(','),
    ...data.map((row) =>
      keys
        .map((k) => {
          const val = row[k] ?? '';
          const str = String(val).replace(/"/g, '""');
          return `"${str}"`;
        })
        .join(',')
    ),
  ];
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
