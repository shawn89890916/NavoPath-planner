import { DOMParser, type Element } from "@xmldom/xmldom";
import type { CalendarEvent } from "../../src/types";
import { appointmentOverlaps, eventFile, eventUid, readAppointment, writeAppointment } from "./caldavEvents.ts";

const DAV = "DAV:";
const CAL = "urn:ietf:params:xml:ns:caldav";
const CS = "http://calendarserver.org/ns/";
const APPLE = "http://apple.com/ns/ical/";
const ROOT = "/caldav/";
const LIMIT = 65_536;
const METHODS = "OPTIONS, PROPFIND, REPORT, GET, HEAD, PUT, DELETE";
const COMMON = { DAV: "1, calendar-access", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const XML = '<?xml version="1.0" encoding="utf-8"?>';
const NAMESPACES = 'xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:cs="http://calendarserver.org/ns/" xmlns:a="http://apple.com/ns/ical/"';
const STATUS = "HTTP/1.1 ";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type CalDavAccount = { userId: string; timezone: string };
type Workspace = { events?: CalendarEvent[]; sync?: { deleted?: Record<string, string> }; savedAt?: string };
export type CalDavProfile = { data: Workspace; settings: Record<string, unknown>; revision: number };
type Store = {
  authenticate(username: string, password: string): Promise<CalDavAccount | null>;
  load(userId: string): Promise<CalDavProfile>;
  save(userId: string, profile: CalDavProfile, data: Workspace): Promise<boolean>;
};
type Property = { namespace: string; name: string };
type Properties = Map<string, [Property, string]>;

function xml(value: string) {
  return value.replace(/[<>&"']/g, char => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[char]!);
}

function response(status: number, body: string | null = null, headers: HeadersInit = {}) {
  return new Response(body, { status, headers: { ...COMMON, ...headers } });
}

function xmlResponse(status: number, tag: string, body: string) {
  return response(status, XML + "<" + tag + " " + NAMESPACES + ">" + body + "</" + tag + ">", {
    "Content-Type": "application/xml; charset=utf-8",
  });
}

function href(path: string) {
  return "<d:href>" + xml(path) + "</d:href>";
}

function prop(namespace: string, name: string): Property {
  return { namespace, name };
}

function key(property: Property) {
  return property.namespace + "|" + property.name;
}

function tag(property: Property, value = "") {
  const prefix = { [DAV]: "d", [CAL]: "c", [CS]: "cs", [APPLE]: "a" }[property.namespace];
  const name = prefix ? prefix + ":" + property.name : property.name;
  const declaration = prefix ? "" : ' xmlns="' + xml(property.namespace) + '"';
  return value ? "<" + name + declaration + ">" + value + "</" + name + ">" : "<" + name + declaration + "/>";
}

function propResult(path: string, properties: Properties, requested?: Property[], namesOnly = false) {
  const available = requested || [...properties.values()].map(([name]) => name);
  const present: string[] = [];
  const missing: string[] = [];
  for (const name of available) {
    const value = properties.get(key(name));
    if (value) present.push(tag(name, namesOnly ? "" : value[1]));
    else missing.push(tag(name));
  }
  const block = (items: string[], status: string) => items.length === 0 ? "" :
    "<d:propstat><d:prop>" + items.join("") + "</d:prop><d:status>" + STATUS + status + "</d:status></d:propstat>";
  return "<d:response>" + href(path) + block(present, "200 OK") + block(missing, "404 Not Found") + "</d:response>";
}

function set(properties: Properties, namespace: string, name: string, value = "") {
  const property = prop(namespace, name);
  properties.set(key(property), [property, value]);
}

function children(element: Element) {
  return Array.from(element.childNodes).filter((node): node is Element => node.nodeType === 1);
}

function requestedProperties(element: Element) {
  const requested = children(element).find(node => node.namespaceURI === DAV && node.localName === "prop");
  return requested && children(requested).map(node => prop(node.namespaceURI || "", node.localName || node.nodeName));
}

class RequestError extends Error {
  constructor(status: number) { super("Invalid calendar request"); this.status = status; }
  readonly status: number;
}

async function readBody(request: Request) {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false });
  let size = 0;
  let result = "";
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > LIMIT) throw new RequestError(413);
      result += decoder.decode(part.value, { stream: true });
    }
    return result + decoder.decode();
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error instanceof RequestError ? error : new RequestError(400);
  }
}

