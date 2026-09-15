import { describe, expect, it } from "vitest";
import { addFacebookRowSpacing } from "../facebook.js";

describe("addFacebookRowSpacing", () => {
  it("adds one blank line between every non-empty caption row", () => {
    expect(addFacebookRowSpacing("Hook\nDetail one\nDetail two\nCTA")).toBe(
      "Hook\n\nDetail one\n\nDetail two\n\nCTA",
    );
  });

  it("normalizes existing paragraph spacing without adding extra blank lines", () => {
    expect(addFacebookRowSpacing("Hook\r\n\r\nDetail\n\n\nCTA")).toBe(
      "Hook\n\nDetail\n\nCTA",
    );
  });
});