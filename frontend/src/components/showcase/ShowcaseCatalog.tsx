import React from 'react';
import { usePlatformStore } from '../../store/state';
import { InitiativesView } from './InitiativesView';
import { InitiativeDetailPage } from './InitiativeDetailPage';

/**
 * ShowcaseCatalog — غلاف رقيق للتوافق مع App الحالي (يستورد هذا الـexport).
 * يوجّه بين الكتالوج الخفيف وصفحة المبادرة المنفصلة حسب activeView.
 */
export const ShowcaseCatalog: React.FC = () => {
  const { activeView } = usePlatformStore();
  if (activeView === 'initiative-detail') return <InitiativeDetailPage />;
  return <InitiativesView />;
};
