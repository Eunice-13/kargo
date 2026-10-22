export const state = {
  userId: "leader",
  authError: null as null | Error,
  rows: {} as Record<string, Record<string, unknown>[]>,
  filters: [] as Array<{ table: string; field: string; value: unknown }>,
};
export const isSupabaseConfigured = true;
export function requireSupabase() {
  return {
    auth: {
      getUser: async () => ({
        data: { user: state.userId ? { id: state.userId } : null },
        error: state.authError,
      }),
    },
    from(table: string) {
      const conditions: Array<(r: Record<string, unknown>) => boolean> = [];
      let single = false;
      const query = {
        select() {
          return query;
        },
        order() {
          return query;
        },
        eq(field: string, value: unknown) {
          state.filters.push({ table, field, value });
          conditions.push((r) => field.split(".").reduce((v: any, key) => v?.[key], r) === value);
          return query;
        },
        in(field: string, values: unknown[]) {
          conditions.push((r) =>
            values.includes(field.split(".").reduce((v: any, key) => v?.[key], r)),
          );
          return query;
        },
        single() {
          single = true;
          return query;
        },
        then(resolve: (result: unknown) => unknown, reject?: (error: unknown) => unknown) {
          const rows = (state.rows[table] ?? []).filter((r) => conditions.every((f) => f(r)));
          return Promise.resolve({
            data: single ? (rows[0] ?? null) : rows,
            error: single && rows.length !== 1 ? new Error("Group unavailable") : null,
          }).then(resolve, reject);
        },
      };
      return query;
    },
  };
}
