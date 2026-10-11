export type RootStackParamList = {
  MainTabs: undefined;
  ToolDetail: { toolId: string };
  ToolForm: { toolId?: string } | undefined;
};

export type MainTabParamList = {
  Library: undefined;
  Favorites: undefined;
  Settings: undefined;
};
