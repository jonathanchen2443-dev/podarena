/**
 * PODS MIGRATION — Phase 1
 * Invite flow is decommissioned. This shim redirects to the PODS placeholder.
 * The page is kept registered so old invite links resolve safely.
 * Remove this file when League routes are fully pruned.
 */
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/components/utils/routes";

export default function Invite() {
  const navigate = useNavigate();
  useEffect(() => { navigate(ROUTES.PODS, { replace: true }); }, []);
  return null;
}