function parseXml(body: string) {
  if (/<!DOCTYPE|<!ENTITY/i.test(body)) throw new RequestError(400);
  try {
    const root = new DOMParser({ onError: () => { throw new Error("Invalid XML"); } }).parseFromString(body, "text/xml").documentElement;
    if (!root) throw new Error("Missing document element");
    return root;
  } catch {
    throw new RequestError(400);
  }
}

function credentials(header: string | null) {
  const match = /^Basic ([A-Za-z0-9+/]+={0,2})$/i.exec(header || "");
  if (!match || match[1].length > 160) return null;
  try {
    const [username, password, extra] = atob(match[1]).split(":");
    return extra === undefined && UUID.test(username) && /^nvd_[a-f0-9]{64}$/.test(password)
      ? { username, password } : null;
  } catch {
    return null;
  }
}

function resourceName(path: string, collection: string) {
  if (!path.startsWith(collection)) return null;
  try {
    const name = decodeURIComponent(path.slice(collection.length));
    return name.length <= 250 && /^[^/\\\u0000-\u001f\u007f]+\.ics$/i.test(name) ? name : null;
  } catch {
    return null;
  }
}

async function representation(event: CalendarEvent, timezone: string) {
  try {
    const body = writeAppointment(event, timezone);
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body)));
    const etag = '"' + Array.from(digest, byte => byte.toString(16).padStart(2, "0")).join("") + '"';
    return { body, etag };
  } catch {
    return null;
  }
}

