import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';
import { firestore } from './firestore';
import crypto from 'node:crypto';

type QueryOptions = {
  where?: Record<string, any>;
  orderBy?: Record<string, 'asc' | 'desc'> | Array<Record<string, 'asc' | 'desc'>>;
  include?: Record<string, any>;
  select?: Record<string, any>;
  skip?: number;
  take?: number;
};

// Evaluate Prisma-style where clause against an in-memory document
function matchesFilter(item: any, where?: Record<string, any>): boolean {
  if (!where || Object.keys(where).length === 0) return true;

  for (const [key, condition] of Object.entries(where)) {
    if (key === 'OR' && Array.isArray(condition)) {
      const anyMatch = condition.some((cond) => matchesFilter(item, cond));
      if (!anyMatch) return false;
      continue;
    }

    if (key === 'AND' && Array.isArray(condition)) {
      const allMatch = condition.every((cond) => matchesFilter(item, cond));
      if (!allMatch) return false;
      continue;
    }

    if (key === 'NOT') {
      if (Array.isArray(condition)) {
        if (condition.some((cond) => matchesFilter(item, cond))) return false;
      } else {
        if (matchesFilter(item, condition)) return false;
      }
      continue;
    }

    const val = item[key];

    if (condition === undefined) continue;

    if (condition === null) {
      if (val !== null && val !== undefined) return false;
      continue;
    }

    if (typeof condition === 'object' && !(condition instanceof Date)) {
      // Operator check
      for (const [op, opVal] of Object.entries(condition)) {
        if (op === 'equals') {
          if (val !== opVal) return false;
        } else if (op === 'not') {
          if (typeof opVal === 'object' && opVal !== null && 'in' in opVal) {
            if ((opVal as any).in.includes(val)) return false;
          } else {
            if (val === opVal) return false;
          }
        } else if (op === 'in') {
          if (!Array.isArray(opVal) || !opVal.includes(val)) return false;
        } else if (op === 'notIn') {
          if (Array.isArray(opVal) && opVal.includes(val)) return false;
        } else if (op === 'lt') {
          const tVal = val instanceof Date ? val.getTime() : new Date(val).getTime();
          const tOp = opVal instanceof Date ? opVal.getTime() : new Date(opVal).getTime();
          if (isNaN(tVal) || isNaN(tOp)) {
            if (!(val < opVal)) return false;
          } else {
            if (!(tVal < tOp)) return false;
          }
        } else if (op === 'lte') {
          const tVal = val instanceof Date ? val.getTime() : new Date(val).getTime();
          const tOp = opVal instanceof Date ? opVal.getTime() : new Date(opVal).getTime();
          if (isNaN(tVal) || isNaN(tOp)) {
            if (!(val <= opVal)) return false;
          } else {
            if (!(tVal <= tOp)) return false;
          }
        } else if (op === 'gt') {
          const tVal = val instanceof Date ? val.getTime() : new Date(val).getTime();
          const tOp = opVal instanceof Date ? opVal.getTime() : new Date(opVal).getTime();
          if (isNaN(tVal) || isNaN(tOp)) {
            if (!(val > opVal)) return false;
          } else {
            if (!(tVal > tOp)) return false;
          }
        } else if (op === 'gte') {
          const tVal = val instanceof Date ? val.getTime() : new Date(val).getTime();
          const tOp = opVal instanceof Date ? opVal.getTime() : new Date(opVal).getTime();
          if (isNaN(tVal) || isNaN(tOp)) {
            if (!(val >= opVal)) return false;
          } else {
            if (!(tVal >= tOp)) return false;
          }
        } else if (op === 'contains') {
          const sVal = String(val || '').toLowerCase();
          const sOp = String(opVal || '').toLowerCase();
          if (!sVal.includes(sOp)) return false;
        } else if (op === 'startsWith') {
          if (!String(val || '').startsWith(String(opVal || ''))) return false;
        } else if (op === 'endsWith') {
          if (!String(val || '').endsWith(String(opVal || ''))) return false;
        }
      }
      continue;
    }

    // Direct comparison
    if (val !== condition) {
      if (val instanceof Date && condition instanceof Date) {
        if (val.getTime() !== condition.getTime()) return false;
      } else if (
        (val instanceof Date || typeof val === 'string') &&
        (condition instanceof Date || typeof condition === 'string')
      ) {
        if (new Date(val).getTime() !== new Date(condition).getTime()) return false;
      } else {
        return false;
      }
    }
  }

  return true;
}

