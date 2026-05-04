const DASHBOARD_SCROLL_OFFSET_MOBILE = 88;
const DASHBOARD_SCROLL_OFFSET_DESKTOP = 104;

export function getDashboardScrollOffset(): number {
  if (typeof window === 'undefined') return DASHBOARD_SCROLL_OFFSET_DESKTOP;
  return window.innerWidth < 640 ? DASHBOARD_SCROLL_OFFSET_MOBILE : DASHBOARD_SCROLL_OFFSET_DESKTOP;
}

export function scrollToElementWithDashboardOffset(element: HTMLElement | null): void {
  if (!element || typeof window === 'undefined') return;

  const top = element.getBoundingClientRect().top + window.scrollY - getDashboardScrollOffset();
  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
}