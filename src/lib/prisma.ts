import {
  PrismaClient,
  Emissions,
  Metadata,
  Scope1,
  Scope2,
  Company,
} from '@prisma/client'

export const prisma = new PrismaClient()

// type X = Parameters<typeof prisma.scope1.update>[0]

// TODO: use actual types inferred from Parameters<typeof prisma.scope1.update>
export async function updateScope1(
  emissions: Emissions,
  scope1: Scope1,
  metadata: Metadata
) {
  return emissions.scope1Id
    ? await prisma.scope1.update({
        where: {
          id: emissions.scope1Id,
        },
        data: {
          ...scope1,
          metadata: {
            create: {
              ...metadata,
            },
          },
        },
        select: { id: true },
      })
    : await prisma.scope1.create({
        data: {
          ...scope1,
          unit: tCO2e,
          metadata: {
            create: {
              ...metadata,
            },
          },
        },
        select: { id: true },
      })
}

export async function updateScope2(
  emissions: Emissions,
  scope2: Scope2,
  metadata: Metadata
) {
  return emissions.scope2Id
    ? await prisma.scope2.update({
        where: {
          id: emissions.scope2Id,
        },
        data: {
          ...scope2,
          metadata: {
            create: {
              ...metadata,
            },
          },
        },
        select: { id: true },
      })
    : await prisma.scope2.create({
        data: {
          ...scope2,
          unit: tCO2e,
          metadata: {
            create: {
              ...metadata,
            },
          },
        },
        select: { id: true },
      })
}

export async function upsertReportingPeriod(
  company: Company,
  metadata: Metadata,
  startDate: Date,
  endDate: Date
) {
  const reportingPeriod =
    (await prisma.reportingPeriod.findFirst({
      where: {
        companyId: company.wikidataId,
        endDate: endDate,
      },
    })) ||
    (await prisma.reportingPeriod.create({
      data: {
        startDate,
        endDate,
        company: {
          connect: {
            wikidataId: company.wikidataId,
          },
        },
        metadata: {
          create: metadata,
        },
      },
    }))
  return reportingPeriod
}
