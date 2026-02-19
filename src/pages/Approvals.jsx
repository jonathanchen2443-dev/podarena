import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { LoadingState } from "@/components/shell/PageStates";

// Compatibility shim: /approvals → /inbox
export default function Approvals() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = window.location.search;
    navigate(createPageUrl("Inbox") + params, { replace: true });
  }, []);

  return <LoadingState message="Redirecting…" />;
}