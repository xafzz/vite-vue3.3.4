






export const isAsyncWrapper = (i: any ): boolean =>
  !!(i.type as any).__asyncLoader