function matches(header: string, etag: string | undefined, weak = false) {
  if (!etag) return false;
  return header.split(",").some(value => {
    const candidate = value.trim();
    return candidate === "*" || (weak ? candidate.replace(/^W\//, "") : candidate) === etag;
  });
}

function checkConditions(request: Request, etag?: string) {
  const match = request.headers.get("If-Match");
  const none = request.headers.get("If-None-Match");
  if (match && !matches(match, etag)) return 412;
  if (none && matches(none, etag, true)) return request.method === "GET" || request.method === "HEAD" ? 304 : 412;
  return 0;
}

function resourceHref(collection: string, file: string) {
  return collection + encodeURIComponent(file);
}

function privilegeSet(writable: boolean) {
  const privileges = writable ? ["read", "write", "write-content", "bind", "unbind"] : ["read"];
  return privileges.map(name => "<d:privilege><d:" + name + "/></d:privilege>").join("");
}

function collections(account: CalDavAccount) {
  const principal = ROOT + "principals/" + account.userId + "/";
  const home = ROOT + "calendars/" + account.userId + "/";
  return { principal, home, collection: home + "navopath/" };
}

function collectionProperties(path: string, account: CalDavAccount, revision?: number) {
  const { principal, home, collection } = collections(account);
  const properties: Properties = new Map();
  set(properties, DAV, "displayname", "NavoPath");
  set(properties, DAV, "current-user-principal", href(principal));
  set(properties, DAV, "principal-collection-set", href(ROOT + "principals/"));
  set(properties, DAV, "current-user-privilege-set", privilegeSet(path === collection));
  set(properties, DAV, "owner", href(principal));
  set(properties, DAV, "resourcetype", "<d:collection/>" + (path === principal ? "<d:principal/>" : path === collection ? "<c:calendar/>" : ""));
  if (path === principal || path === ROOT) {
    set(properties, DAV, "principal-URL", href(principal));
    set(properties, CAL, "calendar-home-set", href(home));
  }
  if (path === collection) {
    set(properties, DAV, "supported-report-set", ["calendar-query", "calendar-multiget"].map(name =>
      "<d:supported-report><d:report><c:" + name + "/></d:report></d:supported-report>").join(""));
    set(properties, CAL, "supported-calendar-component-set", '<c:comp name="VEVENT"/>');
    set(properties, CAL, "supported-calendar-data", '<c:calendar-data content-type="text/calendar" version="2.0"/>');
    set(properties, CAL, "calendar-description", "NavoPath");
    set(properties, CAL, "max-resource-size", String(LIMIT));
    set(properties, APPLE, "calendar-color", "#584D3DFF");
    if (revision !== undefined) set(properties, CS, "getctag", String(revision));
  }
  return properties;
}

function appointments(profile: CalDavProfile) {
  return (profile.data.events || []).filter(event => event.calendarKind === "appointment");
}

async function eventResponse(event: CalendarEvent, collection: string, timezone: string, requested?: Property[], namesOnly = false) {
  const item = await representation(event, timezone);
  if (!item) return "";
  const properties: Properties = new Map();
  set(properties, DAV, "resourcetype");
  set(properties, DAV, "current-user-privilege-set", privilegeSet(true));
  set(properties, DAV, "displayname", xml(event.title));
  set(properties, DAV, "getcontenttype", "text/calendar; charset=utf-8");
  set(properties, DAV, "getetag", xml(item.etag));
  if (requested?.some(property => property.namespace === CAL && property.name === "calendar-data")) {
    set(properties, CAL, "calendar-data", xml(item.body));
  }
  return propResult(resourceHref(collection, eventFile(event)), properties, requested, namesOnly);
}

function queryTime(value: string | null, fallback: number) {
  if (!value) return fallback;
  const match = /^(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)Z$/.exec(value);
  const time = match && Date.parse(match[1] + "-" + match[2] + "-" + match[3] + "T" + match[4] + ":" + match[5] + ":" + match[6] + "Z");
  if (time === null || !Number.isFinite(time)) throw new RequestError(400);
  return time;
}

async function calendarReport(request: Request, events: CalendarEvent[], collection: string, timezone: string) {
  const root = parseXml(await readBody(request));
  if (root.namespaceURI !== CAL) return xmlResponse(403, "d:error", "<d:supported-report/>");
  const wanted = requestedProperties(root);
  if (root.localName === "calendar-multiget") {
    const paths = children(root).filter(node => node.namespaceURI === DAV && node.localName === "href");
    if (paths.length > 500) return response(413);
    const byFile = new Map(events.map(event => [eventFile(event), event]));
    const origin = new URL(request.url).origin;
    const results = await Promise.all(paths.map(async node => {
      const value = node.textContent?.trim() || "";
      let requestedUrl: URL;
      try { requestedUrl = new URL(value, origin); } catch { return ""; }
      const file = requestedUrl.origin === origin ? resourceName(requestedUrl.pathname, collection) : null;
      const event = file && byFile.get(file);
      const found = event && await eventResponse(event, collection, timezone, wanted);
      return found || "<d:response>" + href(requestedUrl.pathname) + "<d:status>" + STATUS + "404 Not Found</d:status></d:response>";
    }));
    return xmlResponse(207, "d:multistatus", results.join(""));
  }
  if (root.localName !== "calendar-query") return xmlResponse(403, "d:error", "<d:supported-report/>");
  const filters = Array.from(root.getElementsByTagNameNS(CAL, "comp-filter"));
  if (filters.some(node => !["VCALENDAR", "VEVENT"].includes(node.getAttribute("name") || "")) ||
    root.getElementsByTagNameNS(CAL, "prop-filter").length > 0) {
    return xmlResponse(403, "d:error", "<c:supported-filter/>");
  }
  const range = root.getElementsByTagNameNS(CAL, "time-range").item(0);
  const start = queryTime(range?.getAttribute("start") || null, -Infinity);
  const end = queryTime(range?.getAttribute("end") || null, Infinity);
  if (start >= end) return response(400);
  const matching = range ? events.filter(event => {
    try { return appointmentOverlaps(event, start, end, timezone); } catch { return false; }
  }) : events;
  const results = await Promise.all(matching.map(event => eventResponse(event, collection, timezone, wanted)));
  return xmlResponse(207, "d:multistatus", results.join(""));
}

async function writeResource(request: Request, store: Store, account: CalDavAccount, file: string) {
  const body = request.method === "PUT" ? await readBody(request) : "";
  let parsed: ReturnType<typeof readAppointment> | undefined;
  if (request.method === "PUT") {
    try { parsed = readAppointment(body, account.timezone); }
    catch { return xmlResponse(403, "d:error", "<c:valid-calendar-object-resource/>"); }
  }
  let originalEtag: string | undefined;
  for (let attempt = 0; attempt < 4; attempt++) {
    const profile = await store.load(account.userId);
    const events = appointments(profile);
    const existing = events.find(event => eventFile(event) === file);
    const item = existing ? await representation(existing, account.timezone) : null;
    const status = checkConditions(request, item?.etag);
    if (status) return response(status);
    if (attempt > 0 && originalEtag !== item?.etag) return response(409);
    originalEtag = item?.etag;
    if (!existing && request.method === "DELETE") return response(404);
    const timestamp = new Date().toISOString();
    let next: Workspace = { ...profile.data, savedAt: timestamp };
    let result: Response;
    if (parsed) {
      const duplicate = events.find(event => event.id !== existing?.id && eventUid(event) === parsed.uid);
      if (duplicate || (existing && eventUid(existing) !== parsed.uid)) {
        const conflictHref = resourceHref(collections(account).collection, duplicate ? eventFile(duplicate) : file);
        return xmlResponse(403, "d:error", "<c:no-uid-conflict>" + href(conflictHref) + "</c:no-uid-conflict>");
      }
      const updated: CalendarEvent = {
        ...existing,
        ...parsed.fields,
        id: existing?.id || "caldav_" + crypto.randomUUID(),
        fixedCourse: true,
        calendarKind: "appointment",
        category: existing?.category || "personal",
        createdAt: existing?.createdAt || timestamp,
        updatedAt: timestamp,
        caldav: { file, uid: parsed.uid, ics: body, projection: parsed.projection },
      };
      if (item?.body === body) return response(204, null, { ETag: item.etag });
      const written = await representation(updated, account.timezone);
      if (!written) return response(400);
      next.events = existing
        ? (profile.data.events || []).map(event => event.id === existing.id ? updated : event)
        : [...(profile.data.events || []), updated];
      result = response(existing ? 204 : 201, null, { ETag: written.etag });
    } else {
      next.events = (profile.data.events || []).filter(event => event.id !== existing!.id);
      next.sync = { ...profile.data.sync, deleted: { ...profile.data.sync?.deleted, ["events:" + existing!.id]: timestamp } };
      result = response(204);
    }
    if (await store.save(account.userId, profile, next)) return result;
  }
  return response(409);
}

export async function handleCalDav(request: Request, store: Store): Promise<Response> {
  const path = new URL(request.url).pathname;
  if (request.method === "OPTIONS") return response(200, null, { Allow: METHODS });
  const auth = credentials(request.headers.get("Authorization"));
  try {
    const account = auth && await store.authenticate(auth.username, auth.password);
    if (!account) return response(401, null, { "WWW-Authenticate": 'Basic realm="NavoPath CalDAV", charset="UTF-8"' });
    const { principal, home, collection } = collections(account);
    const folder = path.endsWith("/") ? path : path + "/";
    const isFolder = [ROOT, ROOT + "principals/", principal, home, collection].includes(folder);
    const file = isFolder ? null : resourceName(path, collection);
    if (!isFolder && !file) return response(404);
    if (file && (request.method === "PUT" || request.method === "DELETE")) {
      return await writeResource(request, store, account, file);
    }
    if (request.method === "REPORT" && folder === collection) {
      return await calendarReport(request, appointments(await store.load(account.userId)), collection, account.timezone);
    }
    if (request.method === "PROPFIND") {
      const depth = request.headers.get("Depth") || "0";
      if (depth !== "0" && depth !== "1") return xmlResponse(403, "d:error", "<d:propfind-finite-depth/>");
      const body = await readBody(request);
      const root = body ? parseXml(body) : null;
      if (root && (root.namespaceURI !== DAV || root.localName !== "propfind")) return response(400);
      const wanted = root ? requestedProperties(root) : undefined;
      const namesOnly = root && children(root).some(node => node.namespaceURI === DAV && node.localName === "propname");
      const profile = file || folder === collection || (folder === home && depth === "1") ? await store.load(account.userId) : null;
      const events = profile ? appointments(profile) : [];
      if (file) {
        const event = events.find(item => eventFile(item) === file);
        const result = event && await eventResponse(event, collection, account.timezone, wanted, Boolean(namesOnly));
        return result ? xmlResponse(207, "d:multistatus", result) : response(404);
      }
      const folderResult = (value: string) => propResult(value, collectionProperties(value, account, profile?.revision), wanted, Boolean(namesOnly));
      const results = [folderResult(folder)];
      if (depth === "1" && folder === home) results.push(folderResult(collection));
      if (depth === "1" && folder === ROOT + "principals/") results.push(folderResult(principal));
      if (depth === "1" && folder === collection) {
        results.push(...await Promise.all(events.map(event => eventResponse(event, collection, account.timezone, wanted, Boolean(namesOnly)))));
      }
      return xmlResponse(207, "d:multistatus", results.join(""));
    }
    if (file && (request.method === "GET" || request.method === "HEAD")) {
      const event = appointments(await store.load(account.userId)).find(item => eventFile(item) === file);
      const item = event && await representation(event, account.timezone);
      if (!item) return response(404);
      const status = checkConditions(request, item.etag);
      const headers = { ETag: item.etag, "Content-Type": "text/calendar; charset=utf-8" };
      return status ? response(status, null, headers) : response(200, request.method === "HEAD" ? null : item.body, headers);
    }
    return response(405, null, { Allow: METHODS });
  } catch (error) {
    return error instanceof RequestError ? response(error.status) : response(503, null, { "Retry-After": "5" });
  }
}