// Compare for sorting
function compareValues(a: any, b: any, dir: 'asc' | 'desc'): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return dir === 'asc' ? -1 : 1;
  if (b === null || b === undefined) return dir === 'asc' ? 1 : -1;

  const tA = a instanceof Date ? a.getTime() : new Date(a).getTime();
  const tB = b instanceof Date ? b.getTime() : new Date(b).getTime();
  if (!isNaN(tA) && !isNaN(tB)) {
    return dir === 'asc' ? tA - tB : tB - tA;
  }

  if (typeof a === 'number' && typeof b === 'number') {
    return dir === 'asc' ? a - b : b - a;
  }

  const strA = String(a).toLowerCase();
  const strB = String(b).toLowerCase();
  return dir === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
}

export class FirestoreModelClient<T = any> {
  private collectionName: string;
  private adapter: FirestoreAdapter;

  constructor(collectionName: string, adapter: FirestoreAdapter) {
    this.collectionName = collectionName;
    this.adapter = adapter;
  }

  private getStore(): Map<string, T> {
    return this.adapter.getCollectionMap(this.collectionName);
  }

  async findMany(options?: QueryOptions): Promise<T[]> {
    await this.adapter.ensureReady();
    const store = this.getStore();
    let results: any[] = Array.from(store.values());

    // Filter
    if (options?.where) {
      results = results.filter((item) => matchesFilter(item, options.where));
    }

    // Sort
    if (options?.orderBy) {
      const orderBys = Array.isArray(options.orderBy) ? options.orderBy : [options.orderBy];
      results.sort((a, b) => {
        for (const order of orderBys) {
          for (const [field, dir] of Object.entries(order)) {
            const cmp = compareValues(a[field], b[field], dir);
            if (cmp !== 0) return cmp;
          }
        }
        return 0;
      });
    }

    // Pagination
    if (typeof options?.skip === 'number') {
      results = results.slice(options.skip);
    }
    if (typeof options?.take === 'number') {
      results = results.slice(0, options.take);
    }

    // Include / Select
    return Promise.all(
      results.map((item) => this.adapter.resolveRelations(this.collectionName, item, options?.include, options?.select))
    );
  }

  async findUnique(options: { where: Record<string, any>; include?: Record<string, any>; select?: Record<string, any> }): Promise<T | null> {
    await this.adapter.ensureReady();
    const store = this.getStore();

    // Fast path: where contains id or unique key
    if (options.where.id && store.has(options.where.id)) {
      const item = store.get(options.where.id)!;
      if (matchesFilter(item, options.where)) {
        return this.adapter.resolveRelations(this.collectionName, item, options.include, options.select);
      }
    }

    for (const item of store.values()) {
      if (matchesFilter(item, options.where)) {
        return this.adapter.resolveRelations(this.collectionName, item, options.include, options.select);
      }
    }
    return null;
  }

  async findUniqueOrThrow(options: { where: Record<string, any>; include?: Record<string, any>; select?: Record<string, any> }): Promise<T> {
    const res = await this.findUnique(options);
    if (!res) throw new Error(`Record in ${this.collectionName} not found`);
    return res;
  }

  async findFirst(options?: QueryOptions): Promise<T | null> {
    const list = await this.findMany({ ...options, take: 1 });
    return list[0] || null;
  }

  async count(options?: { where?: Record<string, any> }): Promise<number> {
    await this.adapter.ensureReady();
    const store = this.getStore();
    if (!options?.where || Object.keys(options.where).length === 0) {
      return store.size;
    }
    let c = 0;
    for (const item of store.values()) {
      if (matchesFilter(item, options.where)) c++;
    }
    return c;
  }

  async create(options: { data: any; include?: Record<string, any>; select?: Record<string, any> }): Promise<T> {
    await this.adapter.ensureReady();
    const now = new Date().toISOString();
    const id = options.data.id || (this.collectionName === 'systemSettings' ? options.data.key : crypto.randomUUID());

    // Separate direct fields from nested relations
    const { nested, cleanData } = this.adapter.extractNestedCreates(this.collectionName, id, options.data);

    const docData: any = {
      ...cleanData,
      id,
      createdAt: cleanData.createdAt ? new Date(cleanData.createdAt).toISOString() : now,
      updatedAt: cleanData.updatedAt ? new Date(cleanData.updatedAt).toISOString() : now,
    };

    // Store in Firestore and cache
    await this.adapter.saveDocument(this.collectionName, id, docData);

    // Save nested creates
    for (const nestedAction of nested) {
      await nestedAction();
    }

    return this.adapter.resolveRelations(this.collectionName, docData, options.include, options.select);
  }

