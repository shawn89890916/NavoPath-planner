// @ts-nocheck -- Worker tests run with Node.
import assert from "node:assert/strict";
import test from "node:test";
import { isPluginMcpDeclaration, pluginMcpGrant, SCHEDULE_TEMPLATE_PLUGIN } from "../../shared/pluginMcp.ts";
import { createScheduleTemplate, listScheduleTemplates, templateSlots, updateScheduleTemplate } from "./scheduleTemplates.ts";
import { listPluginMcpCapabilities, readPluginSettings, writePluginSettings } from "./pluginMcp.ts";
import { combineSyncSnapshot } from "./syncSnapshot.ts";

const stamp = "2026-11-20T00:00:00.000Z";
const later = "2026-11-20T00:01:00.000Z";
const profile = { data: { tasks: [{ id: "task", title: "Keep", updatedAt: stamp }], projects: [] }, settings: { language: "zh" }, revision: 1, updated_at: stamp };
const nightly = { label: "整理", start: "23:53", end: "00:12" };
const makeId = () => "generated-block";
const owner = "local:example";
const examplePlugin = {
  enabled: true, sha256: "a".repeat(64), installedAt: stamp,
  manifest: { kind: "plugin", name: "Example", mcp: { settings: { read: ["size"], write: ["size", "layout"] } } },
};
function settingsWithPlugin(granted: boolean) {
  return {
    ...profile.settings, extensions: { installed: { [owner]: examplePlugin }, removed: {} },
    extensionMcpAccess: granted ? { [owner]: pluginMcpGrant(examplePlugin) } : {},
    extensionConfigs: { [owner]: { size: 4, privateField: "keep", layout: "compact" }, "local:other": { size: 10 } },
  };
}

test("schedule templates edit both built-in and cloud records under their existing ID", () => {
  const builtIn = listScheduleTemplates(profile, "builtin:school", 0, 1).template;
  assert.equal(builtIn.title, "默认 1");
  assert.equal(builtIn.slots.length, 8);
  const changed = updateScheduleTemplate(profile, { id: builtIn.id, title: "我的课表", slots: templateSlots.parse([nightly]), expectedUpdatedAt: "" }, stamp, makeId);
  assert.deepEqual(changed.data.tasks, profile.data.tasks);
  assert.equal(changed.template.id, builtIn.id);
  assert.deepEqual(changed.template.slots, [{ id: makeId(), ...nightly }]);
  const saved = { ...profile, data: changed.data };
  assert.equal(listScheduleTemplates(saved, undefined, 0, 10).total, 2);
  assert.throws(() => updateScheduleTemplate(saved, { id: builtIn.id, title: "Stale", expectedUpdatedAt: "" }, later, makeId), /changed/);
  const edited = updateScheduleTemplate(saved, { id: builtIn.id, title: "Revised", expectedUpdatedAt: stamp }, later, makeId);
  assert.equal(edited.template.createdAt, stamp);
  assert.deepEqual(edited.template.slots, changed.template.slots);

  const legacy = { id: "legacy", title: "Legacy", slots: [{ id: "old", ...nightly }], createdAt: stamp, updatedAt: stamp };
  const custom = updateScheduleTemplate({ ...profile, data: { ...profile.data, scheduleTemplates: [legacy] } }, { id: legacy.id, title: "Current" }, later, makeId);
  assert.deepEqual(custom.data.scheduleTemplates, [{ ...legacy, title: "Current", updatedAt: later }]);
});

test("template creation preserves exact times, retries and deletion", () => {
  const input = { id: "template_test", title: "Night", slots: templateSlots.parse([nightly]) };
  const created = createScheduleTemplate(profile, input, stamp, makeId);
  assert.deepEqual(created.template.slots, [{ id: makeId(), ...nightly }]);
  assert.equal(createScheduleTemplate({ ...profile, data: created.data }, input, later, makeId).data, undefined);
  const removed = { ...profile, data: { ...profile.data, sync: { deleted: { "scheduleTemplates:template_test": later } } } };
  assert.throws(() => createScheduleTemplate(removed, input, later, makeId), /deleted/);
  assert.throws(() => createScheduleTemplate(profile, { ...input, slots: [nightly, nightly] }, stamp, makeId), /unique/);
  assert.equal(templateSlots.safeParse([{ ...nightly, start: "24:00" }]).success, false);
});

test("the account can turn off the official template tools", () => {
  for (const settings of [
    { featureTemplatesEnabled: false },
    { extensionMcpAccess: { [SCHEDULE_TEMPLATE_PLUGIN]: false } },
    { extensions: { installed: { [SCHEDULE_TEMPLATE_PLUGIN]: { ...examplePlugin, enabled: false } } } },
    { extensions: { removed: { [SCHEDULE_TEMPLATE_PLUGIN]: stamp } } },
  ]) {
    assert.deepEqual(listPluginMcpCapabilities(settings).native, []);
    assert.throws(() => listScheduleTemplates({ ...profile, settings }, undefined, 0, 10), /disabled/);
  }
});

test("plugin settings honor per-field approval and reapproval after package changes", () => {
  const settings = settingsWithPlugin(true);
  assert.equal(isPluginMcpDeclaration({ settings: { read: ["constructor"] } }), false);
  assert.deepEqual(listPluginMcpCapabilities(settings).settings[0].write, ["size", "layout"]);
  assert.throws(() => readPluginSettings(settingsWithPlugin(false), owner), /not granted/);
  assert.deepEqual(readPluginSettings(settings, owner), { size: 4 });
  assert.throws(() => writePluginSettings(settings, owner, { size: 8, privateField: "changed" }, later), /permission/);
  assert.throws(() => writePluginSettings(settings, owner, { layout: JSON.parse('{"__proto__":1}') }, later), /Invalid/);
  const written = writePluginSettings(settings, owner, { size: 8, layout: { mode: "wide" } }, later);
  assert.deepEqual(written.extensionConfigs[owner], { size: 8, privateField: "keep", layout: { mode: "wide" } });
  assert.equal(written.extensionConfigUpdatedAt[owner], later);
  assert.deepEqual(written.extensionConfigs["local:other"], { size: 10 });
  for (const changed of [{ sha256: "b".repeat(64) }, { enabled: false }, { installedAt: later }]) {
    const settingsWithChange = { ...settings, extensions: { installed: { [owner]: { ...examplePlugin, ...changed } } } };
    assert.throws(() => readPluginSettings(settingsWithChange, owner), /not granted/);
  }
});

test("folder bridge snapshots cannot give themselves plugin permissions or discard existing grants", () => {
  const existing = { [owner]: false };
  const data = profile.data;
  const input = { version: 1, accountId: "user", updatedAt: later, data, settings: settingsWithPlugin(true) };
  const merged = combineSyncSnapshot({ ...profile, settings: { extensionMcpAccess: existing } }, input, "user", later);
  assert.deepEqual(merged.settings.extensionMcpAccess, existing);
  assert.equal(combineSyncSnapshot(profile, input, "user", later).settings.extensionMcpAccess, undefined);
});
