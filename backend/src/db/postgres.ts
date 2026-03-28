// [PRODUCTNAME] PostgreSQL — API Key validation via Prisma
import { createHash } from 'crypto';

// Prisma client is lazy-loaded to avoid issues when PostgreSQL isn't available
let prismaClient: any = null;

async function getPrisma() {
  if (!prismaClient) {
    try {
      const { PrismaClient } = await import('@prisma/client');
      prismaClient = new PrismaClient();
    } catch {
      return null;
    }
  }
  return prismaClient;
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export async function validateApiKey(key: string): Promise<{ valid: boolean; projectId?: string }> {
  const prisma = await getPrisma();
  if (!prisma) {
    // If Prisma/PostgreSQL not available, allow requests in dev mode
    if (process.env.NODE_ENV !== 'production') {
      return { valid: true };
    }
    return { valid: false };
  }

  const keyHash = hashApiKey(key);

  try {
    const apiKey = await prisma.apiKey.findUnique({
      where: { keyHash },
      include: { project: true },
    });

    if (!apiKey || !apiKey.isActive) {
      return { valid: false };
    }

    // Update lastUsed timestamp (non-blocking)
    prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsed: new Date() },
    }).catch(() => {});

    return { valid: true, projectId: apiKey.projectId };
  } catch {
    return { valid: false };
  }
}

export async function createProject(name: string): Promise<any> {
  const prisma = await getPrisma();
  if (!prisma) throw new Error('PostgreSQL not available');

  return prisma.project.create({ data: { name } });
}

export async function createApiKey(projectId: string, rawKey: string, label?: string): Promise<any> {
  const prisma = await getPrisma();
  if (!prisma) throw new Error('PostgreSQL not available');

  const keyHash = hashApiKey(rawKey);
  return prisma.apiKey.create({
    data: { keyHash, projectId, label },
  });
}
