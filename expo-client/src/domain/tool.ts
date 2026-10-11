export const TOOL_CATEGORIES = [
  'AI',
  'Code',
  'Hosting',
  'Database',
  'Design',
  'Productivity',
  'API',
  'Monitoring',
] as const;

export type ToolCategory = (typeof TOOL_CATEGORIES)[number];

export type Tool = {
  id: string;
  name: string;
  url: string;
  description: string;
  category: string;
  tags: string[];
  notes: string;
  projectLinks: string[];
  isFavorite: boolean;
  colorValue: number;
};

export const TOOL_COLORS = [
  0xff00c853,
  0xff00e676,
  0xff39e58c,
  0xff087f3f,
  0xff111814,
] as const;

export const DEFAULT_TOOL_COLOR = TOOL_COLORS[0];

export function normalizeToolColor(value: number): number {
  return TOOL_COLORS.find((color) => color === value) ?? DEFAULT_TOOL_COLOR;
}

export type ToolAppearance = {
  gradient: readonly [string, string, ...string[]];
  accent: string;
  foreground: string;
};

const categoryAppearances: Record<string, ToolAppearance> = {
  AI: {
    gradient: ['#F97316', '#FB923C', '#FDE68A'],
    accent: '#FDBA74',
    foreground: '#271307',
  },
  Code: {
    gradient: ['#202938', '#38465A', '#76869A'],
    accent: '#9FB0C4',
    foreground: '#F8FAFC',
  },
  Hosting: {
    gradient: ['#047857', '#10B981', '#A7F3D0'],
    accent: '#6EE7B7',
    foreground: '#05271B',
  },
  Database: {
    gradient: ['#0F766E', '#14B8A6', '#99F6E4'],
    accent: '#5EEAD4',
    foreground: '#04221F',
  },
  Design: {
    gradient: ['#BE185D', '#EC4899', '#FBCFE8'],
    accent: '#F9A8D4',
    foreground: '#31091D',
  },
  Productivity: {
    gradient: ['#475569', '#94A3B8', '#E2E8F0'],
    accent: '#CBD5E1',
    foreground: '#111827',
  },
  API: {
    gradient: ['#0369A1', '#38BDF8', '#BAE6FD'],
    accent: '#7DD3FC',
    foreground: '#082F49',
  },
  Monitoring: {
    gradient: ['#F8FAFC', '#E2E8F0', '#CBD5E1'],
    accent: '#CBD5E1',
    foreground: '#111827',
  },
};

const fallbackAppearance: ToolAppearance = {
  gradient: ['#065F46', '#10B981', '#A7F3D0'],
  accent: '#6EE7B7',
  foreground: '#05271B',
};

export function appearanceForCategory(category: string): ToolAppearance {
  return categoryAppearances[category] ?? fallbackAppearance;
}

export function toolFromRow(row: Record<string, unknown>): Tool {
  const stringField = (key: string, fallback = '') =>
    typeof row[key] === 'string' ? (row[key] as string) : fallback;
  const stringList = (key: string) =>
    Array.isArray(row[key])
      ? (row[key] as unknown[]).filter(
          (value): value is string => typeof value === 'string',
        )
      : [];

  return {
    id: stringField('id'),
    name: stringField('name'),
    url: stringField('url'),
    description: stringField('description'),
    category: stringField('category'),
    tags: stringList('tags'),
    notes: stringField('notes'),
    projectLinks: stringList('project_links'),
    isFavorite: row.is_favorite === true,
    colorValue:
      typeof row.color_value === 'number'
        ? normalizeToolColor(row.color_value)
        : DEFAULT_TOOL_COLOR,
  };
}

export function toolToRow(tool: Tool, userId: string) {
  return {
    user_id: userId,
    id: tool.id,
    name: tool.name,
    url: tool.url,
    description: tool.description,
    category: tool.category,
    tags: tool.tags,
    notes: tool.notes,
    project_links: tool.projectLinks,
    is_favorite: tool.isFavorite,
    color_value: tool.colorValue,
    updated_at: new Date().toISOString(),
  };
}

export function normalizeWebUrl(value: string): string | null {
  const input = value.trim();
  if (!input) return null;
  const withScheme = /^[a-z][a-z\d+.-]*:/i.test(input)
    ? input
    : `https://${input}`;

  try {
    const parsed = new URL(withScheme);
    if (
      !['http:', 'https:'].includes(parsed.protocol) ||
      !parsed.hostname ||
      (!parsed.hostname.includes('.') && parsed.hostname !== 'localhost')
    ) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export function makeToolId(): string {
  return `tool-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
