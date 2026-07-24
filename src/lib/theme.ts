export const theme = {
  primary: '#0F4C81',
  primaryLight: '#3B7BB8',
  primaryDark: '#0A3560',
  secondary: '#1B998B',
  accent: '#F4A261',
  success: '#2A9D8F',
  warning: '#E9C46A',
  error: '#E76F51',
  background: '#F5F7FA',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF2F7',
  text: '#1A2332',
  textSecondary: '#5A6B85',
  textMuted: '#8E9BAF',
  border: '#E1E7EF',
  shadow: '#0F4C81',
  white: '#FFFFFF',
  black: '#0D1117',
};

export const formatCurrency = (value: number): string => {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
};

export const formatDate = (date: string): string => {
  if (!date) return '—';
  const d = new Date(date);
  // Correct timezone offsets for local dates
  const utcDate = new Date(d.getTime() + d.getTimezoneOffset() * 60000);
  return utcDate.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};
