export const LOCAL_MEDIA =
  typeof __COSMOS_LOCAL_MEDIA__ === 'undefined'
    ? { music: [], voices: [] }
    : __COSMOS_LOCAL_MEDIA__;
