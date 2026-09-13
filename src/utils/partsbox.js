async function pbCall(operation, body = {}) {
  const res = await fetch(`/api/partsbox?op=${encodeURIComponent(operation)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok || data['partsbox.status/category'] !== 'ok') {
    const msg = data['partsbox.status/message'] || data.error || `HTTP ${res.status}`;
    console.error('Partsbox error:', operation, JSON.stringify(body), '→', msg);
    throw new Error(msg);
  }
  return data.data;
}

export function totalStock(part) {
  return (part['part/stock'] || []).reduce((sum, s) => sum + (s['stock/quantity'] || 0), 0);
}

export function isLowStock(part) {
  const total = totalStock(part);
  const threshold = part['part/low-stock']?.report;
  return threshold != null ? total <= threshold : total <= 2;
}

export function stockByStorage(part) {
  const byLoc = {};
  for (const s of part['part/stock'] || []) {
    const sid = s['stock/storage-id'];
    byLoc[sid] = (byLoc[sid] || 0) + (s['stock/quantity'] || 0);
  }
  return Object.entries(byLoc)
    .filter(([, qty]) => qty > 0)
    .map(([sid, qty]) => ({ sid, qty }));
}

export const getAllParts = () => pbCall('part/all');
export const getAllStorages = () => pbCall('storage/all');
export const getPartLots = (partId) => pbCall('part/lots', { 'part/id': partId });

export function addStock(partId, storageId, qty, comment = '') {
  return pbCall('stock/add', {
    'stock/part-id': partId,
    'stock/storage-id': storageId,
    'stock/quantity': qty,
    'stock/comments': comment,
  });
}

export function removeStock(partId, storageId, qty, comment = '') {
  return pbCall('stock/remove', {
    'stock/source': { 'source/part-id': partId, 'source/storage-id': storageId },
    'stock/quantity': qty,
    'stock/comments': comment,
  });
}
