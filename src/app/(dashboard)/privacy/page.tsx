'use client';

import { useApp } from '@/contexts/AppContext';
import PageHeader from '@/components/PageHeader';

export default function PrivacyPolicyPage() {
  const { t } = useApp();

  return (
    <div>
      <PageHeader title={t('privacyPolicy')} />
      <div className="space-y-6 text-slate-700 text-sm leading-relaxed">
        <p className="text-slate-600 text-xs">Last updated: March 2025</p>

        <section>
          <h2 className="font-semibold text-slate-800 mb-2">1. Introduction</h2>
          <p>
            URBAN FASHION FACTORY (UFF) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our factory management system.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-800 mb-2">2. Information We Collect</h2>
          <p>We collect information that you provide directly to us, including:</p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Name, email address, and contact details</li>
            <li>Employee information (date of birth, emergency contacts, banking details)</li>
            <li>Branch and work assignment data</li>
            <li>Login credentials and usage data</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-slate-800 mb-2">3. How We Use Your Information</h2>
          <p>We use the collected information to:</p>
          <ul className="list-disc pl-6 mt-2 space-y-1">
            <li>Manage factory operations, branches, and employees</li>
            <li>Process payments and maintain financial records</li>
            <li>Communicate with you regarding your account</li>
            <li>Improve our services and user experience</li>
            <li>Comply with legal obligations</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-slate-800 mb-2">4. Data Security</h2>
          <p>
            We implement appropriate technical and organizational measures to protect your personal data against unauthorized access, alteration, disclosure, or destruction.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-800 mb-2">5. Contact Us</h2>
          <p>
            If you have questions about this Privacy Policy, please contact us through the Contact Us page.
          </p>
        </section>
      </div>
    </div>
  );
}
