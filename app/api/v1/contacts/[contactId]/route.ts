import { NextRequest } from 'next/server';
import { db, contacts, contactTags } from '@/lib/db';
import { requireTenantAuth, requireTenantWriteAccess, requireTenantDeleteAccess } from '@/lib/auth/middleware';
import { updateContactSchema } from '@/validations/contact';
import { successResponse, validationError, notFoundError, internalError, formatZodErrors } from '@/lib/api/response';
import { eq, and, isNull } from 'drizzle-orm';

interface RouteParams {
  params: Promise<{ contactId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireTenantAuth(request);
    if (auth instanceof Response) {
      return auth;
    }

    const { contactId } = await params;

    const contact = await db.query.contacts.findFirst({
      where: and(
        eq(contacts.id, contactId),
        eq(contacts.tenantId, auth.tenantId),
        isNull(contacts.deletedAt)
      ),
      with: {
        company: {
          columns: { id: true, name: true },
        },
        owner: {
          columns: { id: true, firstName: true, lastName: true, email: true },
        },
        contactTags: {
          with: {
            tag: true,
          },
        },
        activities: {
          limit: 10,
          orderBy: (activities, { desc }) => [desc(activities.createdAt)],
        },
        deals: {
          where: isNull(contacts.deletedAt),
          with: {
            stage: true,
          },
        },
      },
    });

    if (!contact) {
      return notFoundError('Contact not found');
    }

    return successResponse({
      contact: {
        ...contact,
        tags: contact.contactTags.map(ct => ct.tag),
        contactTags: undefined,
      },
    });
  } catch (error) {
    console.error('Get contact error:', error);
    return internalError();
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireTenantWriteAccess(request);
    if (auth instanceof Response) {
      return auth;
    }

    const { contactId } = await params;
    const body = await request.json();
    const result = updateContactSchema.safeParse(body);

    if (!result.success) {
      return validationError(formatZodErrors(result.error));
    }

    // Verify contact exists and belongs to tenant
    const existing = await db.query.contacts.findFirst({
      where: and(
        eq(contacts.id, contactId),
        eq(contacts.tenantId, auth.tenantId),
        isNull(contacts.deletedAt)
      ),
    });

    if (!existing) {
      return notFoundError('Contact not found');
    }

    const { tagIds, ...updateData } = result.data;

    // Update contact
    await db.update(contacts)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(contacts.id, contactId));

    // Update tags if provided
    if (tagIds !== undefined) {
      // Remove existing tags
      await db.delete(contactTags)
        .where(eq(contactTags.contactId, contactId));

      // Add new tags
      if (tagIds.length > 0) {
        await db.insert(contactTags).values(
          tagIds.map(tagId => ({
            contactId,
            tagId,
          }))
        );
      }
    }

    // Fetch complete contact
    const completeContact = await db.query.contacts.findFirst({
      where: eq(contacts.id, contactId),
      with: {
        company: {
          columns: { id: true, name: true },
        },
        owner: {
          columns: { id: true, firstName: true, lastName: true, email: true },
        },
        contactTags: {
          with: {
            tag: true,
          },
        },
      },
    });

    return successResponse({
      contact: {
        ...completeContact,
        tags: completeContact?.contactTags.map(ct => ct.tag),
        contactTags: undefined,
      },
    });
  } catch (error) {
    console.error('Update contact error:', error);
    return internalError();
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireTenantDeleteAccess(request);
    if (auth instanceof Response) {
      return auth;
    }

    const { contactId } = await params;

    // Verify contact exists and belongs to tenant
    const existing = await db.query.contacts.findFirst({
      where: and(
        eq(contacts.id, contactId),
        eq(contacts.tenantId, auth.tenantId),
        isNull(contacts.deletedAt)
      ),
    });

    if (!existing) {
      return notFoundError('Contact not found');
    }

    // Soft delete
    await db.update(contacts)
      .set({ deletedAt: new Date() })
      .where(eq(contacts.id, contactId));

    return successResponse({ message: 'Contact deleted' });
  } catch (error) {
    console.error('Delete contact error:', error);
    return internalError();
  }
}
