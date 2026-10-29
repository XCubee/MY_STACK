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
    background: '#F3F7F7',
    surface: '#FFFFFF',
    surfaceRaised: '#E7EFEE',
    text: '#172522',
    muted: '#647873',
    border: '#D5E1DE',
    primary: '#087F72',
    onPrimary: '#FFFFFF',
    danger: '#C83F50',
    chip: '#DDF4ED',
  },
};

export const darkTheme: AppTheme = {
  dark: true,
  colors: {
    background: '#111A20',
    surface: '#18242B',
    surfaceRaised: '#22313A',
    text: '#F2F7F7',
    muted: '#A4B4B9',
    border: '#35474F',
    primary: '#25D366',
    onPrimary: '#06211D',
    danger: '#FF7A83',
    chip: '#1C3935',
  },
};
