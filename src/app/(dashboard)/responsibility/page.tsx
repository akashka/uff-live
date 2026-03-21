'use client';

import { useApp } from '@/contexts/AppContext';
import PageHeader from '@/components/PageHeader';

export default function ResponsibilityPage() {
  const { t } = useApp();

  return (
    <div>
      <PageHeader title={t('responsibility')} />
      <div className="space-y-6 text-slate-700 text-sm leading-relaxed">
        <section>
          <h2 className="font-semibold text-slate-800 mb-4">Investor Relations &amp; Social Commitment</h2>

          <h3 className="font-medium text-slate-800 mb-2 mt-4">Sustainable Trade</h3>
          <p>
            Our goal is to offer the best products with optimum control over quality and costs. To do this, we balance our sourcing and strive for sustainable trade.
          </p>
          <p className="mt-2">
            We believe that sustainable trade is about respect for our suppliers and the communities that depend on them, as well as protecting the planet. We choose our suppliers carefully and invest energy into these relationships. In the developing world, we build trust, responsibility and ambition to help our suppliers create businesses that are both commercially and ecologically sustainable.
          </p>

          <h3 className="font-medium text-slate-800 mb-2 mt-4">Climate Changes</h3>
          <p>
            Climate change has business implications. These include rising energy costs and the need to reduce CO2 emissions. We believe in acting on facts. So we are currently conducting in-depth research to provide us with a clear way forward. The results will dictate the targets we set.
          </p>
          <p className="mt-2">
            Our long-term goal is to combine our drive for increased efficiency and reduced costs, with supporting the fight against climate change. These efforts make sense for our business. Customers are starting to become more aware of the environment and finding ways on how to contribute to the green cause. Clothing and apparel fashion is one of them and rather than patronizing the harmful clothes that others have manufactured before, green fashion trends are sure to provide something more for them.
          </p>
        </section>

        <section>
          <p className="text-slate-600 text-xs">
            For more information about our commitment to sustainability, please visit our Contact Us page.
          </p>
        </section>
      </div>
    </div>
  );
}
