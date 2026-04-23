import { useCallback, useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";

import { db } from "@/lib/firebase";
import {
  DEFAULT_SITE_SETTINGS,
  SITE_SETTINGS_DOC_ID,
  type SiteSettings,
} from "@/types/siteSettings";

const COLLECTION_NAME = "configuracoesSistema";

export function useSiteSettings(enabled: boolean) {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [loading, setLoading] = useState(enabled);

  const loadSettings = useCallback(async () => {
    if (!enabled) {
      setSettings(DEFAULT_SITE_SETTINGS);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const ref = doc(db, COLLECTION_NAME, SITE_SETTINGS_DOC_ID);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        setSettings({
          ...DEFAULT_SITE_SETTINGS,
          ...(snap.data() as Partial<SiteSettings>),
        });
      } else {
        setSettings(DEFAULT_SITE_SETTINGS);
      }
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const saveSettings = useCallback(
    async (
      nextSettings: SiteSettings,
      meta?: { name?: string; email?: string },
    ) => {
      const normalized: SiteSettings = {
        ...DEFAULT_SITE_SETTINGS,
        ...nextSettings,
        updatedAt: new Date().toISOString(),
        updatedByName: meta?.name || undefined,
        updatedByEmail: meta?.email || undefined,
      };

      const ref = doc(db, COLLECTION_NAME, SITE_SETTINGS_DOC_ID);
      await setDoc(ref, normalized);
      setSettings(normalized);
      return normalized;
    },
    [],
  );

  return {
    settings,
    loading,
    saveSettings,
    reload: loadSettings,
  };
}