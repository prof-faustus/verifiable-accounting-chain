// Append-only audit log for proof responses. Metadata only — never the
// underlying record content, key material, or full proofs.
export interface AuditEntry {
  ts: string;
  callerId: string;
  queryKeyHex: string;
  returnedFragmentId: string;
  outcome: string;
}

export class AuditLog {
  private readonly entries: AuditEntry[] = [];

  record(entry: AuditEntry): void {
    this.entries.push({ ...entry });
  }

  all(): readonly AuditEntry[] {
    return this.entries;
  }

  size(): number {
    return this.entries.length;
  }
}
