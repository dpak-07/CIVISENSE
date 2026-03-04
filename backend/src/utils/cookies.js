const REFRESH_TOKEN_COOKIE_NAME = 'civisense_refresh_token';

const parseCookieHeader = (cookieHeader = '') => {
  const result = {};
  String(cookieHeader)
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((part) => {
      const separatorIndex = part.indexOf('=');
      if (separatorIndex <= 0) {
        return;
      }
      const key = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();
      if (!key) {
        return;
      }
      result[key] = decodeURIComponent(value);
    });
  return result;
};

const getCookieValue = (cookieHeader, key) => parseCookieHeader(cookieHeader)[key] || null;

module.exports = {
  REFRESH_TOKEN_COOKIE_NAME,
  parseCookieHeader,
  getCookieValue
};
