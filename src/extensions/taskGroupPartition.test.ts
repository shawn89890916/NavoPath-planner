import { describe, expect, it } from "vitest";
import { resolveTaskGroups } from "./taskGroupPartition";
import type { ExtensionTaskGroup } from "./types";
const group = (id: string, resolve: ExtensionTaskGroup["resolve"]): ExtensionTaskGroup => ({ id, owner: id, name: id, resolve });
describe("host-owned candidate group partition", () => {
  it("claims existing tasks once in stable group and native candidate order", async () => {
    const a = group("a", () => ["b", "a", "b", "unknown"]), z = group("z", () => ["a", "c"]);
    const result = await resolveTaskGroups([z, a], ["a", "b", "c", "d"]);
    expect(result.map(item => [item.group.id, item.ids])).toEqual([["a", ["a", "b"]], ["z", ["c"]]]);
  });
  it("fails open when a resolver never settles", async () => {
    const a = group("a", () => new Promise(() => {}));
    const b = group("b", () => ["one"]);
    expect((await resolveTaskGroups([a, b], ["one", "two"], 5)).map(item => item.ids)).toEqual([[], ["one"]]);
  });
  it("leaves tasks available when a plugin throws or returns malformed data", async () => {
    const a = group("a", () => { throw Error("disabled"); });
    const b = group("b", () => null as unknown as string[]);
    const z = group("z", async () => ["x"]);
    expect((await resolveTaskGroups([a, b, z], ["x", "y"])).map(item => item.ids)).toEqual([[], [], ["x"]]);
  });
});
