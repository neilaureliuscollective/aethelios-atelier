export type OperationIdentity = {
  ownerId: string;
  projectId: string;
  generation: number;
  signOutEpoch: number;
};

export function identitiesMatch(a: OperationIdentity | null, b: OperationIdentity | null) {
  if (!a || !b) return false;
  return (
    a.ownerId === b.ownerId &&
    a.projectId === b.projectId &&
    a.generation === b.generation &&
    a.signOutEpoch === b.signOutEpoch
  );
}

export function identityFor(
  ownerId: string,
  projectId: string,
  fence: { generation: number; signOutEpoch: number }
): OperationIdentity {
  return {
    ownerId,
    projectId,
    generation: fence.generation,
    signOutEpoch: fence.signOutEpoch
  };
}
