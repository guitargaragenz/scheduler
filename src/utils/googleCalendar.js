const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || '';
const CALENDAR_ID = 'guitargaragenz@gmail.com';
const SCOPES = 'https://www.googleapis.com/auth/calendar';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';

let gapiInited = false;
let gisInited = false;
let tokenClient = null;

export function isConfigured() {
  return Boolean(CLIENT_ID && API_KEY);
}

export async function initGoogleApi() {
  if (!isConfigured()) return false;

  return new Promise((resolve) => {
    const gapiScript = document.createElement('script');
    gapiScript.src = 'https://apis.google.com/js/api.js';
    gapiScript.onload = () => {
      window.gapi.load('client', async () => {
        await window.gapi.client.init({ apiKey: API_KEY, discoveryDocs: [DISCOVERY_DOC] });
        gapiInited = true;
        if (gisInited) resolve(true);
      });
    };
    document.body.appendChild(gapiScript);

    const gisScript = document.createElement('script');
    gisScript.src = 'https://accounts.google.com/gsi/client';
    gisScript.onload = () => {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: '',
      });
      gisInited = true;
      if (gapiInited) resolve(true);
    };
    document.body.appendChild(gisScript);
  });
}

export function requestAuth() {
  return new Promise((resolve, reject) => {
    if (!tokenClient) { reject(new Error('GIS not initialized')); return; }
    tokenClient.callback = (resp) => {
      if (resp.error) reject(new Error(resp.error));
      else resolve(resp);
    };
    tokenClient.requestAccessToken({ prompt: 'consent' });
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
    // Fetch all calendars then merge events from each
    const calList = await window.gapi.client.calendar.calendarList.list();
    const calendars = calList.result.items || [];
    const results = await Promise.all(calendars.map(cal =>
      window.gapi.client.calendar.events.list({
        calendarId: cal.id,
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      }).then(r => r.result.items || []).catch(() => [])
    ));
    return results.flat();
  } catch (e) {
    console.error('Calendar list error:', e);
    return [];
  }
}

export async function createEvent(job, date, hour, durationHours) {
  if (!isSignedIn()) return null;
  const start = new Date(date);
  start.setHours(hour, 0, 0, 0);
  const end = new Date(start);
  end.setHours(hour + Math.min(durationHours, 3), 0, 0, 0);

  const event = {
    summary: `#${job.job} • ${job.mfr} ${job.model}`,
    description: `Bench: ${job.bench}\nDesc: ${job.desc}`,
    colorId: '8',
    start: { dateTime: start.toISOString(), timeZone: 'Pacific/Auckland' },
    end: { dateTime: end.toISOString(), timeZone: 'Pacific/Auckland' },
  };

  try {
    const resp = await window.gapi.client.calendar.events.insert({ calendarId: CALENDAR_ID, resource: event });
    return resp.result;
  } catch (e) {
    console.error('Create event error:', e);
    return null;
  }
}

export async function updateEvent(eventId, job, date, hour, durationHours) {
  if (!isSignedIn()) return null;
  const start = new Date(date);
  start.setHours(hour, 0, 0, 0);
  const end = new Date(start);
  end.setHours(hour + Math.min(durationHours, 3), 0, 0, 0);

  const event = {
    summary: `#${job.job} • ${job.mfr} ${job.model}`,
    description: `Bench: ${job.bench}\nDesc: ${job.desc}`,
    colorId: '8',
    start: { dateTime: start.toISOString(), timeZone: 'Pacific/Auckland' },
    end: { dateTime: end.toISOString(), timeZone: 'Pacific/Auckland' },
  };

  try {
    const resp = await window.gapi.client.calendar.events.update({
      calendarId: CALENDAR_ID, eventId, resource: event
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
