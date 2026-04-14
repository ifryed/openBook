/** Server-computed props when editing a non-primary book language. */
export type TranslateFromPrimaryContext = {
  primaryLocale: string;
  activeLocale: string;
  sourceBody: string;
  sourceTitle: string;
  bodyReady: boolean;
  titleReady: boolean;
};
