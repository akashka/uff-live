'use client';

import { useApp } from '@/contexts/AppContext';
import PageHeader from '@/components/PageHeader';

export default function AboutPage() {
  const { t } = useApp();

  return (
    <div>
      <PageHeader title={t('aboutUs')} />
      <div className="space-y-6 text-slate-700 text-sm leading-relaxed">
        <section>
          <h2 className="font-semibold text-slate-800 mb-2">About URBAN FASHION FACTORY</h2>
          <p>
            URBAN FASHION FACTORY (UFF) is a modern garment manufacturing company dedicated to producing quality fashion wear. We operate across multiple branches and are committed to excellence in craftsmanship, timely delivery, and sustainable practices.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-800 mb-2">Our Mission</h2>
          <p>
            To deliver high-quality fashion products while maintaining transparency in operations, supporting our workforce, and building lasting relationships with our partners and customers.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-800 mb-2">What We Do</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Garment manufacturing and stitching</li>
            <li>Multi-branch operations management</li>
            <li>Employee and workforce management</li>
            <li>Rate-based production tracking</li>
            <li>Payment and financial record-keeping</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-slate-800 mb-2">This Management System</h2>
          <p>
            This platform helps us manage branches, employees, rates, and operations efficiently. It supports role-based access, multiple languages (English, Kannada, Hindi), and accessibility features to ensure everyone can use the system effectively.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-800 mb-2">Get in Touch</h2>
          <p>
            For more information about URBAN FASHION FACTORY, please visit our Contact Us page.
          </p>
        </section>
      </div>
    </div>
  );
}
