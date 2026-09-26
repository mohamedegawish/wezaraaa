import { Sparkles, Percent, Zap, Sun, Banknote, ShieldCheck, Factory, Leaf, TrendingUp, Clock, type LucideIcon } from 'lucide-react';

/** أيقونات المزايا المتاحة للأدمن — iconName يُخزن بالاسم ويُعرض في صفحة المبادرة. */
export const BENEFIT_ICONS: ReadonlyArray<{ name: string; ar: string; en: string; Icon: LucideIcon }> = [
  { name: 'Sparkles', ar: 'مميز', en: 'Highlight', Icon: Sparkles },
  { name: 'Percent', ar: 'فائدة/نسبة', en: 'Rate', Icon: Percent },
  { name: 'Banknote', ar: 'تمويل', en: 'Financing', Icon: Banknote },
  { name: 'Zap', ar: 'كهرباء', en: 'Power', Icon: Zap },
  { name: 'Sun', ar: 'طاقة شمسية', en: 'Solar', Icon: Sun },
  { name: 'Leaf', ar: 'بيئة', en: 'Green', Icon: Leaf },
  { name: 'Factory', ar: 'مصنع', en: 'Factory', Icon: Factory },
  { name: 'TrendingUp', ar: 'نمو/تنافسية', en: 'Growth', Icon: TrendingUp },
  { name: 'ShieldCheck', ar: 'ضمان', en: 'Guarantee', Icon: ShieldCheck },
  { name: 'Clock', ar: 'سرعة/وقت', en: 'Speed', Icon: Clock },
];

export function benefitIcon(name: string | undefined): LucideIcon {
  return BENEFIT_ICONS.find(b => b.name === name)?.Icon ?? Percent;
}
