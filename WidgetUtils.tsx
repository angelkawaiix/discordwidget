export function hexToRgb(hex: string) {
  hex = typeof hex === 'string' ? hex.replace(/^#/, '') : '000000';
  return {
    r: parseInt(hex.substring(0, 2), 16),
    g: parseInt(hex.substring(2, 4), 16),
    b: parseInt(hex.substring(4, 6), 16),
  };
}

export function parseQueryProps(query: {[key: string]: string}) {
  const newQuery: {[key: string]: boolean | number | string} = {};

  Object.keys(query).forEach((key) => {
    const value = query[key];
    if (value === 'true') {
      newQuery[key] = true;
    } else if (value === 'false') {
      newQuery[key] = false;
    } else if (!isNaN(Number(value))) {
      newQuery[key] = Number(value);
    } else if (/^(#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})|[a-z0-9_-]{2,32})$/i.test(value)) {
      newQuery[key] = value;
    }
  });

  return newQuery;
}
