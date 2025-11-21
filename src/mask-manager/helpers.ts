import { createHash } from "crypto";
import { MaskRule } from "./types";

const ALPHABET =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

const TOKEN_LENGTH = 8;

const deterministicToken = (namespace: string, value: string): string => {
  const digest = createHash("sha256")
    .update(namespace)
    .update(":")
    .update(value)
    .digest();

  let token = "";
  for (let i = 0; token.length < TOKEN_LENGTH; i += 1) {
    const index = i % digest.length;
    const byte = digest[index] ?? 0;
    token += ALPHABET[byte % ALPHABET.length];
  }

  return token;
};

export const maskText =
  (namespace: string): MaskRule =>
  (value) =>
    deterministicToken(namespace, value);

export const maskEmail = (): MaskRule => (email) => {
  const atIndex = email.indexOf("@");
  if (atIndex === -1) {
    return deterministicToken("email", email);
  }

  const localPart = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);
  const maskedLocalPart = deterministicToken("email", localPart);

  return `${maskedLocalPart}@${domain}`;
};
