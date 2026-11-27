import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ConnectionProviders from "./ConnectionProviders";
import { SettingActionButton } from "./SettingsControls";

const mocks = vi.hoisted(() => ({
  snapshot: { preferences: { installed: {} as Record<string, unknown> }, catalog: [], settingsPages: [] as unknown[], safeMode: false, busy: false, status: {} },
  request: vi.fn(),
  revoke: vi.fn(),
}));
vi.mock("../extensions/service", () => ({ extensionService: { subscribe: () => () => {}, getSnapshot: () => mocks.snapshot } }));
vi.mock("../extensions/ExtensionMount", () => ({ ExtensionMount: () => <div>PLUGIN MANAGEMENT</div> }));
vi.mock("./CalendarFeedManager", () => ({ default: ({ historyOnly }: { historyOnly?: boolean }) => <div>{historyOnly ? "HISTORY LINK" : "SHARED LINK"}</div> }));

let renderer: ReactTestRenderer | undefined;
const navigate = vi.fn();
const props = { lang: "en" as const, onSelect: navigate, errorMessage: String, caldav: <div>CALDAV</div>, externalCalendar: <div>EXTERNAL</div>, mcp: <div>MCP SETTINGS</div>, bridge: <div>BRIDGE</div> };
const output = () => JSON.stringify(renderer?.toJSON());
const view = async (anchor?: string) => { await act(async () => { const element = <ConnectionProviders {...props} anchor={anchor} />; if (renderer) renderer.update(element); else renderer = create(element); }); };
const click = async (label: string) => {
  const button = renderer!.root.findAllByType(SettingActionButton).find(node => node.props.children === label);
  if (!button) throw new Error("Missing action: " + label);
  await act(async () => button.props.onClick());
};
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  mocks.snapshot.preferences.installed = {};
  mocks.snapshot.settingsPages = [];
  mocks.request.mockReset().mockResolvedValue({ pairId: "pair", status: "active", conflicts: [] });
  mocks.revoke.mockReset();
  navigate.mockClear();
  vi.stubGlobal("document", { hidden: false });
  vi.stubGlobal("window", { plannerApi: {
    getAuthState: async () => ({ mode: "cloud", user: { id: "account" } }),
    requestSuperProductivitySync: mocks.request,
    getCalDavCredential: async () => null,
    listExternalCalendars: async () => ({ sources: [{}] }),
    listCalendarFeedTokens: async () => [{ id: "token" }],
    revokeCalendarFeedToken: mocks.revoke,
  }, setInterval: () => 1, clearInterval: () => {}, addEventListener: () => {}, removeEventListener: () => {} });
});
afterEach(async () => { if (renderer) await act(async () => renderer!.unmount()); renderer = undefined; vi.unstubAllGlobals(); });

function installed() {
  mocks.snapshot.preferences.installed = { "official:super-productivity-sync": { enabled: true, manifest: { id: "super-productivity-sync" } } };
  mocks.snapshot.settingsPages = [{ id: "page", owner: "official:super-productivity-sync", name: "Super Productivity Sync" }];
}
describe("compact connection navigation", () => {
  it("shows paired apps, hides available providers and keeps credentials separate", async () => {
    installed();
    await view();
    expect(output()).toContain("Super Productivity");
    expect(output()).toContain("Paired");
    expect(output()).not.toContain("Notion Calendar");
    expect(output()).not.toContain("SHARED LINK");
    await click("Add");
    expect(navigate).toHaveBeenLastCalledWith("connection-add");
    await view("connection-add");
    expect(output()).toContain("Notion Calendar");
    expect(output()).not.toContain("Super Productivity");
    await view("connection-advanced");
    expect(output()).toContain("Shared calendar subscription");
    expect(output()).not.toContain("SHARED LINK");
    await view("calendar-feed");
    expect(output()).toContain("SHARED LINK");
    expect(mocks.revoke).not.toHaveBeenCalled();
  });
  it("hides pairing and history controls for a paired app until requested", async () => {
    installed();
    await view("connection-super-productivity");
    expect(output()).toContain("remote availability unknown");
    expect(output()).not.toContain("PLUGIN MANAGEMENT");
    expect(output()).not.toContain("HISTORY LINK");
    expect(output()).not.toContain("SP companion");
    await click("Set up");
    expect(output()).toContain("HISTORY LINK");
    await click("Open");
    expect(output()).toContain("PLUGIN MANAGEMENT");
  });
  it("only shows installation after the user starts an unpaired setup", async () => {
    mocks.request.mockRejectedValue(new Error("Connection not found"));
    await view("connection-super-productivity");
    expect(output()).toContain("Not paired");
    expect(output()).not.toContain("Install and enable");
    await click("Connect");
    expect(output()).toContain("Install and enable");
    expect(output()).not.toContain("PLUGIN MANAGEMENT");
  });
  it("reveals the actual conflict management page and never marks sync healthy", async () => {
    installed();
    mocks.request.mockResolvedValue({ pairId: "pair", status: "active", conflicts: [{}] });
    await view("connection-super-productivity");
    expect(output()).toContain("Sync conflicts");
    expect(output()).toContain("1 conflicts need review");
    expect(output()).toContain("PLUGIN MANAGEMENT");
  });
});
