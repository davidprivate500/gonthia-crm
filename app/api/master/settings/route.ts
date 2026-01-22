import { NextRequest } from 'next/server';
import { db, platformSettings } from '@/lib/db';
import { requireMasterAdmin, requireMasterAdminWithCsrf } from '@/lib/auth/middleware';
import { platformSettingsSchema } from '@/validations/invoice';
import { successResponse, internalError, validationError, formatZodErrors } from '@/lib/api/response';
import { eq } from 'drizzle-orm';

// Get platform settings (issuer info)
export async function GET(request: NextRequest) {
  try {
    const auth = await requireMasterAdmin(request);
    if (auth instanceof Response) {
      return auth;
    }

    // Get the single platform settings record
    const settings = await db.query.platformSettings.findFirst();

    if (!settings) {
      // Return empty object if no settings exist yet
      return successResponse(null);
    }

    return successResponse(settings);
  } catch (error) {
    console.error('Get platform settings error:', error);
    return internalError();
  }
}

// Update or create platform settings
export async function PUT(request: NextRequest) {
  try {
    const auth = await requireMasterAdminWithCsrf(request);
    if (auth instanceof Response) {
      return auth;
    }

    const body = await request.json();
    const result = platformSettingsSchema.safeParse(body);

    if (!result.success) {
      return validationError(formatZodErrors(result.error));
    }

    const settingsData = result.data;

    // Get existing settings
    const existing = await db.query.platformSettings.findFirst();

    if (existing) {
      // Update existing
      const [updated] = await db.update(platformSettings)
        .set({
          ...settingsData,
          updatedAt: new Date(),
        })
        .where(eq(platformSettings.id, existing.id))
        .returning();

      return successResponse(updated);
    } else {
      // Create new
      const [created] = await db.insert(platformSettings)
        .values(settingsData)
        .returning();

      return successResponse(created);
    }
  } catch (error) {
    console.error('Update platform settings error:', error);
    return internalError();
  }
}
