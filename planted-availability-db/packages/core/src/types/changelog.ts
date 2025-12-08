export type ChangeAction = 'created' | 'updated' | 'archived' | 'restored';
export type ChangeSourceType = 'scraper' | 'manual' | 'system' | 'webhook';

export interface FieldChange {
  field: string;
  before: unknown;
  after: unknown;
}

export interface ChangeSource {
  type: ChangeSourceType;
  scraper_id?: string;
  user_id?: string;
  ip?: string;
}

export interface ChangeLog {
  id: string;
  timestamp: Date;
  action: ChangeAction;
  collection: string;
  document_id: string;
  changes: FieldChange[];
  source: ChangeSource;
  reason?: string;
}

export type CreateChangeLogInput = Omit<ChangeLog, 'id' | 'timestamp'>;
