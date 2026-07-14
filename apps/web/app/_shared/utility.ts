export const delay = (ms: number = 3000) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

export const formatDate = (value: string | null): string => {
  if (!value) {
    return '—';
  }

  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export const formatLabelWithSpace = (value: string): string => {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2');
};

export const formatLabelFirstLetterCapitalized = (value: string): string => {
  return value[0]?.toUpperCase() + value.substring(1, value.length);
};

export const getInitials = (name: string | null | undefined): string => {
  if (!name) {
    return '?';
  }

  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
};
