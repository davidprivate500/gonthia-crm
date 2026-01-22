import { NextRequest } from 'next/server';
import { db, contacts, contactTags } from '@/lib/db';
import { requireAuth, requireWriteAccess } from '@/lib/auth/middleware';
import { createContactSchema, contactQuerySchema } from '@/validations/contact';
import { successResponse, validationError, internalError, formatZodErrors, paginatedResponse } from '@/lib/api/response';
import { eq, and, isNull, ilike, or, count } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof Response) {
      return auth;
    }

    const { searchParams } = new URL(request.url);
    const query = contactQuerySchema.parse(Object.fromEntries(searchParams));
    const { page, pageSize, sortBy, sortOrder, search, status, ownerId, companyId } = query;
    const offset = (page - 1) * pageSize;

    // Build where conditions
    const conditions = [
      eq(contacts.tenantId, auth.tenantId),
      isNull(contacts.deletedAt),
    ];

    if (search) {
      conditions.push(
        or(
          ilike(contacts.firstName, `%${search}%`),
          ilike(contacts.lastName, `%${search}%`),
          ilike(contacts.email, `%${search}%`)
        )!
      );
    }

    if (status) {
      conditions.push(eq(contacts.status, status));
    }

    if (ownerId) {
      conditions.push(eq(contacts.ownerId, ownerId));
    }

    if (companyId) {
      conditions.push(eq(contacts.companyId, companyId));
    }

    // Get contacts with relations
    const [contactList, totalResult] = await Promise.all([
      db.query.contacts.findMany({
        where: and(...conditions),
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
        limit: pageSize,
        offset,
        orderBy: (contacts, { asc, desc }) => {
          const orderFn = sortOrder === 'asc' ? asc : desc;
          return [orderFn(contacts[sortBy])];
        },
      }),
      db.select({ count: count() })
        .from(contacts)
        .where(and(...conditions)),
    ]);

    // Transform to include tags array
    const transformedContacts = contactList.map(contact => ({
      ...contact,
      tags: contact.contactTags.map(ct => ct.tag),
      contactTags: undefined,
    }));

    return paginatedResponse(transformedContacts, totalResult[0].count, page, pageSize);
  } catch (error) {
    console.error('List contacts error:', error);
    return internalError();
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireWriteAccess(request);
    if (auth instanceof Response) {
      return auth;
    }

    const body = await request.json();
    const result = createContactSchema.safeParse(body);

    if (!result.success) {
      return validationError(formatZodErrors(result.error));
    }

    const { tagIds: newTagIds, ...contactData } = result.data;

    // Create contact
    const [contact] = await db.insert(contacts).values({
      ...contactData,
      tenantId: auth.tenantId,
      ownerId: contactData.ownerId || auth.userId,
    }).returning();

    // Add tags if provided
    if (newTagIds && newTagIds.length > 0) {
      await db.insert(contactTags).values(
        newTagIds.map(tagId => ({
          contactId: contact.id,
          tagId,
        }))
      );
    }

    // Fetch complete contact with relations
    const completeContact = await db.query.contacts.findFirst({
      where: eq(contacts.id, contact.id),
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
    console.error('Create contact error:', error);
    return internalError();
  }
}
