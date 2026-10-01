import test from "node:test"
import assert from "node:assert/strict"
import { BATCH_CATEGORIES, normalizeBatchCategory } from "../src/constants/categories.ts"

test("current categories retain their category, including case and whitespace variants", () => {
  for (const category of BATCH_CATEGORIES) {
    assert.equal(normalizeBatchCategory(category), category)
    assert.equal(normalizeBatchCategory(` ${category.toLowerCase()} `), category)
  }
})
test("legacy and missing categories remain reachable through current filters", () => {
  assert.equal(normalizeBatchCategory("Skincare"), "Beauty")
  assert.equal(normalizeBatchCategory("Grocery & Snacks"), "Food")
  for (const category of ["Mixed", "Food & Beauty", "", null, undefined]) {
    assert.equal(normalizeBatchCategory(category), "Others")
  }
})
