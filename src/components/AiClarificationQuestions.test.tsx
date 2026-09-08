import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";
import AiClarificationQuestions from "./AiClarificationQuestions";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const clarifications = [
  { id: "goal", question: "What should be planned?", options: ["Study", "Exercise"] },
  { id: "length", question: "How long?", options: ["30 minutes", "60 minutes"] },
];

function render(onSubmit: (message: string) => void | Promise<unknown>) {
  let tree!: ReactTestRenderer;
  act(() => { tree = create(<AiClarificationQuestions clarifications={clarifications} lang="en" onSubmit={onSubmit} />); });
  return tree;
}

describe("AiClarificationQuestions", () => {
  it("keeps answers in the card and submits question plus answer text once", () => {
    const onSubmit = vi.fn();
    const tree = render(onSubmit);
    const buttons = tree.root.findAllByType("button");
    act(() => { buttons.find((button) => button.children.includes("Study"))?.props.onClick(); });
    const inputs = tree.root.findAllByType("input");
    act(() => { inputs[1].props.onChange({ target: { value: "45 minutes" } }); });
    act(() => { tree.root.findAllByType("button").find((button) => button.children.includes("Send answers"))?.props.onClick(); });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toContain("What should be planned?\nStudy");
    expect(onSubmit.mock.calls[0][0]).toContain("How long?\n45 minutes");
  });

  it("retains answers and locks controls when submission is pending", async () => {
    let resolve!: (value: false) => void;
    const onSubmit = vi.fn(() => new Promise<false>((done) => { resolve = done; }));
    const tree = render(onSubmit);
    const buttons = tree.root.findAllByType("button");
    act(() => { buttons.find((button) => button.children.includes("Study"))?.props.onClick(); });
    act(() => { buttons.find((button) => button.children.includes("30 minutes"))?.props.onClick(); });
    act(() => { tree.root.findAllByType("button").find((button) => button.children.includes("Send answers"))?.props.onClick(); });
    act(() => { tree.root.findAllByType("button").find((button) => button.children.includes("Sending…"))?.props.onClick(); });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(tree.root.findAllByType("button").some((button) => button.children.includes("Sending…") && button.props.disabled)).toBe(true);
    await act(async () => { resolve(false); });
    expect(tree.root.findAllByType("input")[0].props.value).toBe("Study");
    expect(tree.root.findAllByType("input")[1].props.value).toBe("30 minutes");
  });

  it("keeps an older card readable without allowing submission", () => {
    const onSubmit = vi.fn();
    let tree!: ReactTestRenderer;
    act(() => { tree = create(<AiClarificationQuestions clarifications={clarifications} lang="en" disabled onSubmit={onSubmit} />); });
    act(() => { tree.root.findAllByType("button").find((button) => button.children.includes("Study"))?.props.onClick(); });
    act(() => { tree.root.findAllByType("button").find((button) => button.children.includes("30 minutes"))?.props.onClick(); });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(tree.root.findAllByType("fieldset").every((fieldset) => fieldset.props.disabled)).toBe(true);
    expect(tree.root.findAllByType("button").find((button) => button.children.includes("Send answers"))?.props.disabled).toBe(true);
  });
});
