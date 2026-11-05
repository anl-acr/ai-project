import { useEffect } from "react";
import { useRouter } from "next/router";

export default function AgentDesktopEntry() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem("aida_desktop_mode", "1");
      } catch (e) {}
      router.replace("/?desktop=1");
    }
  }, [router]);

  return null;
}
