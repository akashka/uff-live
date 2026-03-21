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
          <h2 className="font-semibold text-slate-800 mb-2">About Us</h2>
          <p>
            Urban Fashion Factory is a professionally managed Garments Trading &amp; Manufacturing Company. Since it&apos;s inception in the year 2010. The company is mounting appreciably under the vehement direction of it&apos;s directors who are experts in respective domains for manufacturing and Quality Control.
          </p>
          <p className="mt-2">
            We are strategically located in Bangalore also known for it&apos;s high quality &amp; premium garment exports across the globe. We offer our exhaustive range of products at reasonable pricing.
          </p>
          <p className="mt-2">
            We started from Jeans (denims), and now we have complete array of Men&apos;s Wear items. In it&apos;s overall attempt it gives special relevance and emphasis to &quot;Value for Money&quot; approach.
          </p>
          <p className="mt-2">
            We are expert in handling products like Jeans, Jackets, Skirts, Cargo Pants and Shorts etc.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-800 mb-2">Production Capacity &amp; Facilities</h2>
          <p>
            Urban Fashion Factory is having a production capacity of 20000 garments a month to meet requirements of our buyers at any given point of time. With a dedicated production facility, which houses departments such as merchandising, Pattern Making, Cutting, Stitching, Sample Making, Embroidery, Finishing and Packing, it enables us to strict quality controls at every stage of the garment processing from fabric cutting to final Packing.
          </p>
          <p className="mt-2">
            Nowadays washing becomes one of the most important elements in jeanswear. Up-to-date washing technique is a necessity for high quality product. Our factory has set up our own washing laundry in close proximity to our production house in order to implement and design high-tech and unique washing for our customers.
          </p>
          <p className="mt-2">
            Our laundry comfortably can handle all specialize washes for denim, such as Garment Wash, Sand Wash, Stone Wash, Enzyme Wash, Bleach Wash and Sandblast, are comfortably handled by our laundry and we assure high quality of standard.
          </p>
          <p className="mt-2">
            In addition, some trendy washings, such as potassium spray, pigment spray, tinting, garment dyed, color printing, discharge printing, bundle dye, destroyed wash … etc. are application for production in our laundry.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-800 mb-2">Quality &amp; Sample Making</h2>
          <p>
            Moreover, our merchandising team and factory put great effort not only in production but also in sample making and design. A well-equipped pattern workshop and sample-sewing workshop were set up recently with skillful and experienced workers to guarantee fast, neat and accurate samples as our customers requested.
          </p>
          <p className="mt-2">
            We highly understand that &apos;SUPERIOR QUALITY&apos; is a must for our customers, so we believe, is the promptness and short production lead-time, which would be their fundamental demands. As timing is highly important for fashionable goods and directly affects sales volume, thus we focus on producing high quality goods as well as maintaining decent production efficiency in order to meet buyers&apos; tight delivery schedule.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-800 mb-2">Our Prospect</h2>
          <p>
            Our merchandising team provides energetic aids and professional advices in the whole production process. We are confident and comfortable to handle each client comprehensively and independently.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-800 mb-2">Mission</h2>
          <p>
            To reinvent a profitable and reliable company recognized worldwide, and leader in its market. To generate jobs that contributes to the growth and future development of India.
          </p>
        </section>

        <section>
          <h2 className="font-semibold text-slate-800 mb-2">Values</h2>
          <p className="mb-2">
            At Urban Fashion Factory, our values are the foundation of our employee and company culture. They define the manner in which we do business, engage our customers, and conduct our work and processes:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Focusing on competitive quality</li>
            <li>Implementing Lean Manufacturing</li>
            <li>Achieving Cost Efficiency</li>
            <li>Reducing Time-to-Market</li>
            <li>Exceeding Customer Expectations</li>
            <li>Outsourcing Processes</li>
            <li>Having a Global Perspective</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-slate-800 mb-2">Get in Touch</h2>
          <p>
            For more information about Urban Fashion Factory, please visit our Contact Us page.
          </p>
        </section>
      </div>
    </div>
  );
}
