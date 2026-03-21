'use client';

import { useApp } from '@/contexts/AppContext';
import PageHeader from '@/components/PageHeader';

export default function InfrastructurePage() {
  const { t } = useApp();

  return (
    <div>
      <PageHeader title={t('infrastructure')} />
      <div className="space-y-6 text-slate-700 text-sm leading-relaxed">
        <section>
          <h2 className="font-semibold text-slate-800 mb-2">Sampling</h2>
          <p>
            Innovative designers, computer aided sampling and experienced pattern makers create fast collections and accurate / consistent production.
          </p>
        </section>

        <section>
          <p className="text-slate-600 text-xs">
            For more details about our facilities, please visit our About Us page or Contact Us page.
          </p>
        </section>
      </div>
    </div>
  );
}
