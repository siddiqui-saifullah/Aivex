import type { TestCase } from "../../types";

/** A test case being edited in the assignment form (new ones have no _id yet). */
export type DraftTest = Omit<TestCase, "_id"> & { _id?: string; key: string };

let nextKey = 0;
export const draftTest = (t?: Partial<TestCase>): DraftTest => ({
  key: `t${nextKey++}`,
  _id: t?._id,
  name: t?.name ?? "",
  input: t?.input ?? "",
  expected: t?.expected ?? "",
  points: t?.points ?? 1,
  hidden: t?.hidden ?? false,
});

