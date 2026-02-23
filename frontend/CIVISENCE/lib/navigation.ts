import { Href, router } from "expo-router";

export const safeBack = (fallback: Href = "/") => {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  router.replace(fallback);
};

