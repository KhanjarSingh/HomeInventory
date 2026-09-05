'use client';

import React from 'react';
import type { PhysicalBreadcrumbSegmentDto } from '@home-inventory/shared';
import { MapPin, Box, HelpCircle, ChevronRight } from 'lucide-react';

interface BreadcrumbBadgeProps {
  breadcrumbs?: PhysicalBreadcrumbSegmentDto[];
  breadcrumbString?: string;
  className?: string;
  size?: 'sm' | 'md';
}

export function BreadcrumbBadge({
  breadcrumbs,
  breadcrumbString,
  className = '',
  size = 'md',
}: BreadcrumbBadgeProps) {
  // If structured breadcrumbs are not provided, fall back to parsing breadcrumbString
  const segments: PhysicalBreadcrumbSegmentDto[] =
    breadcrumbs && breadcrumbs.length > 0
      ? breadcrumbs
      : breadcrumbString
      ? breadcrumbString.split(' → ').map((name, index, arr) => ({
          type:
            name.toLowerCase() === 'unplaced'
              ? 'unplaced'
              : index === arr.length - 1 && arr.length > 1
              ? 'container'
              : 'location',
          id: `seg-${index}`,
          name: name.trim(),
        }))
      : [{ type: 'unplaced', id: 'unplaced', name: 'Unplaced' }];

  const isSmall = size === 'sm';

  return (
    <nav
      aria-label="Physical Breadcrumb"
      className={`flex flex-wrap items-center gap-1.5 ${className}`}
    >
      {segments.map((seg, idx) => {
        const isLast = idx === segments.length - 1;
        const isLocation = seg.type === 'location';
        const isContainer = seg.type === 'container';
        const isUnplaced = seg.type === 'unplaced';

        let badgeStyle =
          'bg-slate-100 text-slate-700 border-slate-200';
        let icon = <MapPin className={isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5'} />;

        if (isLocation) {
          badgeStyle =
            'bg-blue-50/80 text-blue-800 border-blue-200/80 font-medium';
          icon = <MapPin className={`${isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-blue-600 shrink-0`} />;
        } else if (isContainer) {
          badgeStyle =
            'bg-amber-50/90 text-amber-900 border-amber-300 font-semibold shadow-2xs';
          icon = <Box className={`${isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-amber-600 shrink-0`} />;
        } else if (isUnplaced) {
          badgeStyle =
            'bg-slate-50 text-slate-500 border-dashed border-slate-300 italic';
          icon = <HelpCircle className={`${isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-slate-400 shrink-0`} />;
        }

        return (
          <React.Fragment key={seg.id || idx}>
            <span
              className={`inline-flex items-center gap-1 rounded-md border transition-colors ${
                isSmall ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs sm:text-sm'
              } ${badgeStyle} ${isLast ? 'ring-1 ring-black/5' : ''}`}
              title={`${seg.type.toUpperCase()}: ${seg.name}`}
            >
              {icon}
              <span className="truncate max-w-[160px] sm:max-w-[220px]">
                {seg.name}
              </span>
            </span>

            {!isLast && (
              <ChevronRight
                className={`${
                  isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5'
                } text-slate-300 shrink-0 select-none`}
              />
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
