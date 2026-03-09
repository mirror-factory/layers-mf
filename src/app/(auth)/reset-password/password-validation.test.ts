import { describe, it, expect } from "vitest";
import { validatePassword } from "./password-validation";

describe("validatePassword", () => {
  it("rejects empty password", () => {
    expect(validatePassword("")).toBe("Password must be at least 8 characters.");
  });

  it("rejects password shorter than 8 chars", () => {
    expect(validatePassword("abc1234")).toBe(
      "Password must be at least 8 characters."
    );
  });

  it("accepts password with exactly 8 chars", () => {
    expect(validatePassword("abcd1234")).toBeNull();
  });

  it("accepts normal password", () => {
    expect(validatePassword("MySecureP@ssw0rd")).toBeNull();
  });

  it("accepts password with exactly 128 chars", () => {
    expect(validatePassword("a".repeat(128))).toBeNull();
  });

  it("rejects password longer than 128 chars", () => {
    expect(validatePassword("a".repeat(129))).toBe(
      "Password must be 128 characters or fewer."
    );
  });
});