  async createMany(options: { data: any[] }): Promise<{ count: number }> {
    await this.adapter.ensureReady();
    let count = 0;
    for (const row of options.data) {
      await this.create({ data: row });
      count++;
    }
    return { count };
  }

  async update(options: { where: Record<string, any>; data: any; include?: Record<string, any>; select?: Record<string, any> }): Promise<T> {
    await this.adapter.ensureReady();
    const existing = await this.findUnique({ where: options.where });
    if (!existing) throw new Error(`Cannot update: record not found in ${this.collectionName}`);

    const id = (existing as any).id || (existing as any).key;
    const now = new Date().toISOString();

    const { nested, cleanData } = this.adapter.extractNestedCreates(this.collectionName, id, options.data);

    const updatedDoc: any = {
      ...existing,
      ...cleanData,
      updatedAt: now,
    };

    await this.adapter.saveDocument(this.collectionName, id, updatedDoc);

    for (const nestedAction of nested) {
      await nestedAction();
    }

    return this.adapter.resolveRelations(this.collectionName, updatedDoc, options.include, options.select);
  }

  async updateMany(options: { where?: Record<string, any>; data: any }): Promise<{ count: number }> {
    await this.adapter.ensureReady();
    const list = await this.findMany({ where: options.where });
    for (const item of list) {
      const id = (item as any).id || (item as any).key;
      await this.update({ where: { id }, data: options.data });
    }
    return { count: list.length };
  }

  async delete(options: { where: Record<string, any> }): Promise<T> {
    await this.adapter.ensureReady();
    const existing = await this.findUnique({ where: options.where });
    if (!existing) throw new Error(`Cannot delete: record not found in ${this.collectionName}`);
    const id = (existing as any).id || (existing as any).key;
    await this.adapter.deleteDocument(this.collectionName, id);
    return existing;
  }

  async deleteMany(options?: { where?: Record<string, any> }): Promise<{ count: number }> {
    await this.adapter.ensureReady();
    const list = await this.findMany({ where: options?.where });
    for (const item of list) {
      const id = (item as any).id || (item as any).key;
      await this.adapter.deleteDocument(this.collectionName, id);
    }
    return { count: list.length };
  }

  async upsert(options: { where: Record<string, any>; create: any; update: any; include?: Record<string, any> }): Promise<T> {
    await this.adapter.ensureReady();
    const existing = await this.findUnique({ where: options.where });
    if (existing) {
      return this.update({ where: options.where, data: options.update, include: options.include });
    } else {
      return this.create({ data: options.create, include: options.include });
    }
  }

  async aggregate(options: { where?: Record<string, any>; _sum?: Record<string, boolean>; _count?: boolean | Record<string, boolean> }): Promise<any> {
    const list = await this.findMany({ where: options.where });
    const result: any = { _count: list.length };
    if (options._sum) {
      result._sum = {};
      for (const field of Object.keys(options._sum)) {
        result._sum[field] = list.reduce((acc, curr: any) => acc + (Number(curr[field]) || 0), 0);
      }
    }
    return result;
  }

  async groupBy(options: { by: string[]; where?: Record<string, any>; _count?: Record<string, boolean> }): Promise<any[]> {
    const list = await this.findMany({ where: options.where });
    const groups = new Map<string, any>();
    for (const item of list) {
      const key = options.by.map((f) => String((item as any)[f])).join('::');
      if (!groups.has(key)) {
        const initial: any = { _count: {} };
        for (const f of options.by) initial[f] = (item as any)[f];
        for (const f of Object.keys(options._count || {})) initial._count[f] = 0;
        groups.set(key, initial);
      }
      const g = groups.get(key)!;
      for (const f of Object.keys(options._count || {})) g._count[f]++;
    }
    return Array.from(groups.values());
  }
}

function sanitizeForFirestore(obj: any): any {
  if (obj === undefined) return null;
  if (obj === null) return null;
  if (obj instanceof Date) return obj.toISOString();
  if (Array.isArray(obj)) return obj.map(sanitizeForFirestore);
  if (typeof obj === 'object') {
    const res: any = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v === undefined) {
        res[k] = null;
      } else {
        res[k] = sanitizeForFirestore(v);
      }
    }
    return res;
  }
  return obj;
}

