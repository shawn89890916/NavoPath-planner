import { describe, expect, it } from "vitest";
import {
  NAVOPATH_SCHEDULE_SKILL_INSTALL_COMMAND,
  NAVOPATH_SCHEDULE_SKILL_PAGE,
  NAVOPATH_SCHEDULE_SKILL_RAW,
  buildNavoPathAgentSetupPrompt,
} from "./mcpAgentSetup";

describe("buildNavoPathAgentSetupPrompt", () => {
  it("includes the install sources and account-specific MCP credentials", () => {
    const prompt = buildNavoPathAgentSetupPrompt({
      endpoint: "https://mcp.example.test/mcp",
      token: "nvp_account_token",
      language: "zh",
    });

    expect(prompt).toContain(NAVOPATH_SCHEDULE_SKILL_INSTALL_COMMAND);
    expect(prompt).toContain(NAVOPATH_SCHEDULE_SKILL_PAGE);
    expect(prompt).toContain(NAVOPATH_SCHEDULE_SKILL_RAW);
    expect(prompt).toContain("URL：https://mcp.example.test/mcp");
    expect(prompt).toContain("Authorization：Bearer nvp_account_token");
    expect(prompt).toContain("list_projects");
  });

  it("produces the English handoff for English accounts", () => {
    const prompt = buildNavoPathAgentSetupPrompt({
      endpoint: "https://mcp.example.test/mcp",
      token: "nvp_account_token",
      language: "en",
    });

    expect(prompt).toContain("Install the NavoPath Schedule skill");
    expect(prompt).toContain("Transport: Streamable HTTP");
    expect(prompt).toContain("Authorization: Bearer nvp_account_token");
    expect(prompt).toContain("do not write it to project files");
  });
});
