'use client';

import { useApp } from '@/contexts/AppContext';
import PageHeader from '@/components/PageHeader';

export default function ContactPage() {
  const { t } = useApp();

  return (
    <div>
      <PageHeader title={t('contactUs')} />
      <div className="space-y-6 text-slate-700">
        <p className="text-sm leading-relaxed">
          We would love to hear from you. Reach out to URBAN FASHION FACTORY through any of the following channels:
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="font-semibold text-slate-800 mb-1">{t('email')}</h3>
            <p className="text-sm">support@urbanfashionfactory.com</p>
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 mb-1">{t('phoneNumber')}</h3>
            <p className="text-sm">+91 98765 43210</p>
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-slate-800 mb-1">{t('address')}</h3>
          <p className="text-sm">
            URBAN FASHION FACTORY<br />
            Industrial Area, Phase 2<br />
            Bangalore, Karnataka 560058<br />
            India
          </p>
        </div>

        <div>
          <h3 className="font-semibold text-slate-800 mb-1">Business Hours</h3>
          <p className="text-sm">
            Monday – Saturday: 9:00 AM – 6:00 PM<br />
            Sunday: Closed
          </p>
        </div>

        <p className="text-slate-600 text-xs">
          For technical support or account-related queries, please contact your system administrator or HR department.
        </p>
      </div>
    </div>
  );
}
