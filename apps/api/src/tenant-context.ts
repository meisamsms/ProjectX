/** Future transaction-only RLS seam; no browser values and no database implementation yet. */
export interface ValidatedTenantContext {
  readonly userId: string;
  readonly organizationId: string;
  readonly venueId?: string;
  readonly accessMode: "self" | "organization" | "venue";
}
export interface ScopedTransaction<TQuery> {
  /** Implementer must set transaction-local app.* context from a server-validated authorization decision. */
  run<T>(
    context: ValidatedTenantContext,
    operation: (query: TQuery) => Promise<T>,
  ): Promise<T>;
}
