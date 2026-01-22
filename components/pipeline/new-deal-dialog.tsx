'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { api } from '@/lib/api/client';

interface Stage {
  id: string;
  name: string;
  color: string | null;
}

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
}

interface Company {
  id: string;
  name: string;
}

interface NewDealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages: Stage[];
  onSuccess: () => void;
}

export function NewDealDialog({ open, onOpenChange, stages, onSuccess }: NewDealDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);

  const [formData, setFormData] = useState({
    title: '',
    value: '',
    stageId: stages[0]?.id || '',
    contactId: '',
    companyId: '',
    expectedCloseDate: '',
    notes: '',
  });

  useEffect(() => {
    if (open) {
      const fetchData = async () => {
        try {
          const [contactsRes, companiesRes] = await Promise.all([
            api.contacts.list({ pageSize: 100 }),
            api.companies.list({ pageSize: 100 }),
          ]);
          if (contactsRes.data) setContacts(contactsRes.data as Contact[]);
          if (companiesRes.data) setCompanies(companiesRes.data as Company[]);
        } catch (error) {
          console.error('Failed to fetch data:', error);
        }
      };
      fetchData();
    }
  }, [open]);

  useEffect(() => {
    if (stages.length > 0 && !formData.stageId) {
      setFormData((f) => ({ ...f, stageId: stages[0].id }));
    }
  }, [stages, formData.stageId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await api.deals.create({
        title: formData.title,
        value: formData.value ? parseFloat(formData.value) : null,
        stageId: formData.stageId,
        contactId: formData.contactId || null,
        companyId: formData.companyId || null,
        expectedCloseDate: formData.expectedCloseDate || null,
        notes: formData.notes || null,
      });

      onSuccess();
      onOpenChange(false);
      setFormData({
        title: '',
        value: '',
        stageId: stages[0]?.id || '',
        contactId: '',
        companyId: '',
        expectedCloseDate: '',
        notes: '',
      });
    } catch (err: unknown) {
      const error = err as { error?: { message?: string } };
      setError(error.error?.message || 'Failed to create deal');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Deal</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="title">Deal title *</Label>
            <Input
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              placeholder="e.g., Enterprise License"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="value">Value</Label>
              <Input
                id="value"
                name="value"
                type="number"
                min="0"
                step="0.01"
                value={formData.value}
                onChange={handleChange}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stageId">Stage *</Label>
              <Select
                value={formData.stageId}
                onValueChange={(value) => setFormData({ ...formData, stageId: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: stage.color || '#6366f1' }}
                        />
                        {stage.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contactId">Contact</Label>
            <Select
              value={formData.contactId || "none"}
              onValueChange={(value) => setFormData({ ...formData, contactId: value === "none" ? "" : value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select contact" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No contact</SelectItem>
                {contacts.map((contact) => (
                  <SelectItem key={contact.id} value={contact.id}>
                    {contact.firstName} {contact.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="companyId">Company</Label>
            <Select
              value={formData.companyId || "none"}
              onValueChange={(value) => setFormData({ ...formData, companyId: value === "none" ? "" : value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select company" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No company</SelectItem>
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expectedCloseDate">Expected close date</Label>
            <Input
              id="expectedCloseDate"
              name="expectedCloseDate"
              type="date"
              value={formData.expectedCloseDate}
              onChange={handleChange}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={2}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? 'Creating...' : 'Create Deal'}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
