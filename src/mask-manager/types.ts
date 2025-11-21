export type MaskRule = (value: string) => string;

export type MaskRulesMap = Record<string, MaskRule>;
