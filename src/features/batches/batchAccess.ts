import type { BatchType, Role, UserInfo } from "../../types/index.ts"

export function canManageBatch(batch: BatchType, user: UserInfo, role: Role): boolean {
  if (role !== "Seller") return false
  if (batch.sellerId || user.id || batch.dbId) {
    return Boolean(user.id && batch.sellerId === user.id)
  }
  // Seed-only preview batches have no database identities.
  return batch.seller === user.name
}

export function canOpenBatch(batch: BatchType, user: UserInfo, role: Role): boolean {
  return role === "Buyer" || canManageBatch(batch, user, role)
}
