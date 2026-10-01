import test from "node:test"
import assert from "node:assert/strict"
import { canManageBatch, canOpenBatch } from "../src/features/batches/batchAccess.ts"
import type { BatchType, UserInfo } from "../src/types/index.ts"

const batch = { sellerId: "creator", dbId: "batch", seller: "Same Name" } as BatchType
const creator = { id: "creator", name: "Same Name" } as UserInfo
const other = { id: "other", name: "Same Name" } as UserInfo

test("only the creating seller can open and manage a seller batch page", () => {
  assert.equal(canOpenBatch(batch, creator, "Seller"), true)
  assert.equal(canManageBatch(batch, creator, "Seller"), true)
  assert.equal(canOpenBatch(batch, other, "Seller"), false)
  assert.equal(canManageBatch(batch, other, "Seller"), false)
})

test("buyers can open the claim page but never manage it", () => {
  assert.equal(canOpenBatch(batch, other, "Buyer"), true)
  assert.equal(canManageBatch(batch, other, "Buyer"), false)
  assert.equal(canManageBatch(batch, creator, "Buyer"), false)
})

test("missing identities cannot grant access to persisted batches", () => {
  assert.equal(canManageBatch(batch, { name: "Same Name" } as UserInfo, "Seller"), false)
  assert.equal(canManageBatch({ ...batch, sellerId: undefined }, creator, "Seller"), false)
})
