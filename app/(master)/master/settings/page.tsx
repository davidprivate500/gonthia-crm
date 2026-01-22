'use client';

import { useEffect, useState } from 'react';
import { MasterHeader } from '@/components/layout/master-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api/client';
import { Save, Building2, CreditCard, Wallet } from 'lucide-react';

interface PlatformSettings {
  id?: string;
  companyName: string;
  legalName?: string;
  registrationId?: string;
  vatId?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  email?: string;
  phone?: string;
  website?: string;
  logoUrl?: string;
  bankName?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankRoutingNumber?: string;
  bankSwiftCode?: string;
  bankIban?: string;
  cryptoWalletAddress?: string;
  cryptoNetwork?: string;
  paymentInstructions?: string;
  invoicePrefix: string;
  invoiceFooterText?: string;
  defaultCurrency: string;
  defaultPaymentTermsDays: number;
}

const defaultSettings: PlatformSettings = {
  companyName: '',
  invoicePrefix: 'INV',
  defaultCurrency: 'USD',
  defaultPaymentTermsDays: 30,
};

export default function PlatformSettingsPage() {
  const [settings, setSettings] = useState<PlatformSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      setIsLoading(true);
      try {
        const response = await api.master.settings.get();
        if (response.data) {
          setSettings(response.data as PlatformSettings);
        }
      } catch (error) {
        console.error('Failed to fetch settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      await api.master.settings.update(settings as unknown as Record<string, unknown>);
      setSaveMessage('Settings saved successfully');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      const apiError = error as { error?: { message?: string; details?: Record<string, string[]> } };
      const message = apiError?.error?.message || 'Unknown error';
      console.error('Failed to save settings:', message, apiError?.error?.details);
      setSaveMessage(`Failed to save: ${message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = (field: keyof PlatformSettings, value: string | number) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600" />
      </div>
    );
  }

  return (
    <>
      <MasterHeader
        title="Issuer Settings"
        description="Configure your company details for invoices"
        actions={
          <div className="flex items-center gap-3">
            {saveMessage && (
              <span className={`text-sm ${saveMessage.includes('Failed') ? 'text-red-600' : 'text-green-600'}`}>
                {saveMessage}
              </span>
            )}
            <Button onClick={handleSave} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        }
      />

      <div className="p-6">
        <Tabs defaultValue="company" className="space-y-6">
          <TabsList>
            <TabsTrigger value="company" className="gap-2">
              <Building2 className="h-4 w-4" />
              Company
            </TabsTrigger>
            <TabsTrigger value="banking" className="gap-2">
              <CreditCard className="h-4 w-4" />
              Banking
            </TabsTrigger>
            <TabsTrigger value="crypto" className="gap-2">
              <Wallet className="h-4 w-4" />
              Crypto
            </TabsTrigger>
            <TabsTrigger value="invoicing" className="gap-2">
              Invoicing
            </TabsTrigger>
          </TabsList>

          <TabsContent value="company">
            <Card>
              <CardHeader>
                <CardTitle>Company Information</CardTitle>
                <CardDescription>
                  This information will appear on all invoices as the issuer details.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Company Name *</Label>
                    <Input
                      id="companyName"
                      value={settings.companyName}
                      onChange={(e) => updateField('companyName', e.target.value)}
                      placeholder="Your Company Name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="legalName">Legal Name</Label>
                    <Input
                      id="legalName"
                      value={settings.legalName || ''}
                      onChange={(e) => updateField('legalName', e.target.value)}
                      placeholder="Legal Business Name"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="registrationId">Registration ID</Label>
                    <Input
                      id="registrationId"
                      value={settings.registrationId || ''}
                      onChange={(e) => updateField('registrationId', e.target.value)}
                      placeholder="Company Registration Number"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="vatId">VAT ID</Label>
                    <Input
                      id="vatId"
                      value={settings.vatId || ''}
                      onChange={(e) => updateField('vatId', e.target.value)}
                      placeholder="VAT Registration Number"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={settings.address || ''}
                    onChange={(e) => updateField('address', e.target.value)}
                    placeholder="Street Address"
                  />
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={settings.city || ''}
                      onChange={(e) => updateField('city', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State/Province</Label>
                    <Input
                      id="state"
                      value={settings.state || ''}
                      onChange={(e) => updateField('state', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="postalCode">Postal Code</Label>
                    <Input
                      id="postalCode"
                      value={settings.postalCode || ''}
                      onChange={(e) => updateField('postalCode', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      value={settings.country || ''}
                      onChange={(e) => updateField('country', e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={settings.email || ''}
                      onChange={(e) => updateField('email', e.target.value)}
                      placeholder="billing@company.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={settings.phone || ''}
                      onChange={(e) => updateField('phone', e.target.value)}
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="website">Website</Label>
                    <Input
                      id="website"
                      value={settings.website || ''}
                      onChange={(e) => updateField('website', e.target.value)}
                      placeholder="https://company.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="logoUrl">Logo URL</Label>
                    <Input
                      id="logoUrl"
                      value={settings.logoUrl || ''}
                      onChange={(e) => updateField('logoUrl', e.target.value)}
                      placeholder="https://company.com/logo.png"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="banking">
            <Card>
              <CardHeader>
                <CardTitle>Bank Account Details</CardTitle>
                <CardDescription>
                  Banking information for wire transfers and ACH payments.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bankName">Bank Name</Label>
                    <Input
                      id="bankName"
                      value={settings.bankName || ''}
                      onChange={(e) => updateField('bankName', e.target.value)}
                      placeholder="Bank of America"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bankAccountName">Account Name</Label>
                    <Input
                      id="bankAccountName"
                      value={settings.bankAccountName || ''}
                      onChange={(e) => updateField('bankAccountName', e.target.value)}
                      placeholder="Company Inc."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bankAccountNumber">Account Number</Label>
                    <Input
                      id="bankAccountNumber"
                      value={settings.bankAccountNumber || ''}
                      onChange={(e) => updateField('bankAccountNumber', e.target.value)}
                      placeholder="1234567890"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bankRoutingNumber">Routing Number</Label>
                    <Input
                      id="bankRoutingNumber"
                      value={settings.bankRoutingNumber || ''}
                      onChange={(e) => updateField('bankRoutingNumber', e.target.value)}
                      placeholder="021000089"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bankSwiftCode">SWIFT/BIC Code</Label>
                    <Input
                      id="bankSwiftCode"
                      value={settings.bankSwiftCode || ''}
                      onChange={(e) => updateField('bankSwiftCode', e.target.value)}
                      placeholder="BOFAUS3N"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bankIban">IBAN</Label>
                    <Input
                      id="bankIban"
                      value={settings.bankIban || ''}
                      onChange={(e) => updateField('bankIban', e.target.value)}
                      placeholder="US00BOFA00001234567890"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="crypto">
            <Card>
              <CardHeader>
                <CardTitle>Cryptocurrency Payments</CardTitle>
                <CardDescription>
                  Accept payments in cryptocurrency.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cryptoWalletAddress">Wallet Address</Label>
                    <Input
                      id="cryptoWalletAddress"
                      value={settings.cryptoWalletAddress || ''}
                      onChange={(e) => updateField('cryptoWalletAddress', e.target.value)}
                      placeholder="0x..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cryptoNetwork">Network</Label>
                    <Input
                      id="cryptoNetwork"
                      value={settings.cryptoNetwork || ''}
                      onChange={(e) => updateField('cryptoNetwork', e.target.value)}
                      placeholder="Ethereum, Bitcoin, etc."
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invoicing">
            <Card>
              <CardHeader>
                <CardTitle>Invoice Settings</CardTitle>
                <CardDescription>
                  Configure default invoice settings and appearance.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="invoicePrefix">Invoice Number Prefix</Label>
                    <Input
                      id="invoicePrefix"
                      value={settings.invoicePrefix}
                      onChange={(e) => updateField('invoicePrefix', e.target.value)}
                      placeholder="INV"
                      maxLength={10}
                    />
                    <p className="text-xs text-gray-500">
                      Preview: {settings.invoicePrefix}-2024-000001
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="defaultCurrency">Default Currency</Label>
                    <Input
                      id="defaultCurrency"
                      value={settings.defaultCurrency}
                      onChange={(e) => updateField('defaultCurrency', e.target.value.toUpperCase())}
                      placeholder="USD"
                      maxLength={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="defaultPaymentTermsDays">Payment Terms (days)</Label>
                    <Input
                      id="defaultPaymentTermsDays"
                      type="number"
                      value={settings.defaultPaymentTermsDays}
                      onChange={(e) => updateField('defaultPaymentTermsDays', parseInt(e.target.value) || 30)}
                      min={0}
                      max={365}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="paymentInstructions">Payment Instructions</Label>
                  <Textarea
                    id="paymentInstructions"
                    value={settings.paymentInstructions || ''}
                    onChange={(e) => updateField('paymentInstructions', e.target.value)}
                    placeholder="Enter any additional payment instructions that will appear on invoices..."
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="invoiceFooterText">Invoice Footer Text</Label>
                  <Textarea
                    id="invoiceFooterText"
                    value={settings.invoiceFooterText || ''}
                    onChange={(e) => updateField('invoiceFooterText', e.target.value)}
                    placeholder="Thank you for your business!"
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
