// Redirect stub — PODS now lives at MyPods
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function Pods() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(createPageUrl("MyPods"), { replace: true });
  }, [navigate]);
  return null;
}