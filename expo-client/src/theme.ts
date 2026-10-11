export type ThemeMode = 'system' | 'light' | 'dark';

export type AppTheme = {
  dark: boolean;
  colors: {
    background: string;
    surface: string;
    surfaceRaised: string;
    text: string;
    muted: string;
    border: string;
    primary: string;
    onPrimary: string;
    danger: string;
    chip: string;
  };
};

export const lightTheme: AppTheme = {
  dark: false,
  colors: {
    background: '#F3F8F4',
    surface: '#FFFFFF',
    surfaceRaised: '#FFFFFF',
    text: '#101812',
    muted: '#58665C',
    border: '#D7E2DA',
    primary: '#087F3F',
    onPrimary: '#FFFFFF',
    danger: '#B42318',
    chip: '#E5F1E8',
  },
};

export const darkTheme: AppTheme = {
  dark: true,
  colors: {
    background: '#070B08',
    surface: '#101712',
    surfaceRaised: '#17221A',
    text: '#EAF5EC',
    muted: '#A1B3A5',
    border: '#29382D',
    primary: '#39E58C',
    onPrimary: '#07140C',
    danger: '#FF8585',
    chip: '#1B2D20',
  },
};
