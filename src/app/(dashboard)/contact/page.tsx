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
          We would love to hear from you. Reach out to Urban Fashion Factory through any of the following channels:
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="font-semibold text-slate-800 mb-1">{t('email')}</h3>
            <p className="text-sm">
              <a href="mailto:info@urbanfashionfactory.com" className="text-uff-accent hover:underline">
                info@urbanfashionfactory.com
              </a>
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 mb-1">Marketing</h3>
            <p className="text-sm">
              <a href="mailto:marketing@urbanfashionfactory.com" className="text-uff-accent hover:underline">
                marketing@urbanfashionfactory.com
              </a>
            </p>
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-slate-800 mb-1">Career</h3>
          <p className="text-sm mb-2">
            Urban Fashion Factory is open to dynamic, self-motivated, young professionals and trainees. Please do not hesitate to send your CV by defining the position you want to apply. All applications will be kept strictly confidential.
          </p>
          <p className="text-sm">
            Please use the Email Id below to send your CV:{' '}
            <a href="mailto:career@urbanfashionfactory.com" className="text-uff-accent hover:underline">
              career@urbanfashionfactory.com
            </a>
          </p>
        </div>

        <p className="text-slate-600 text-xs">
          For technical support or account-related queries related to this management system, please contact your system administrator or HR department.
        </p>
      </div>
    </div>
  );
}
