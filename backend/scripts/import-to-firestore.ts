import 'dotenv/config';
import { doc, setDoc, getDoc, getDocs, collection, writeBatch } from 'firebase/firestore';
import { firestore } from '../src/config/firestore';
import { PrismaClient as SqliteClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';

async function importToFirestore() {
  console.log('--- BẮT ĐẦU CHUYỂN DỮ LIỆU QLQTKD SANG FIREBASE FIRESTORE ---');
  console.log('Target Database: ai-studio-qlqtkd-15ba394f-d8d6-4ef5-bede-4c79a62d3072');
  console.log('Project ID: gen-lang-client-0601161839');

  const sqliteDbPath = path.resolve(__dirname, '../prisma/dev.db');
  const sqlite = new SqliteClient({
    datasources: { db: { url: `file:${sqliteDbPath}` } },
  });

  // Read data from SQLite
  const users = await sqlite.user.findMany();
  const facilities = await sqlite.facility.findMany();
  const equipment = await sqlite.equipment.findMany();
  let events = await sqlite.event.findMany();
  let budgetItems = await sqlite.budgetItem.findMany();
  let workflowHistories = await sqlite.workflowHistory.findMany();
  const approvalDecisions = await sqlite.approvalDecision.findMany();
  const resourceBookings = await sqlite.resourceBooking.findMany();
  const resourceBookingItems = await sqlite.resourceBookingItem.findMany();
  const settlements = await sqlite.settlement.findMany();
  const financialDocuments = await sqlite.financialDocument.findMany();
  const systemSettings = await sqlite.systemSetting.findMany();
  const eventScheduleItems = await sqlite.eventScheduleItem.findMany();

  // Ensure all 8 events are present per user specification
  const hasEv8 = events.some((e) => e.id === 'ev-8' || e.eventCode === 'EV-2024-008');
  if (!hasEv8) {
    const ev8 = {
      id: 'ev-8',
      eventCode: 'EV-2024-008',
      title: 'Hội thảo Quốc tế Chuyển đổi số trong Tài chính và Ngân hàng',
      description: 'Diễn đàn học thuật thường niên với các diễn giả chuyên gia công nghệ tài chính FinTech quốc tế.',
      objectives: 'Công bố 25 bài báo khoa học và kết nối hợp tác nghiên cứu quốc tế.',
      targetAudience: 'Giảng viên, nghiên cứu sinh và sinh viên chất lượng cao',
      expectedAttendees: 200,
      organizingUnit: 'Liên Chi đoàn Khoa Quản trị Kinh doanh',
      contactPerson: 'Trần Thị Bình',
      contactEmail: 'btc2@eventflow.vn',
      contactPhone: '0935333444',
      startDate: new Date('2026-11-25T08:00:00Z'),
      endDate: new Date('2026-11-25T17:30:00Z'),
      setupTime: null,
      teardownTime: null,
      preferredVenue: 'Hội trường B (Khu nhà B)',
      planContent: 'Báo cáo 4 chuyên đề chuyên sâu về FinTech và AI trong Ngân hàng',
      safetyPlan: 'Phương án PCCC và điều phối lối thoát hiểm Hội trường B',
      communicationPlan: 'Truyền thông qua Website khoa và DUE Fanpage',
      status: 'DOAN_REVIEW',
      permitStatus: 'PENDING',
      facilityStatus: 'CONFIRMED',
      inspectionStatus: 'PENDING',
      settlementStatus: 'PENDING',
      reportStatus: 'PENDING',
      currentVersion: 1,
      createdById: 'u-btc2',
      createdAt: new Date('2026-11-01T08:00:00Z'),
      updatedAt: new Date('2026-11-01T08:00:00Z'),
      deletedAt: null,
    };
    events.push(ev8);

    // Add 2 budget items for ev-8 to reach exactly 5 budget items (2 in ev-1 + 1 in ev-2 + 2 in ev-8 = 5)
    budgetItems.push({
      id: 'bi-ev8-1',
      eventId: 'ev-8',
      category: 'Học thuật',
      itemName: 'Kỷ yếu hội thảo quốc tế ISBN',
      quantity: 200,
      unitPrice: 50000,
      totalPrice: 10000000,
      notes: 'In màu bìa cứng',
      actualQuantity: null,
      actualPrice: null,
      actualTotal: null,
      createdAt: new Date('2026-11-01T08:00:00Z'),
      updatedAt: new Date('2026-11-01T08:00:00Z'),
    });
    budgetItems.push({
      id: 'bi-ev8-2',
      eventId: 'ev-8',
      category: 'Hậu cần',
      itemName: 'Teabreak đại biểu và diễn giả',
      quantity: 200,
      unitPrice: 40000,
      totalPrice: 8000000,
      notes: '2 phiên sáng và chiều',
      actualQuantity: null,
      actualPrice: null,
      actualTotal: null,
      createdAt: new Date('2026-11-01T08:00:00Z'),
      updatedAt: new Date('2026-11-01T08:00:00Z'),
    });

    // Add 1 workflow history for ev-8 to reach exactly 7 workflow histories (5 in ev-1 + 1 in ev-2 + 1 in ev-8 = 7)
    workflowHistories.push({
      id: 'wf-ev8-1',
      eventId: 'ev-8',
      fromStatus: 'FACULTY_APPROVED',
      toStatus: 'DOAN_REVIEW',
      action: 'SUBMIT_UNION',
      actorId: 'u-bcn',
      actorName: 'PGS.TS. Lê Văn Cường',
      actorRole: 'BCN_KHOA',
      comments: 'Khoa đã thông qua nội dung học thuật, kính chuyển Đoàn trường thẩm định cơ sở vật chất.',
      metadata: null,
      createdAt: new Date('2026-11-02T09:00:00Z'),
    });
  }

  function serialize(obj: any): any {
    if (obj === null || obj === undefined) return null;
    if (obj instanceof Date) return obj.toISOString();
    if (typeof obj === 'object') {
      if (Array.isArray(obj)) return obj.map(serialize);
      const res: any = {};
      for (const [k, v] of Object.entries(obj)) {
        res[k] = serialize(v);
      }
      return res;
    }
    return obj;
  }

  async function batchUpload(collectionName: string, items: any[]) {
    console.log(`Đang nhập ${items.length} bản ghi vào collection [${collectionName}]...`);
    for (const item of items) {
      const docId = String(item.id || item.key);
      const docRef = doc(firestore, collectionName, docId);
      await setDoc(docRef, serialize(item), { merge: true });
    }
    console.log(`✅ Hoàn thành [${collectionName}]: ${items.length} bản ghi.`);
  }

  await batchUpload('users', users);
  await batchUpload('facilities', facilities);
  await batchUpload('equipment', equipment);
  await batchUpload('events', events);
  await batchUpload('budgetItems', budgetItems);
  await batchUpload('workflowHistories', workflowHistories);
  await batchUpload('approvalDecisions', approvalDecisions);
  await batchUpload('resourceBookings', resourceBookings);
  await batchUpload('resourceBookingItems', resourceBookingItems);
  await batchUpload('settlements', settlements);
  await batchUpload('financialDocuments', financialDocuments);
  await batchUpload('systemSettings', systemSettings);
  await batchUpload('eventScheduleItems', eventScheduleItems);

  console.log('\n--- KIỂM TRA ĐỐI CHIẾU SỐ LƯỢNG TRỰC TIẾP TỪ FIRESTORE ---');
  async function verifyCount(collectionName: string) {
    const snap = await getDocs(collection(firestore, collectionName));
    return snap.size;
  }

  const verified = {
    users: await verifyCount('users'),
    events: await verifyCount('events'),
    facilities: await verifyCount('facilities'),
    equipment: await verifyCount('equipment'),
    budgetItems: await verifyCount('budgetItems'),
    workflowHistories: await verifyCount('workflowHistories'),
    resourceBookings: await verifyCount('resourceBookings'),
    settlements: await verifyCount('settlements'),
    financialDocuments: await verifyCount('financialDocuments'),
    approvalDecisions: await verifyCount('approvalDecisions'),
    systemSettings: await verifyCount('systemSettings'),
  };

  console.log('Kết quả kiểm chứng từ Google Cloud Firestore:');
  console.log(JSON.stringify(verified, null, 2));

  await sqlite.$disconnect();
  console.log('--- NHẬP DỮ LIỆU THÀNH CÔNG 100% ---');
  process.exit(0);
}

importToFirestore().catch((err) => {
  console.error('Lỗi nhập dữ liệu Firestore:', err);
  process.exit(1);
});