export class FirestoreAdapter {
  private collections = new Map<string, Map<string, any>>();
  private initialized = false;
  private initPromise: Promise<void> | null = null;


  public user: FirestoreModelClient;
  public event: FirestoreModelClient;
  public facility: FirestoreModelClient;
  public equipment: FirestoreModelClient;
  public resourceBooking: FirestoreModelClient;
  public resourceBookingItem: FirestoreModelClient;
  public budgetItem: FirestoreModelClient;
  public eventScheduleItem: FirestoreModelClient;
  public approvalDecision: FirestoreModelClient;
  public workflowHistory: FirestoreModelClient;
  public attachment: FirestoreModelClient;
  public handoverRecord: FirestoreModelClient;
  public returnInspection: FirestoreModelClient;
  public incidentReport: FirestoreModelClient;
  public settlement: FirestoreModelClient;
  public settlementItem: FirestoreModelClient;
  public financialDocument: FirestoreModelClient;
  public eventReport: FirestoreModelClient;
  public notification: FirestoreModelClient;
  public auditLog: FirestoreModelClient;
  public systemSetting: FirestoreModelClient;
  public passwordResetToken: FirestoreModelClient;
  public eventVersion: FirestoreModelClient;

  constructor() {
    this.user = new FirestoreModelClient('users', this);
    this.event = new FirestoreModelClient('events', this);
    this.facility = new FirestoreModelClient('facilities', this);
    this.equipment = new FirestoreModelClient('equipment', this);
    this.resourceBooking = new FirestoreModelClient('resourceBookings', this);
    this.resourceBookingItem = new FirestoreModelClient('resourceBookingItems', this);
    this.budgetItem = new FirestoreModelClient('budgetItems', this);
    this.eventScheduleItem = new FirestoreModelClient('eventScheduleItems', this);
    this.approvalDecision = new FirestoreModelClient('approvalDecisions', this);
    this.workflowHistory = new FirestoreModelClient('workflowHistories', this);
    this.attachment = new FirestoreModelClient('attachments', this);
    this.handoverRecord = new FirestoreModelClient('handoverRecords', this);
    this.returnInspection = new FirestoreModelClient('returnInspections', this);
    this.incidentReport = new FirestoreModelClient('incidentReports', this);
    this.settlement = new FirestoreModelClient('settlements', this);
    this.settlementItem = new FirestoreModelClient('settlementItems', this);
    this.financialDocument = new FirestoreModelClient('financialDocuments', this);
    this.eventReport = new FirestoreModelClient('eventReports', this);
    this.notification = new FirestoreModelClient('notifications', this);
    this.auditLog = new FirestoreModelClient('auditLogs', this);
    this.systemSetting = new FirestoreModelClient('systemSettings', this);
    this.passwordResetToken = new FirestoreModelClient('passwordResetTokens', this);
    this.eventVersion = new FirestoreModelClient('eventVersions', this);
  }

  getCollectionMap(name: string): Map<string, any> {
    if (!this.collections.has(name)) {
      this.collections.set(name, new Map());
    }
    return this.collections.get(name)!;
  }

  async ensureReady(): Promise<void> {
    if (this.initialized) return;
    if (!this.initPromise) {
      this.initPromise = this.loadAllFromFirestore();
    }
    return this.initPromise;
  }

