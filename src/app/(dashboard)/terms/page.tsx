'use client';

import { useApp } from '@/contexts/AppContext';
import PageHeader from '@/components/PageHeader';

export default function TermsPage() {
  const { t } = useApp();

  return (
    <div>
      <PageHeader title={t('termsAndConditions')} />
      <div className="space-y-6 text-slate-700 text-sm leading-relaxed">
        <p className="text-slate-600 text-xs">Last updated: March 2025</p>

        <section>
          <h2 className="font-semibold text-slate-800 mb-2">1. Acceptance of Terms</h2>
          <p>
            By accessing and using the URBAN FASHION FACTORY (UFF) management system, you accept and agree to be bound by these Terms and Conditions. If you do not agree, please do not use this system.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-800 mb-2">2. Use of the System</h2>
          <p>You agree to:</p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Use the system only for lawful purposes related to factory operations</li>
            <li>Maintain the confidentiality of your login credentials</li>
            <li>Not share your account with unauthorized persons</li>
            <li>Provide accurate and complete information</li>
            <li>Comply with all applicable laws and company policies</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-slate-800 mb-2">3. Access and Roles</h2>
          <p>
            Access to different features is determined by your role (Admin, Finance, HR, Employee). You may only access and perform actions permitted for your assigned role.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-800 mb-2">4. Intellectual Property</h2>
          <p>
            All content, features, and functionality of this system are owned by URBAN FASHION FACTORY and are protected by applicable intellectual property laws.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-800 mb-2">5. Modifications</h2>
          <p>
            We reserve the right to modify these terms at any time. Continued use of the system after changes constitutes acceptance of the modified terms.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-800 mb-2">6. Contact</h2>
          <p>
            For questions regarding these Terms and Conditions, please visit our Contact Us page.
          </p>
        </section>
      </div>
    </div>
  );
}
