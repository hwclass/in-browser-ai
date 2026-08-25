export type PageLifecycleTarget = {
  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void;
};

export type PageLifecycleDocument = PageLifecycleTarget & {
  visibilityState?: DocumentVisibilityState;
};

export type PageLifecycleOptions = {
  document?: PageLifecycleDocument;
  window?: PageLifecycleTarget;
  flush: () => void;
  flushOnVisibilityHidden?: boolean;
  flushOnPageHide?: boolean;
};

export function observePageLifecycle(options: PageLifecycleOptions): { stop(): void } {
  const flushOnVisibilityHidden = options.flushOnVisibilityHidden !== false;
  const flushOnPageHide = options.flushOnPageHide !== false;

  const onVisibilityChange = () => {
    if (options.document?.visibilityState === "hidden") options.flush();
  };
  const onPageHide = () => options.flush();

  if (flushOnVisibilityHidden) options.document?.addEventListener("visibilitychange", onVisibilityChange);
  if (flushOnPageHide) options.window?.addEventListener("pagehide", onPageHide);

  return {
    stop() {
      if (flushOnVisibilityHidden) options.document?.removeEventListener("visibilitychange", onVisibilityChange);
      if (flushOnPageHide) options.window?.removeEventListener("pagehide", onPageHide);
    }
  };
}
