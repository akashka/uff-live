'use client';

import { useApp } from '@/contexts/AppContext';
import PageHeader from '@/components/PageHeader';

export default function GlossaryPage() {
  const { t } = useApp();

  return (
    <div>
      <PageHeader title={t('denimGlossary')} />
      <div className="space-y-6 text-slate-700 text-sm leading-relaxed">
        <section>
          <h2 className="font-semibold text-slate-800 mb-4">Denim Glossary — History</h2>

          <h3 className="font-medium text-slate-800 mb-2 mt-4">18th century</h3>
          <p>
            Slaves wore &quot;jean&quot; cloth, or denim, because the material was highly resistant to wear and tear. Strong and durable, it was perfect for rough work while at the same time providing a degree of freshness for working in the U.S. cotton plantations.
          </p>

          <h3 className="font-medium text-slate-800 mb-2 mt-4">19th century</h3>
          <p>
            During the California gold rush, the miners needed strong clothes that wouldn&apos;t tear easily. In 1853 Leob Strauss set up business selling denim clothing. Later, Mr. Strauss changed his name Leob to Levi.
          </p>

          <h3 className="font-medium text-slate-800 mb-2 mt-4">20th century</h3>
          <p>
            In the 1930s, denim became popular, because cowboys wore it in the movies.
          </p>
          <p className="mt-2">
            During the 40s fewer jeans were made because of the Second World War, but soldiers wore them to relax in. Because photographs and documentaries showed this, denim became a patriotic product.
          </p>
          <p className="mt-2">
            By the 1950s denim was popular among youth. It was a symbol of the younger generation&apos;s rebellion on TV and in the movies—what better example than the movie, Rebel Without a Cause, starring James Dean. The association between denim and rebelliousness reached such extremes that some American schools banned the fabric.
          </p>
          <p className="mt-2">
            During the 60s and 70s, in the midst of the Cold War, the USA witnessed the rise of the hippie movement, along with a great variety of jeans styles: embroidered, painted, psychedelic etc. For many other countries these images (and denim included) were a symbol of western decadence.
          </p>
          <p className="mt-2">
            In the 80s, designer jeans appeared on the market, with the brand name and designer&apos;s signature making them a high fashion product. Jeans went from being a basic product to a fashion symbol, and sales and prices boomed.
          </p>
          <p className="mt-2">
            The 90s saw the start of a recession in denim use. Even though jeans never went completely out of fashion, the young market was not interested in traditional jeans, maybe because older people still wore them. Naturally young people didn&apos;t wanted to put on anything that their parents wore. Teenagers started to wear chinos and carpenter khakis, etc. Those who did still wear jeans preferred new cuts and finishes or vintage originals, as well as jeans bought in second-hand stores, leading to a worldwide reduction in denim consumption. Denim made its reappearance in the late 20th and early 21st centuries, thanks to esthetic changes to the fabric.
          </p>

          <h3 className="font-medium text-slate-800 mb-2 mt-4">21st century</h3>
          <p>
            In fashion again, denim is seen on the catwalks of Chanel, Dior, Gucci, Chloe and Versace, Helmut Lang, D&amp;Graph, Prada, Donna Karan and others. Silver paint, foil and glittery finishes on denim create products that are much more than just basic and that gradually enter the mass market. As time goes by, more washes, tints, abrasion, grinding and appliqués are used to change the appearance of the final article and with them, prices and variety to choose from expand. This encourages the upholstery and interior design market to launch denim-based collections, with denim cushions, comforters and wallpaper being seen more and more.
          </p>
          <p className="mt-2">
            The new washes and finishes become ever more varied in a war of creativity aimed at finding out just how far destruction and recycling can go to give denim new proportions, visual and esthetic qualities, textures, etc. Among the most often seen effects at the start of this century are all kinds of stone, enzyme and bleach washes, as well as finishes with foil, glitter, resins, sand blasting, hand sanding, permanganate, tints, abrasion and grinding, destruction, crushes and lately raw denim.
          </p>
        </section>
      </div>
    </div>
  );
}
