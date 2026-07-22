import { describe, expect, it } from "vitest";

import {
  providerSpikeStructuredSchema,
} from "../../src/infrastructure/gemma/provider-spike-schemas.js";

describe("provider spike structured schema", () => {
  it("accepts the versioned Bengali shape", () => {
    expect(
      providerSpikeStructuredSchema.safeParse({
        schemaVersion: "provider-spike.v1",
        language: "bn",
        summary: "উদ্ভিদ সূর্যালোক ব্যবহার করে খাদ্য তৈরি করে।",
        keywords: ["উদ্ভিদ", "সালোকসংশ্লেষণ"],
      }).success,
    ).toBe(true);
  });

  it("rejects unknown fields and wrong versions", () => {
    expect(
      providerSpikeStructuredSchema.safeParse({
        schemaVersion: "provider-spike.v2",
        language: "bn",
        summary: "উদ্ভিদ সূর্যালোক ব্যবহার করে খাদ্য তৈরি করে।",
        keywords: ["উদ্ভিদ", "সালোকসংশ্লেষণ"],
        extra: true,
      }).success,
    ).toBe(false);
  });
});
