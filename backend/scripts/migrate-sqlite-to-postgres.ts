import fs from 'fs';
import path from 'path';
import { PrismaClient as SqliteClient } from '@prisma/client';
import { PrismaClient as PostgresClient } from '../generated/postgresql';

async function migrate() {
  const sqliteDbPath = path.resolve(__dirname, '../prisma/dev.db');
  if (!fs.existsSync(sqliteDbPath)) {
    console.error('Source SQLite database not found at:', sqliteDbPath);
    process.exit(1);
  }

  // 1. Create a dated snapshot backup of SQLite source
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.resolve(__dirname, `../prisma/dev.db.snapshot.${timestamp}.bak`);
  fs.copyFileSync(sqliteDbPath, backupPath);
  console.log(`[1/5] Created safe SQLite backup snapshot at: ${backupPath}`);

  // 2. Read SQLite source database
  const sqlite = new SqliteClient({
    datasources: { db: { url: `file:${sqliteDbPath}` } },
  });

  console.log('[2/5] Reading all tables from SQLite source database...');
  const users = await sqlite.user.findMany();
  const passwordResetTokens = await sqlite.passwordResetToken.findMany();
  const facilities = await sqlite.facility.findMany();
  const equipment = await sqlite.equipment.findMany();
  const events = await sqlite.event.findMany();
  const eventVersions = await sqlite.eventVersion.findMany();
  const eventScheduleItems = await sqlite.eventScheduleItem.findMany();
  const budgetItems = await sqlite.budgetItem.findMany();
  const approvalDecisions = await sqlite.approvalDecision.findMany();
  const workflowHistories = await sqlite.workflowHistory.findMany();
  const attachments = await sqlite.attachment.findMany();
  const resourceBookings = await sqlite.resourceBooking.findMany();
  const resourceBookingItems = await sqlite.resourceBookingItem.findMany();
  const handoverRecords = await sqlite.handoverRecord.findMany();
  const returnInspections = await sqlite.returnInspection.findMany();
  const incidentReports = await sqlite.incidentReport.findMany();
  const settlements = await sqlite.settlement.findMany();
  const settlementItems = await sqlite.settlementItem.findMany();
  const financialDocuments = await sqlite.financialDocument.findMany();
  const eventReports = await sqlite.eventReport.findMany();
  const notifications = await sqlite.notification.findMany();
  const auditLogs = await sqlite.auditLog.findMany();
  const systemSettings = await sqlite.systemSetting.findMany();

  const counts: Record<string, number> = {
    User: users.length,
    PasswordResetToken: passwordResetTokens.length,
    Facility: facilities.length,
    Equipment: equipment.length,
    Event: events.length,
    EventVersion: eventVersions.length,
    EventScheduleItem: eventScheduleItems.length,
    BudgetItem: budgetItems.length,
    ApprovalDecision: approvalDecisions.length,
    WorkflowHistory: workflowHistories.length,
    Attachment: attachments.length,
    ResourceBooking: resourceBookings.length,
    ResourceBookingItem: resourceBookingItems.length,
    HandoverRecord: handoverRecords.length,
    ReturnInspection: returnInspections.length,
    IncidentReport: incidentReports.length,
    Settlement: settlements.length,
    SettlementItem: settlementItems.length,
    FinancialDocument: financialDocuments.length,
    EventReport: eventReports.length,
    Notification: notifications.length,
    AuditLog: auditLogs.length,
    SystemSetting: systemSettings.length,
  };

  console.log('[3/5] Source SQLite inventory:', JSON.stringify(counts, null, 2));

  // Save exported JSON data
  const exportJsonPath = path.resolve(__dirname, '../prisma/sqlite_exported_data.json');
  fs.writeFileSync(
    exportJsonPath,
    JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        counts,
        data: {
          users,
          passwordResetTokens,
          facilities,
          equipment,
          events,
          eventVersions,
          eventScheduleItems,
          budgetItems,
          approvalDecisions,
          workflowHistories,
          attachments,
          resourceBookings,
          resourceBookingItems,
          handoverRecords,
          returnInspections,
          incidentReports,
          settlements,
          settlementItems,
          financialDocuments,
          eventReports,
          notifications,
          auditLogs,
          systemSettings,
        },
      },
      null,
      2
    )
  );
  console.log(`[4/5] Serialized full SQLite database to: ${exportJsonPath}`);

  // 3. Generate PostgreSQL INSERT script
  const sqlLines: string[] = [
    '-- Auto-generated SQLite to PostgreSQL migration script for QLQTKD',
    '-- Schema: my_due',
    'CREATE SCHEMA IF NOT EXISTS my_due;',
    'SET search_path TO my_due, public;',
    'BEGIN;',
  ];

  function escapeSql(val: unknown): string {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'number') return String(val);
    if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
    if (val instanceof Date) return `'${val.toISOString()}'::timestamp`;
    if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
    return `'${String(val).replace(/'/g, "''")}'`;
  }

  function generateInserts(tableName: string, rows: Record<string, unknown>[]) {
    if (rows.length === 0) return;
    const columns = Object.keys(rows[0]);
    const quotedCols = columns.map((c) => `"${c}"`).join(', ');
    for (const row of rows) {
      const vals = columns.map((c) => escapeSql(row[c])).join(', ');
      sqlLines.push(`INSERT INTO my_due."${tableName}" (${quotedCols}) VALUES (${vals}) ON CONFLICT ("id") DO NOTHING;`);
    }
  }

  generateInserts('User', users as unknown as Record<string, unknown>[]);
  generateInserts('PasswordResetToken', passwordResetTokens as unknown as Record<string, unknown>[]);
  generateInserts('Facility', facilities as unknown as Record<string, unknown>[]);
  generateInserts('Equipment', equipment as unknown as Record<string, unknown>[]);
  generateInserts('Event', events as unknown as Record<string, unknown>[]);
  generateInserts('EventVersion', eventVersions as unknown as Record<string, unknown>[]);
  generateInserts('EventScheduleItem', eventScheduleItems as unknown as Record<string, unknown>[]);
  generateInserts('BudgetItem', budgetItems as unknown as Record<string, unknown>[]);
  generateInserts('ApprovalDecision', approvalDecisions as unknown as Record<string, unknown>[]);
  generateInserts('WorkflowHistory', workflowHistories as unknown as Record<string, unknown>[]);
  generateInserts('Attachment', attachments as unknown as Record<string, unknown>[]);
  generateInserts('ResourceBooking', resourceBookings as unknown as Record<string, unknown>[]);
  generateInserts('ResourceBookingItem', resourceBookingItems as unknown as Record<string, unknown>[]);
  generateInserts('HandoverRecord', handoverRecords as unknown as Record<string, unknown>[]);
  generateInserts('ReturnInspection', returnInspections as unknown as Record<string, unknown>[]);
  generateInserts('IncidentReport', incidentReports as unknown as Record<string, unknown>[]);
  generateInserts('Settlement', settlements as unknown as Record<string, unknown>[]);
  generateInserts('SettlementItem', settlementItems as unknown as Record<string, unknown>[]);
  generateInserts('FinancialDocument', financialDocuments as unknown as Record<string, unknown>[]);
  generateInserts('EventReport', eventReports as unknown as Record<string, unknown>[]);
  generateInserts('Notification', notifications as unknown as Record<string, unknown>[]);
  generateInserts('AuditLog', auditLogs as unknown as Record<string, unknown>[]);
  generateInserts('SystemSetting', systemSettings as unknown as Record<string, unknown>[]);

  sqlLines.push('COMMIT;');

  const sqlOutPath = path.resolve(__dirname, '../../database/MIGRATE_SQLITE_TO_POSTGRESQL_DATA.sql');
  fs.writeFileSync(sqlOutPath, sqlLines.join('\n'));
  console.log(`[5/5] Generated PostgreSQL migration SQL script at: ${sqlOutPath}`);

  // 4. If target PostgreSQL DATABASE_URL is supplied, execute live migration
  const pgUrl = process.env.TARGET_DATABASE_URL || process.env.DATABASE_URL;
  if (pgUrl && /^postgres(?:ql)?:/.test(pgUrl) && !pgUrl.includes('POOLER_HOST') && !pgUrl.includes('USER:PASSWORD')) {
    console.log('\n[Target PostgreSQL detected] Executing live migration to PostgreSQL...');
    const { Client } = await import('pg');
    const pgClient = new Client({ connectionString: pgUrl });

    try {
      await pgClient.connect();
      console.log('Connected to PostgreSQL successfully.');

      const schemaSql = fs.readFileSync(path.resolve(__dirname, '../../database/01_schema_my_due.sql'), 'utf8');
      console.log('Executing PostgreSQL DDL schema migration (my_due)...');
      await pgClient.query(schemaSql);
      console.log('DDL schema migration succeeded.');

      const seedPath = path.resolve(__dirname, '../../database/seed_data.private.sql');
      if (fs.existsSync(seedPath)) {
        console.log('Executing private seed data migration...');
        const seedSql = fs.readFileSync(seedPath, 'utf8');
        await pgClient.query(seedSql);
        console.log('Seed data migration succeeded.');
      }

      const userCountRes = await pgClient.query('SELECT count(*)::int AS count FROM my_due."User";');
      const eventCountRes = await pgClient.query('SELECT count(*)::int AS count FROM my_due."Event";');
      const facCountRes = await pgClient.query('SELECT count(*)::int AS count FROM my_due."Facility";');

      console.log(`Verification:\n - Users: ${userCountRes.rows[0].count} (SQLite: ${users.length})\n - Events: ${eventCountRes.rows[0].count} (SQLite: ${events.length})\n - Facilities: ${facCountRes.rows[0].count} (SQLite: ${facilities.length})`);
    } catch (err) {
      console.error('PostgreSQL live migration error:', err);
    } finally {
      await pgClient.end();
    }
  } else {
    console.log('\nNotice: No target PostgreSQL connection URL provided in environment.');
    console.log('Migration package (JSON snapshot + SQL script) has been successfully prepared.');
  }

  await sqlite.$disconnect();
  console.log('\nMigration export completed successfully!');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
