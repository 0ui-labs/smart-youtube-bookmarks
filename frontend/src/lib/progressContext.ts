import { createContext } from "react";
import type { UseWebSocketReturn } from "@/hooks/useWebSocket";

export const ProgressContext = createContext<UseWebSocketReturn | null>(null);
