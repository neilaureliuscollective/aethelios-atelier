export type OperationIdentity = {
  ownerId: string;
  projectId: string;
  generation: number;
};

export function identitiesMatch(a: OperationIdentity | null, b: OperationIdentity | null) {
  if (!a || !b) return false;
  return a.ownerId === b.ownerId && a.projectId === b.projectId && a.generation === b.generation;
}
