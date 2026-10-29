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
    gradient: ['#E96B18', '#FF9F43', '#FFD166'],
    accent: '#FFAE55',
    foreground: '#281506',
  },
  Code: {
    gradient: ['#1558A6', '#3887E8', '#79BDFF'],
    accent: '#75B9FF',
    foreground: '#071A2B',
  },
  Hosting: {
    gradient: ['#087B57', '#20C985', '#82F0B8'],
    accent: '#62E6A7',
    foreground: '#05271B',
  },
  Database: {
    gradient: ['#087B78', '#16B8A9', '#72E7D7'],
    accent: '#53E2D0',
    foreground: '#04221F',
  },
  Design: {
    gradient: ['#B82154', '#F04F83', '#FF9FB9'],
    accent: '#FF83A7',
    foreground: '#31091D',
  },
  Productivity: {
    gradient: ['#A36A08', '#E5A91B', '#FFE078'],
    accent: '#FFD45C',
    foreground: '#2A1B03',
  },
  API: {
    gradient: ['#0879A9', '#20B7E8', '#8BE7FF'],
    accent: '#58D8FF',
    foreground: '#082F49',
  },
  Monitoring: {
    gradient: ['#A92F39', '#F05B5B', '#FFA078'],
    accent: '#FF8173',
    foreground: '#2B1010',
  },
};

const fallbackAppearance: ToolAppearance = {
  gradient: ['#087B68', '#1FC6A4', '#8AF0D0'],
  accent: '#61E7C5',
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
