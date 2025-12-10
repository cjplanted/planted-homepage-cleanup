/**
 * VenueTree Component
 *
 * Hierarchical tree view of venues organized by Country > Venue Type > Chain > Venue.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/shared/ui/Badge';
import {
  BrowserHierarchyNode,
  COUNTRY_EMOJIS,
  STATUS_EMOJIS,
} from '../types';

interface VenueTreeProps {
  hierarchy: BrowserHierarchyNode[];
  selectedVenueId?: string;
  onSelectVenue: (venueId: string) => void;
  className?: string;
}

/**
 * VenueTree Component
 */
export function VenueTree({
  hierarchy,
  selectedVenueId,
  onSelectVenue,
  className,
}: VenueTreeProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Flatten hierarchy for keyboard navigation
  const flattenedNodes = useCallback(() => {
    const flattened: BrowserHierarchyNode[] = [];
    const traverse = (nodes: BrowserHierarchyNode[]) => {
      nodes.forEach((node) => {
        flattened.push(node);
        if (expandedNodes.has(node.id) && node.children) {
          traverse(node.children);
        }
      });
    };
    traverse(hierarchy);
    return flattened;
  }, [hierarchy, expandedNodes]);

  // Toggle node expansion
  const toggleNode = useCallback((nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!containerRef.current?.contains(document.activeElement)) {
        return;
      }

      const nodes = flattenedNodes();
      const currentIndex = focusedNodeId
        ? nodes.findIndex((n) => n.id === focusedNodeId)
        : -1;

      switch (e.key) {
        case 'ArrowDown':
        case 'j': {
          e.preventDefault();
          const nextIndex = Math.min(currentIndex + 1, nodes.length - 1);
          const nextNode = nodes[nextIndex];
          if (nextNode) {
            setFocusedNodeId(nextNode.id);
            if (nextNode.type === 'venue' && nextNode.venue) {
              onSelectVenue(nextNode.venue.id);
            }
          }
          break;
        }
        case 'ArrowUp':
        case 'k': {
          e.preventDefault();
          const prevIndex = Math.max(currentIndex - 1, 0);
          const prevNode = nodes[prevIndex];
          if (prevNode) {
            setFocusedNodeId(prevNode.id);
            if (prevNode.type === 'venue' && prevNode.venue) {
              onSelectVenue(prevNode.venue.id);
            }
          }
          break;
        }
        case 'ArrowRight':
        case 'l': {
          e.preventDefault();
          const currentNode = nodes[currentIndex];
          if (currentNode && currentNode.children && !expandedNodes.has(currentNode.id)) {
            toggleNode(currentNode.id);
          }
          break;
        }
        case 'ArrowLeft':
        case 'h': {
          e.preventDefault();
          const currentNode = nodes[currentIndex];
          if (currentNode && expandedNodes.has(currentNode.id)) {
            toggleNode(currentNode.id);
          }
          break;
        }
        case 'Enter': {
          e.preventDefault();
          const currentNode = nodes[currentIndex];
          if (currentNode) {
            if (currentNode.type === 'venue' && currentNode.venue) {
              onSelectVenue(currentNode.venue.id);
            } else if (currentNode.children) {
              toggleNode(currentNode.id);
            }
          }
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedNodeId, flattenedNodes, expandedNodes, toggleNode, onSelectVenue]);

  // Render a single node
  const renderNode = (node: BrowserHierarchyNode, depth = 0): JSX.Element => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const isVenue = node.type === 'venue';
    const isSelected = isVenue && node.venue?.id === selectedVenueId;
    const isFocused = node.id === focusedNodeId;

    const handleClick = () => {
      setFocusedNodeId(node.id);
      if (isVenue && node.venue) {
        onSelectVenue(node.venue.id);
      } else if (hasChildren) {
        toggleNode(node.id);
      }
    };

    // Get icon based on node type
    const getNodeIcon = () => {
      switch (node.type) {
        case 'country':
          return COUNTRY_EMOJIS[node.id] || '🌍';
        case 'venueType':
          return '🏪';
        case 'chain':
          return '🔗';
        case 'venue':
          return node.venue ? STATUS_EMOJIS[node.venue.status] : '📍';
        default:
          return '•';
      }
    };

    return (
      <div key={node.id}>
        <button
          onClick={handleClick}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors text-left',
            'hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring',
            isSelected && 'bg-primary/10 text-primary font-medium',
            isFocused && 'ring-2 ring-ring',
            !isSelected && !isFocused && 'text-foreground'
          )}
          style={{ paddingLeft: `${depth * 20 + 12}px` }}
          tabIndex={0}
        >
          {hasChildren && (
            <span className="flex-shrink-0">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </span>
          )}
          {!hasChildren && <span className="w-4" />}
          <span className="flex-shrink-0">{getNodeIcon()}</span>
          <span className="flex-1 truncate">{node.label}</span>
          <Badge variant="secondary" className="flex-shrink-0 text-xs">
            {node.count}
          </Badge>
        </button>
        {isExpanded && hasChildren && (
          <div>{node.children!.map((child) => renderNode(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className={cn('space-y-1 overflow-y-auto', className)}
      tabIndex={-1}
    >
      {hierarchy.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No venues found
        </div>
      ) : (
        hierarchy.map((node) => renderNode(node, 0))
      )}
    </div>
  );
}
