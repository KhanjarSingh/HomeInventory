'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import type { LocationTreeItemDto, LocationKind } from '@home-inventory/shared';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Box,
  Layers,
  Plus,
  ArrowRight,
  DoorClosed,
  Archive,
  Grid,
} from 'lucide-react';

interface LocationTreeProps {
  nodes: LocationTreeItemDto[];
  canEdit?: boolean;
  onAddChild?: (parentId: string, parentName: string) => void;
}

export function LocationTree({ nodes, canEdit = false, onAddChild }: LocationTreeProps) {
  return (
    <div className="space-y-1">
      {nodes.map((node) => (
        <LocationTreeNode
          key={node.id}
          node={node}
          canEdit={canEdit}
          onAddChild={onAddChild}
          depth={0}
        />
      ))}
    </div>
  );
}

function getLocationIcon(kind: LocationKind) {
  switch (kind) {
    case 'room':
      return <DoorClosed className="w-4 h-4 text-blue-600" />;
    case 'wardrobe':
    case 'cabinet':
      return <Archive className="w-4 h-4 text-purple-600" />;
    case 'shelf':
    case 'rack':
      return <Grid className="w-4 h-4 text-amber-600" />;
    case 'drawer':
    case 'bin':
    case 'storage_area':
      return <Box className="w-4 h-4 text-emerald-600" />;
    default:
      return <Folder className="w-4 h-4 text-slate-500" />;
  }
}

function getKindBadge(kind: LocationKind) {
  const styles: Record<string, string> = {
    room: 'bg-blue-50 text-blue-700 border-blue-200',
    wardrobe: 'bg-purple-50 text-purple-700 border-purple-200',
    cabinet: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    shelf: 'bg-amber-50 text-amber-700 border-amber-200',
    drawer: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rack: 'bg-orange-50 text-orange-700 border-orange-200',
    storage_area: 'bg-slate-100 text-slate-700 border-slate-200',
    furniture: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    bin: 'bg-teal-50 text-teal-700 border-teal-200',
    other: 'bg-slate-100 text-slate-600 border-slate-200',
  };

  return (
    <span
      className={`px-2 py-0.5 rounded text-[11px] font-medium border uppercase tracking-wider ${
        styles[kind] || styles.other
      }`}
    >
      {kind.replace('_', ' ')}
    </span>
  );
}

interface LocationTreeNodeProps {
  node: LocationTreeItemDto;
  canEdit?: boolean;
  onAddChild?: (parentId: string, parentName: string) => void;
  depth: number;
}

function LocationTreeNode({ node, canEdit, onAddChild, depth }: LocationTreeNodeProps) {
  const [isOpen, setIsOpen] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="select-none">
      <div
        className={`flex items-center justify-between p-2.5 rounded-xl border border-transparent hover:border-slate-200 hover:bg-slate-50 transition group ${
          depth === 0 ? 'bg-white shadow-xs mb-1.5 border-slate-200' : 'pl-3'
        }`}
        style={{ marginLeft: `${depth * 1.5}rem` }}
      >
        <div className="flex items-center gap-2 min-w-0">
          {hasChildren ? (
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="p-1 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-200/60 transition"
              title={isOpen ? 'Collapse' : 'Expand'}
            >
              {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          ) : (
            <div className="w-6" />
          )}

          <div className="p-1.5 rounded-lg bg-slate-100 flex items-center justify-center">
            {getLocationIcon(node.kind)}
          </div>

          <Link
            href={`/locations/${node.id}`}
            className="font-semibold text-slate-900 hover:text-blue-600 transition truncate text-sm sm:text-base flex items-center gap-2"
          >
            <span>{node.name}</span>
          </Link>

          {getKindBadge(node.kind)}
        </div>

        <div className="flex items-center gap-2.5 text-xs text-slate-500 shrink-0">
          {/* Direct & Subtree item counts */}
          <div className="flex items-center gap-1.5 hidden sm:flex">
            {node.directItemCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-medium">
                {node.directItemCount} direct {node.directItemCount === 1 ? 'item' : 'items'}
              </span>
            )}

            {node.directContainerCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium flex items-center gap-1">
                <Box className="w-3 h-3" />
                {node.directContainerCount} {node.directContainerCount === 1 ? 'box' : 'boxes'}
              </span>
            )}

            {hasChildren && node.subtreeItemCount > node.directItemCount && (
              <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-medium flex items-center gap-1">
                <Layers className="w-3 h-3" />
                {node.subtreeItemCount} total
              </span>
            )}
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
            {canEdit && onAddChild && (
              <button
                onClick={() => onAddChild(node.id, node.name)}
                title={`Add sublocation under ${node.name}`}
                className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}

            <Link
              href={`/locations/${node.id}`}
              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
              title="View details"
            >
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Render children recursively if expanded */}
      {hasChildren && isOpen && (
        <div className="space-y-1 border-l-2 border-slate-200 ml-4 pl-1">
          {node.children.map((child) => (
            <LocationTreeNode
              key={child.id}
              node={child}
              canEdit={canEdit}
              onAddChild={onAddChild}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
