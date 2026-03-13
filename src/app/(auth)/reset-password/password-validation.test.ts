import { describe, it, expect } from "vitest";
import { validatePassword, COMMON_PASSWORDS } from "./password-validation";

describe("validatePassword", () => {
  // Length validation
  it("rejects empty password", () => {
    expect(validatePassword("")).toBe("Password must be at least 8 characters.");
  });

  it("rejects password shorter than 8 chars", () => {
    expect(validatePassword("abc1234")).toBe(
      "Password must be at least 8 characters."
    );
  });

  it("accepts password with exactly 8 chars that meets complexity", () => {
    expect(validatePassword("Abcd123!")).toBeNull();
  });

  it("accepts normal password", () => {
    expect(validatePassword("MySecureP@ssw0rd")).toBeNull();
  });

  it("accepts password with exactly 128 chars", () => {
    // Mix of uppercase, lowercase, digits, special to satisfy all rules
    const base = "Aa1!";
    const long = base.repeat(32); // 128 chars
    expect(validatePassword(long)).toBeNull();
  });

  it("rejects password longer than 128 chars", () => {
    expect(validatePassword("Aa1!" + "a".repeat(125))).toBe(
      "Password must be 128 characters or fewer."
    );
  });

  // Complexity requirements
  it("rejects password without uppercase letter", () => {
    expect(validatePassword("abcdef1!")).toBe(
      "Password must include uppercase, lowercase, a number, and a special character."
    );
  });

  it("rejects password without lowercase letter", () => {
    expect(validatePassword("ABCDEF1!")).toBe(
      "Password must include uppercase, lowercase, a number, and a special character."
    );
  });

  it("rejects password without a number", () => {
    expect(validatePassword("Abcdefg!")).toBe(
      "Password must include uppercase, lowercase, a number, and a special character."
    );
  });

  it("rejects password without a special character", () => {
    expect(validatePassword("Abcdefg1")).toBe(
      "Password must include uppercase, lowercase, a number, and a special character."
    );
  });

  it("accepts password with all complexity requirements", () => {
    expect(validatePassword("MyPass1!")).toBeNull();
  });

  it("accepts various special characters", () => {
    expect(validatePassword("Abcdef1@")).toBeNull();
    expect(validatePassword("Abcdef1#")).toBeNull();
    expect(validatePassword("Abcdef1$")).toBeNull();
    expect(validatePassword("Abcdef1%")).toBeNull();
    expect(validatePassword("Abcdef1&")).toBeNull();
  });

  // Common password rejection
  it("rejects common passwords even if they meet complexity rules", () => {
    expect(validatePassword("Password1!")).toBe(
      "This password is too common. Please choose a more unique password."
    );
  });

  it("rejects common passwords case-insensitively", () => {
    // "PassWord1!" contains "password" when lowercased
    expect(validatePassword("PassWord1!")).toBe(
      "This password is too common. Please choose a more unique password."
    );
  });

  it("rejects 'Qwerty123!'", () => {
    expect(validatePassword("Qwerty123!")).toBe(
      "This password is too common. Please choose a more unique password."
    );
  });

  it("exports COMMON_PASSWORDS list for reference", () => {
    expect(COMMON_PASSWORDS).toBeDefined();
    expect(COMMON_PASSWORDS.length).toBeGreaterThan(0);
    expect(COMMON_PASSWORDS).toContain("password");
    expect(COMMON_PASSWORDS).toContain("qwerty");
  });
});