  private async loadAllFromFirestore(): Promise<void> {
    const collectionNames = [
      'users',
      'facilities',
      'equipment',
      'events',
      'budgetItems',
      'workflowHistories',
      'approvalDecisions',
      'resourceBookings',
      'resourceBookingItems',
      'settlements',
      'settlementItems',
      'financialDocuments',
      'systemSettings',
      'eventScheduleItems',
      'eventVersions',
      'attachments',
      'handoverRecords',
      'returnInspections',
      'incidentReports',
      'eventReports',
      'notifications',
      'auditLogs',
      'passwordResetTokens',
    ];

    try {
      console.log('🔄 Đang đồng bộ dữ liệu từ Google Cloud Firestore...');
      const fetchCollection = async (name: string) => {
        try {
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout loading collection ${name}`)), 8000)
          );
          const snap = await Promise.race([
            getDocs(collection(firestore, name)),
            timeoutPromise,
          ]);
          const map = this.getCollectionMap(name);
          map.clear();
          snap.forEach((d) => {
            map.set(d.id, d.data());
          });
        } catch (colErr: any) {
          console.warn(`[Firestore] Bộ dữ liệu "${name}":`, colErr.message);
        }
      };

      await Promise.all(collectionNames.map((name) => fetchCollection(name)));
      this.initialized = true;
      console.log('✅ Đã đồng bộ thành công dữ liệu từ Google Cloud Firestore!');
    } catch (err: any) {
      console.error('Lỗi nạp dữ liệu từ Firestore:', err.message);
      this.initialized = true; // still allow app to boot
    }
  }

  async saveDocument(collectionName: string, id: string, data: any): Promise<void> {
    const clean = sanitizeForFirestore(data);
    const map = this.getCollectionMap(collectionName);
    map.set(id, clean);
    const docRef = doc(firestore, collectionName, id);
    await setDoc(docRef, clean, { merge: true });
  }

  async deleteDocument(collectionName: string, id: string): Promise<void> {
    const map = this.getCollectionMap(collectionName);
    map.delete(id);
    const docRef = doc(firestore, collectionName, id);
    await deleteDoc(docRef);
  }

  extractNestedCreates(collectionName: string, parentId: string, data: any): { nested: Array<() => Promise<void>>; cleanData: any } {
    const nested: Array<() => Promise<void>> = [];
    const cleanData: any = {};

    for (const [key, val] of Object.entries(data)) {
      if (val && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
        if ('create' in val) {
          const createData = (val as any).create;
          if (collectionName === 'events') {
            if (key === 'budgetItems') {
              const items = Array.isArray(createData) ? createData : [createData];
              for (const it of items) {
                nested.push(() => this.budgetItem.create({ data: { ...it, eventId: parentId } }).then(() => {}));
              }
              continue;
            }
            if (key === 'scheduleItems') {
              const items = Array.isArray(createData) ? createData : [createData];
              for (const it of items) {
                nested.push(() => this.eventScheduleItem.create({ data: { ...it, eventId: parentId } }).then(() => {}));
              }
              continue;
            }
            if (key === 'workflowHistory') {
              const items = Array.isArray(createData) ? createData : [createData];
              for (const it of items) {
                nested.push(() => this.workflowHistory.create({ data: { ...it, eventId: parentId } }).then(() => {}));
              }
              continue;
            }
            if (key === 'approvalDecisions') {
              const items = Array.isArray(createData) ? createData : [createData];
              for (const it of items) {
                nested.push(() => this.approvalDecision.create({ data: { ...it, eventId: parentId } }).then(() => {}));
              }
              continue;
            }
            if (key === 'resourceBookings') {
              const items = Array.isArray(createData) ? createData : [createData];
              for (const it of items) {
                nested.push(() => this.resourceBooking.create({ data: { ...it, eventId: parentId } }).then(() => {}));
              }
              continue;
            }
            if (key === 'settlements') {
              const items = Array.isArray(createData) ? createData : [createData];
              for (const it of items) {
                nested.push(() => this.settlement.create({ data: { ...it, eventId: parentId } }).then(() => {}));
              }
              continue;
            }
          }
          if (collectionName === 'settlements') {
            if (key === 'documents') {
              const items = Array.isArray(createData) ? createData : [createData];
              for (const it of items) {
                nested.push(() => this.financialDocument.create({ data: { ...it, settlementId: parentId } }).then(() => {}));
              }
              continue;
            }
            if (key === 'items') {
              const items = Array.isArray(createData) ? createData : [createData];
              for (const it of items) {
                nested.push(() => this.settlementItem.create({ data: { ...it, settlementId: parentId } }).then(() => {}));
              }
              continue;
            }
          }
          if (collectionName === 'resourceBookings') {
            if (key === 'bookingItems') {
              const items = Array.isArray(createData) ? createData : [createData];
              for (const it of items) {
                nested.push(() => this.resourceBookingItem.create({ data: { ...it, bookingId: parentId } }).then(() => {}));
              }
              continue;
            }
          }
        }
      }
      cleanData[key] = val;
    }

    return { nested, cleanData };
  }

  async resolveRelations(collectionName: string, item: any, include?: Record<string, any>, select?: Record<string, any>): Promise<any> {
    if (!item) return null;
    const resolved = { ...item };

    if (include) {
      if (collectionName === 'events') {
        if (include.createdBy) {
          const user = await this.user.findUnique({ where: { id: item.createdById } });
          resolved.createdBy = user;
        }
        if (include.budgetItems) {
          resolved.budgetItems = await this.budgetItem.findMany({ where: { eventId: item.id }, orderBy: include.budgetItems.orderBy });
        }
        if (include.scheduleItems) {
          resolved.scheduleItems = await this.eventScheduleItem.findMany({ where: { eventId: item.id }, orderBy: include.scheduleItems.orderBy });
        }
        if (include.approvalDecisions) {
          resolved.approvalDecisions = await this.approvalDecision.findMany({
            where: { eventId: item.id },
            include: include.approvalDecisions.include,
            orderBy: include.approvalDecisions.orderBy,
          });
        }
        if (include.workflowHistory) {
          resolved.workflowHistory = await this.workflowHistory.findMany({ where: { eventId: item.id }, orderBy: include.workflowHistory.orderBy });
        }
        if (include.attachments) {
          resolved.attachments = await this.attachment.findMany({ where: { eventId: item.id }, include: include.attachments.include });
        }
        if (include.resourceBookings) {
          resolved.resourceBookings = await this.resourceBooking.findMany({
            where: { eventId: item.id },
            include: include.resourceBookings.include,
          });
        }
        if (include.handoverRecords) {
          resolved.handoverRecords = await this.handoverRecord.findMany({ where: { eventId: item.id }, include: include.handoverRecords.include });
        }
        if (include.returnInspections) {
          resolved.returnInspections = await this.returnInspection.findMany({ where: { eventId: item.id }, include: include.returnInspections.include });
        }
        if (include.incidentReports) {
          resolved.incidentReports = await this.incidentReport.findMany({ where: { eventId: item.id }, include: include.incidentReports.include });
        }
        if (include.settlements) {
          resolved.settlements = await this.settlement.findMany({ where: { eventId: item.id }, include: include.settlements.include });
        }
        if (include.eventReport) {
          resolved.eventReport = await this.eventReport.findUnique({ where: { eventId: item.id } });
        }
        if (include.versions) {
          resolved.versions = await this.eventVersion.findMany({ where: { eventId: item.id }, orderBy: include.versions.orderBy });
        }
      }

      if (collectionName === 'approvalDecisions') {
        if (include.decidedBy) {
          resolved.decidedBy = await this.user.findUnique({ where: { id: item.decidedById } });
        }
      }

      if (collectionName === 'resourceBookings') {
        if (include.facility) {
          resolved.facility = await this.facility.findUnique({ where: { id: item.facilityId } });
        }
        if (include.bookingItems) {
          resolved.bookingItems = await this.resourceBookingItem.findMany({
            where: { bookingId: item.id },
            include: include.bookingItems.include,
          });
        }
      }

      if (collectionName === 'resourceBookingItems') {
        if (include.equipment) {
          resolved.equipment = await this.equipment.findUnique({ where: { id: item.equipmentId } });
        }
      }

      if (collectionName === 'settlements') {
        if (include.items) {
          resolved.items = await this.settlementItem.findMany({ where: { settlementId: item.id } });
        }
        if (include.documents) {
          resolved.documents = await this.financialDocument.findMany({ where: { settlementId: item.id } });
        }
        if (include.submittedBy) {
          resolved.submittedBy = await this.user.findUnique({ where: { id: item.submittedById } });
        }
        if (include.reviewedBy) {
          resolved.reviewedBy = await this.user.findUnique({ where: { id: item.reviewedById } });
        }
      }

      if (collectionName === 'handoverRecords') {
        if (include.handoverBy) {
          resolved.handoverBy = await this.user.findUnique({ where: { id: item.handoverById } });
        }
        if (include.receivedBy) {
          resolved.receivedBy = await this.user.findUnique({ where: { id: item.receivedById } });
        }
      }

      if (collectionName === 'returnInspections') {
        if (include.inspectedBy) {
          resolved.inspectedBy = await this.user.findUnique({ where: { id: item.inspectedById } });
        }
      }

      if (collectionName === 'incidentReports') {
        if (include.reportedBy) {
          resolved.reportedBy = await this.user.findUnique({ where: { id: item.reportedById } });
        }
      }
    }

    if (select) {
      const selected: any = {};
      for (const [k, v] of Object.entries(select)) {
        if (v) selected[k] = resolved[k];
      }
      return selected;
    }

    return resolved;
  }

  async $transaction<T>(operation: ((tx: FirestoreAdapter) => Promise<T>) | Promise<any>[], _options?: any): Promise<T> {
    await this.ensureReady();
    if (typeof operation === 'function') {
      return operation(this);
    }
    const results = [];
    for (const op of operation) {
      results.push(await op);
    }
    return results as unknown as T;
  }
}

export const firestoreAdapter = new FirestoreAdapter();
export default firestoreAdapter;
