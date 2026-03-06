'use client';

import { useApp } from '@/contexts/AppContext';
import PageHeader from '@/components/PageHeader';

const faqs = [
  {
    q: 'How do I reset my password?',
    a: 'Click on "Forgot Password?" on the login page. Enter your registered email address and we will send you an OTP. Use the OTP to reset your password.',
  },
  {
    q: 'How do I update my banking details?',
    a: 'Go to Profile from the main menu. Click Edit and update your bank name, branch, IFSC code, account number, and UPI ID. Save your changes.',
  },
  {
    q: 'Who can create and manage branches?',
    a: 'Only Admin users can create, edit, and manage branches. Contact your administrator if you need branch-related changes.',
  },
  {
    q: 'Who can manage the Rate Master?',
    a: 'The Rate Master (stitching rates, etc.) can only be created, edited, or made inactive by Admin users.',
  },
  {
    q: 'How do I change the language?',
    a: 'Use the language selector (EN/KN/HI) in the top-right corner of the header to switch between English, Kannada, and Hindi.',
  },
  {
    q: 'How do I adjust the font size?',
    a: 'Use the A+ and A- buttons in the header to increase or decrease the font size for better readability.',
  },
  {
    q: 'What roles exist in the system?',
    a: 'The system has four roles: Admin (full access), Finance (employees & profile), HR (employees & profile), and Employee (profile only).',
  },
  {
    q: 'Who do I contact for technical issues?',
    a: 'Contact your system administrator or reach out through the Contact Us page for technical support.',
  },
];

export default function FAQPage() {
  const { t } = useApp();

  return (
    <div>
      <PageHeader title={t('faq')} />
      <div className="space-y-4">
        {faqs.map((faq, i) => (
          <div key={i} className="border-b border-slate-200 pb-4 last:border-0 last:pb-0">
            <h3 className="font-semibold text-slate-800 mb-2">{faq.q}</h3>
            <p className="text-sm text-slate-800 leading-relaxed">{faq.a}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
