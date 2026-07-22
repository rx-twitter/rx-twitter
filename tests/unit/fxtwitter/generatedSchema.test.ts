import { describe, expect, it } from "vitest";

import { SocialThread } from "@/fxtwitter/generated/model";

describe("SocialThread schema", () => {
  it("nullable な status と author を受理する", () => {
    const result = SocialThread.safeParse({
      code: 200,
      status: null,
      thread: null,
      author: null,
    });

    expect(result.success).toBe(true);
  });

  it("必須フィールドが欠けた Twitter status を拒否する", () => {
    const result = SocialThread.safeParse({
      code: 200,
      status: { type: "status" },
      thread: null,
      author: null,
    });

    expect(result.success).toBe(false);
  });
});
