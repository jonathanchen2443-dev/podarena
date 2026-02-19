import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { LoadingState } from "@/components/shell/PageStates";

// Compatibility shim: /decks → /profile
export default function Decks() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = window.location.search;
    navigate(createPageUrl("Profile") + params, { replace: true });
  }, []);

  return <LoadingState message="Redirecting…" />;
}