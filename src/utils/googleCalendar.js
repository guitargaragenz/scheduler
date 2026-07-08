const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || '';
const CALENDAR_ID = 'guitargaragenz@gmail.com';
const SCOPES = 'https://www.googleapis.com/auth/calendar';

let gapiInited = false;
let gisInited = false;
let calApiLoaded = false;
let tokenClient = null;
let initPromise = null; // Cached so initGoogleApi() can be called multiple times safely
let calApiPromise = null; // Cached so ensureCalendarApi() can be called multiple times safely

export function isConfigured() {
  return Boolean(CLIENT_ID && API_KEY);
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.body.appendChild(s);
  });
}

export async function initGoogleApi() {
  if (!isConfigured()) return false;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    // Load both scripts in parallel — no discovery doc here so init is instant
    await Promise.all([
      loadScript('https://apis.google.com/js/api.js'),
      loadScript('https://accounts.google.com/gsi/client'),
    ]);

    await new Promise(resolve => window.gapi.load('client', resolve));
    // apiKey only — skip discoveryDocs, lazy-load calendar API on first use instead
    await window.gapi.client.init({ apiKey: API_KEY });
    gapiInited = true;

    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: '',
    });
    gisInited = true;

    return true;
  })().catch(e => {
    console.error('Google API init failed:', e);
    initPromise = null; // Allow retry on failure
    return false;
  });

  return initPromise;
}

// Lazy-load the calendar API the first time it's actually needed. Cached the
// same way as initGoogleApi() — on page load the 30s poll and a user-
// triggered sync can both call this within the same tick, before
// calApiLoaded flips true; without a shared promise that fires two
// concurrent gapi.client.load() calls, and whichever one loses the race
// throws, silently failing that caller's job update.
async function ensureCalendarApi() {
  if (calApiLoaded) return;
  if (!calApiPromise) {
    calApiPromise = window.gapi.client.load('calendar', 'v3')
      .then(() => { calApiLoaded = true; })
      .catch(e => { calApiPromise = null; throw e; }); // allow retry on failure
  }
  return calApiPromise;
}

export function requestAuth(forceConsent = false) {
  return new Promise((resolve, reject) => {
    if (!tokenClient) { reject(new Error('GIS not initialized')); return; }
    tokenClient.callback = (resp) => {
      if (resp.error) reject(new Error(resp.error));
      else resolve(resp);
    };
    // Only show the consent screen on first auth or explicit re-auth;
    // otherwise silent token refresh (prompt: '') to avoid the slow popup.
    const hasToken = Boolean(window.gapi?.client?.getToken()?.access_token);
    tokenClient.requestAccessToken({ prompt: forceConsent || !hasToken ? 'consent' : '' });
  });
}

export function isSignedIn() {
  return gapiInited && window.gapi?.client?.getToken()?.access_token;
}

export function signOut() {
  const token = window.gapi?.client?.getToken();
  if (token) {
    window.google.accounts.oauth2.revoke(token.access_token);
    window.gapi.client.setToken('');
  }
}

export async function listEvents(timeMin, timeMax) {
  if (!isSignedIn()) return [];
  try {
    await ensureCalendarApi();

    // Fetch all calendars the user has access to, so Calendly appointments
    // (which may live on a separate "Calendly" calendar) are included
    const calListResp = await window.gapi.client.calendar.calendarList.list();
    const calendars   = calListResp.result.items || [];

    // Fetch events from all calendars in parallel
    const results = await Promise.allSettled(
      calendars.map(cal =>
        window.gapi.client.calendar.events.list({
          calendarId:   cal.id,
          timeMin:      timeMin.toISOString(),
          timeMax:      timeMax.toISOString(),
          singleEvents: true,
          orderBy:      'startTime',
        })
      )
    );

    // Merge + deduplicate by event id
    const seen   = new Set();
    const events = [];
    results.forEach(r => {
      if (r.status !== 'fulfilled') return;
      for (const ev of (r.value.result.items || [])) {
        if (!seen.has(ev.id)) {
          seen.add(ev.id);
          events.push(ev);
        }
      }
    });

    return events;
  } catch (e) {
    console.error('Calendar list error:', e);
    return [];
  }
}

const BENCH_COLOR_ID = {
  Luthier:     '2',  // Sage
  Electronics: '9',  // Blueberry
  Setup:       '6',  // Tangerine
  Fretwork:    '3',  // Grape
  Wiring:      '7',  // Peacock
  Finishing:   '5',  // Banana
  Admin:       '8',  // Graphite
};

export async function createEvent(job, date, hour, durationHours, minute = 0) {
  if (!isSignedIn()) return null;
  const start = new Date(date);
  start.setHours(hour, minute, 0, 0);
  const end = new Date(start);
  end.setTime(start.getTime() + Math.min(durationHours, 3) * 60 * 60 * 1000);

  const event = {
    summary: `#${job.job} • ${job.mfr} ${job.model}`,
    description: `Bench: ${job.bench}\nDesc: ${job.desc}`,
    colorId: BENCH_COLOR_ID[job.bench] || '8',
    start: { dateTime: start.toISOString(), timeZone: 'Pacific/Auckland' },
    end: { dateTime: end.toISOString(), timeZone: 'Pacific/Auckland' },
  };

  try {
    await ensureCalendarApi();
    const resp = await window.gapi.client.calendar.events.insert({ calendarId: CALENDAR_ID, resource: event });
    return resp.result;
  } catch (e) {
    console.error('Create event error:', e);
    return null;
  }
}

export async function updateEvent(eventId, job, date, hour, durationHours, minute = 0) {
  if (!isSignedIn()) return null;
  const start = new Date(date);
  start.setHours(hour, minute, 0, 0);
  const end = new Date(start);
  end.setTime(start.getTime() + Math.min(durationHours, 3) * 60 * 60 * 1000);

  const event = {
    summary: `#${job.job} • ${job.mfr} ${job.model}`,
    description: `Bench: ${job.bench}\nDesc: ${job.desc}`,
    colorId: BENCH_COLOR_ID[job.bench] || '8',
    start: { dateTime: start.toISOString(), timeZone: 'Pacific/Auckland' },
    end: { dateTime: end.toISOString(), timeZone: 'Pacific/Auckland' },
  };

  try {
    await ensureCalendarApi();
    const resp = await window.gapi.client.calendar.events.update({
      calendarId: CALENDAR_ID, eventId, resource: event,
    });
    return resp.result;
  } catch (e) {
    console.error('Update event error:', e);
    return null;
  }
}

export async function deleteEvent(eventId) {
  if (!isSignedIn()) return;
  try {
    await ensureCalendarApi();
    await window.gapi.client.calendar.events.delete({ calendarId: CALENDAR_ID, eventId });
  } catch (e) {
    console.error('Delete event error:', e);
  }
}

export function parsePersonalBlocks(events, weekDays) {
  const blocks = [];
  events.forEach(ev => {
    if (!ev.summary?.includes('#PERSONAL')) return;
    const start = new Date(ev.start?.dateTime || ev.start?.date);
    const end = new Date(ev.end?.dateTime || ev.end?.date);
    const dayIdx = weekDays.findIndex(d => d.toDateString() === start.toDateString());
    if (dayIdx < 0) return;
    for (let h = start.getHours(); h < end.getHours(); h++) {
      blocks.push({ dayIdx, hour: h });
    }
  });
  return blocks;
}
