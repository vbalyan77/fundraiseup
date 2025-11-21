import { MaskRulesMap } from "./types";

const splitPath = (
  path: string,
): { segments: string[]; leaf: string | null } => {
  const segments = path.split(".").filter(Boolean);
  if (!segments.length) {
    return { segments: [], leaf: null };
  }

  const leaf = segments.pop() ?? null;
  return { segments, leaf };
};

export const maskData = <T extends object>(
  entity: T,
  rules: MaskRulesMap,
): T => {
  const root = entity as Record<string, unknown>;

  for (const [path, transform] of Object.entries(rules)) {
    const { segments, leaf } = splitPath(path);
    if (!leaf) {
      continue;
    }

    let parent: Record<string, unknown> | undefined = root;

    for (const segment of segments) {
      const next = parent?.[segment];
      if (typeof next !== "object" || next === null) {
        parent = undefined;
        break;
      }

      parent = next as Record<string, unknown>;
    }

    if (!parent) {
      continue;
    }

    const currentValue = parent[leaf];
    if (typeof currentValue !== "string") {
      continue;
    }

    parent[leaf] = transform(currentValue);
  }

  return entity;
};
