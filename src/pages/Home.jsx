/**
 * Home — redirect shim.
 * The canonical home screen is Dashboard. This shim ensures any legacy link
 * to /home safely redirects without a 404.
 */
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function Home() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(createPageUrl("Dashboard"), { replace: true });
  }, []);
  return null;
}