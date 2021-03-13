// string-related utils

export function regionJoin(...units: Array<string | undefined>): string | undefined {
  return units.reduce((p, x) => eliminatePrefixOrSuffix(p, x).join(', '));
}

export function orgJoin(org1: string | undefined, org2: string | undefined): string | undefined {
  [org1, org2] = eliminatePrefixOrSuffix(org1, org2);
  return org1 && (org2 ? `${org1} (${org2})` : org1);
}

export function eliminatePrefixOrSuffix(label1?: string, label2?: string): string[] {
  if (label1 && (label2?.startsWith(label1) || label2?.endsWith(label1))) {
    label1 = undefined;
  } else if (label2 && (label1?.startsWith(label2) || label1?.endsWith(label2))) {
    label2 = undefined;
  }
  return [label1, label2].filter((value) => value) as string[];
}

// TODO: over cutting?
