import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { mockUsers, mockFacilities, mockEquipment } from '../../frontend/src/data/mockData';

// Only add missing reference data. Never erase events or reset existing passwords.
const prisma = new PrismaClient();
async function main() {
  const passwordHash = await bcrypt.hash('123456', 10);
  for (const user of mockUsers) {
    const existing = await prisma.user.findFirst({
      where: { OR: [{ id: user.id }, { email: user.email }] },
    });
    if (!existing) {
      await prisma.user.create({
        data: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          department: user.department,
          phone: user.phone,
          passwordHash,
        },
      });
    }
  }
  for (const f of mockFacilities) {
    const existing = await prisma.facility.findFirst({
      where: { OR: [{ id: f.id }, { code: f.code }] },
    });
    if (!existing) {
      await prisma.facility.create({
        data: {
          id: f.id,
          code: f.code,
          name: f.name,
          location: f.location,
          capacity: f.capacity,
          type: f.type,
          description: f.description,
          amenities: JSON.stringify(f.amenities),
        },
      });
    }
  }
  for (const e of mockEquipment) {
    const existing = await prisma.equipment.findFirst({
      where: { OR: [{ id: e.id }, { code: e.code }] },
    });
    if (!existing) {
      await prisma.equipment.create({
        data: {
          id: e.id,
          code: e.code,
          name: e.name,
          type: e.type,
          totalQuantity: e.totalQuantity,
          condition: e.condition,
        },
      });
    }
  }
  console.log('Reference data ready. Existing events and accounts were preserved.');
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
