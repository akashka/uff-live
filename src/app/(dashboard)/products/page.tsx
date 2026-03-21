'use client';

import { useApp } from '@/contexts/AppContext';
import PageHeader from '@/components/PageHeader';

const productStyles = [
  'Alaska',
  'Arizona',
  'Camino',
  'Charlot',
  'Chloris',
  'Georgia',
  'Idaho',
  'Iowa',
  'Jetstar',
  'Kentucky',
  'Louisiana',
  'Maine',
  'Marlin',
  'Opala',
  'Picked',
  'Proxy',
  'Proxy 2',
  'Proxy 82',
  'Super',
  'Vibe',
  'Wyoming',
];

export default function ProductsPage() {
  const { t } = useApp();

  return (
    <div>
      <PageHeader title={t('products')} />
      <div className="space-y-6 text-slate-700">
        <p className="text-sm leading-relaxed">
          Urban Fashion Factory offers an exhaustive range of denim and men&apos;s wear products. We are experts in Jeans, Jackets, Skirts, Cargo Pants and Shorts. Our product line includes the following styles — Guts and Glory:
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {productStyles.map((style) => (
            <div
              key={style}
              className="border border-slate-200 rounded-lg p-4 bg-white hover:border-uff-accent/50 transition-colors"
            >
              <h3 className="font-semibold text-slate-800">{style}</h3>
              <p className="text-xs text-slate-600 mt-1">Guts and Glory</p>
            </div>
          ))}
        </div>

        <p className="text-slate-600 text-xs">
          For detailed product inquiries or to place an order, please visit our{' '}
          <a href="https://urbanfashionfactory.com/product_gallery.html" target="_blank" rel="noopener noreferrer" className="text-uff-accent hover:underline">
            Product Gallery
          </a>
          {' '}on our official website or contact us through our Contact page.
        </p>
      </div>
    </div>
  );
}
