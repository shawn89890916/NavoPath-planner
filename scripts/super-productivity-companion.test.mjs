import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { unzipSync, strFromU8 } from "fflate";

const dir = new URL("../integrations/super-productivity-navopath/", import.meta.url);
const code = readFileSync(new URL("plugin.js", dir), "utf8");
const manifest = JSON.parse(readFileSync(new URL("manifest.json", dir), "utf8"));
test("companion ZIP has the exact host-runtime sources and manifest", () => {
  const archive = unzipSync(new Uint8Array(readFileSync(new URL("navopath-sync-" + manifest.version + ".zip", dir))));
  assert.deepEqual(Object.keys(archive).sort(), ["LICENSE", "manifest.json", "plugin.js"]);
  for (const filename of Object.keys(archive)) assert.equal(strFromU8(archive[filename]), readFileSync(new URL(filename, dir), "utf8"));
  assert.ok(!manifest.iFrame && !manifest.sidePanel);
  assert.ok(manifest.hooks.includes("taskUpdate"));
});

test("host runtime polls without mounting the UI and schedules a newly imported task", async () => {
  const nodes = new Map();
  const el = () => ({
    hidden: false, disabled: false, textContent: "", className: "", children: [], dataset: {},
    setAttribute() {}, append(...items) { this.children.push(...items); },
    replaceChildren(...items) { this.children = items; },
    get childElementCount() { return this.children.length; },
    querySelectorAll() { return []; }, remove() {},
  });
  const root = { ...el(), getElementById(id) { if (!nodes.has(id)) nodes.set(id, el()); return nodes.get(id); } };
  const document = { createElement(tag) { return { ...el(), attachShadow: () => root, ...(tag === "template" ? { content: { cloneNode: () => el() } } : {}) }; }, getElementById: () => null };
  const pairId = "11111111-1111-4111-8111-111111111111";
  let ready, unload, interval, timeout, polls = 0, uiOpened = 0, persisted = "";
  const hooks = new Map(), tasks = [], updates = [];
  const state = { pairId, status: "active", conflicts: [] };
  const scheduledAt = "2026-11-26T10:00";
  const API = {
    registerConfigHandler() {}, registerMenuEntry() {}, openDialog() { uiOpened++; return Promise.resolve(); },
    Hooks: { TASK_UPDATE: "taskUpdate", TASK_CREATED: "taskCreated", TASK_DELETE: "taskDelete", TASK_COMPLETE: "taskComplete", PROJECT_LIST_UPDATE: "projectListUpdate" },
    registerHook(name, callback) { hooks.set(name, callback); },
    onReady(callback) { ready = callback; }, onUnload(callback) { unload = callback; },
    async getSecret() { return JSON.stringify({ pairId, token: "local-test-token" }); },
    async setSecret() {}, async deleteSecret() {},
    async loadSyncedData() { return JSON.stringify({ pairId, links: { tasks: {}, projects: {} }, tombstones: {} }); },
    async persistDataSynced(value) { persisted = value; },
    async getAllProjects() { return [{ id: "INBOX_PROJECT", title: "Inbox" }]; }, async getAllTags() { return []; },
    async getTasks() { return tasks; },
    async addTask(fields) { assert.ok(!Object.hasOwn(fields, "dueWithTime")); tasks.push({ ...fields, id: "sp-created" }); return "sp-created"; },
    async updateTask(id, patch) { updates.push({ id, patch }); Object.assign(tasks.find(task => task.id === id), patch); },
    async deleteTask() {}, async addProject() {}, async updateProject(id) { assert.notEqual(id, "INBOX_PROJECT"); }, async deleteProject(id) { assert.notEqual(id, "INBOX_PROJECT"); }, async addTag() {},
    async request(url, options) {
      assert.equal(options.headers.Authorization, "Bearer local-test-token");
      if (url.includes("/state?")) return state;
      assert.ok(url.endsWith("/snapshot"));
      assert.ok(!options.body.snapshot.projects.some(project => project.id === "INBOX_PROJECT"));
      polls++;
      return { ...state, assignments: [], actions: polls === 1 ? [{ kind: "project", syncId: "stale-inbox", id: "INBOX_PROJECT", fields: {}, deleted: true }, { kind: "task", syncId: "sync-task", fields: { title: "Scheduled task", scheduledAt, scheduledMinutes: 90, estimateMinutes: 90 } }] : [] };
    },
  };
  vm.runInNewContext(code, { PluginAPI: API, document, console, setInterval(fn) { interval = fn; return 1; }, clearInterval() { interval = undefined; }, setTimeout(fn) { timeout = fn; return 2; }, clearTimeout() { timeout = undefined; } });
  assert.equal(typeof ready, "function");
  await ready();
  assert.equal(polls, 1);
  assert.equal(uiOpened, 0);
  assert.equal(tasks[0].timeEstimate, 90 * 60_000);
  assert.equal(updates[0].patch.dueWithTime, new Date(scheduledAt).getTime());
  assert.equal(JSON.parse(persisted).links.tasks["sp-created"], "sync-task");
  assert.ok(!persisted.includes("local-test-token"));
  assert.equal(typeof interval, "function");
  interval();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(polls, 2);
  tasks[0].timeEstimate = 120 * 60_000;
  hooks.get("taskUpdate")();
  assert.equal(typeof timeout, "function");
  await timeout();
  assert.equal(polls, 3);
  unload();
  assert.equal(interval, undefined);
});
