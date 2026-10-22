"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { api, ApiError } from "@j26/common/api";
import type { AccountResponse, ReviewTask, C4PredictionResponse } from "@j26/common/contracts";

export interface DevelopmentInputSnapshot {
  readonly id: string;
  readonly text: string;
  readonly language: string;
  readonly prediction?: C4PredictionResponse;
  readonly targetClass: "Negative" | "Neutral" | "Positive";
  readonly modelVersion?: string;
  readonly submittedAt: number;
}

export type DevelopmentInputData = DevelopmentInputSnapshot;

export interface CaseContextType {
  authorized: boolean;
  checking: boolean;
  tasks: ReviewTask[];
  selectedTask: ReviewTask | null;
  selectedTaskId: string | null;
  selectTask: (taskId: string | null) => void;
  loadTasks: () => Promise<void>;
  error: string;
  setError: (err: string) => void;
  inputText: string;
  setInputText: (text: string) => void;
  selectedSentimentClass: "Negative" | "Neutral" | "Positive";
  setSelectedSentimentClass: (cls: "Negative" | "Neutral" | "Positive") => void;
  devInput: DevelopmentInputSnapshot | null;
  setDevInput: (data: React.SetStateAction<DevelopmentInputSnapshot | null>) => void;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const CaseContext = createContext<CaseContextType>({
  authorized: false,
  checking: true,
  tasks: [],
  selectedTask: null,
  selectedTaskId: null,
  selectTask: () => {},
  loadTasks: async () => {},
  error: "",
  setError: () => {},
  inputText: "",
  setInputText: () => {},
  selectedSentimentClass: "Negative",
  setSelectedSentimentClass: () => {},
  devInput: null,
  setDevInput: () => {},
  login: async () => {},
  logout: async () => {},
});

export function CaseProvider({ children }: { children: ReactNode }) {
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const [tasks, setTasks] = useState<ReviewTask[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [inputText, setInputText] = useState("");
  const [selectedSentimentClass, setSelectedSentimentClass] = useState<"Negative" | "Neutral" | "Positive">("Negative");
  const [devInput, setDevInputState] = useState<DevelopmentInputSnapshot | null>(null);

  // Restore devInput from sessionStorage on client-side mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = sessionStorage.getItem("j26_dev_input");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.text) {
          setTimeout(() => {
            setDevInputState(parsed);
            if (parsed.targetClass) {
              setSelectedSentimentClass(parsed.targetClass);
            }
          }, 0);
        }
      }
    } catch {
      // Ignore storage read errors
    }
  }, []);

  const setDevInput = useCallback((action: React.SetStateAction<DevelopmentInputSnapshot | null>) => {
    setDevInputState((prev) => {
      const next = typeof action === "function" ? action(prev) : action;
      if (typeof window !== "undefined") {
        try {
          if (next) {
            sessionStorage.setItem("j26_dev_input", JSON.stringify(next));
          } else {
            sessionStorage.removeItem("j26_dev_input");
          }
        } catch {
          // Ignore storage write errors
        }
      }
      return next;
    });
  }, []);

  const loadTasks = useCallback(async () => {
    try {
      const values = await api<ReviewTask[]>("/review-tasks");
      setTasks(values);
      // Auto-select first task if none is currently selected or if previously selected is missing
      setSelectedTaskId((prev) => {
        if (prev && values.some((t) => t.task_id === prev)) {
          return prev;
        }
        return values.length > 0 ? values[0].task_id : null;
      });
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        setAuthorized(false);
      }
      setTasks([]);
      setSelectedTaskId(null);
    }
  }, []);

  useEffect(() => {
    let live = true;
    api<AccountResponse>("/auth/me")
      .then(async (account) => {
        if (account.role !== "COUNSELLOR") {
          if (live) setAuthorized(false);
          return;
        }
        if (live) {
          setAuthorized(true);
          await loadTasks();
        }
      })
      .catch(() => {
        if (live) setAuthorized(false);
      })
      .finally(() => {
        if (live) setChecking(false);
      });

    return () => {
      live = false;
    };
  }, [loadTasks]);

  const selectTask = useCallback(
    (taskId: string | null) => {
      setSelectedTaskId(taskId);
    },
    []
  );

  const selectedTask =
    tasks.find((t) => t.task_id === selectedTaskId) ||
    (tasks.length > 0 ? tasks[0] : null);

  const updateSelectedSentimentClass = useCallback(
    (cls: "Negative" | "Neutral" | "Positive") => {
      setSelectedSentimentClass(cls);
      setDevInput((prev) => (prev ? Object.freeze({ ...prev, targetClass: cls }) : null));
    },
    [setDevInput]
  );

  const logout = useCallback(async () => {
    setAuthorized(false);
    setTasks([]);
    setSelectedTaskId(null);
    setError("");
    setInputText("");
    setSelectedSentimentClass("Negative");
    setDevInput(null);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.search = "";
      window.history.replaceState(null, "", url.pathname);
    }
    try {
      await api("/auth/logout", {});
    } catch {
      // Ignore network errors during logout
    }
  }, [setDevInput]);

  const login = useCallback(
    async (username: string, password: string) => {
      const account = await api<AccountResponse>("/auth/login", { username, password });
      if (account.role !== "COUNSELLOR") {
        await api("/auth/logout", {});
        throw new Error("This development shell requires an authorized counsellor account.");
      }
      setAuthorized(true);
      await loadTasks();
    },
    [loadTasks]
  );

  return (
    <CaseContext.Provider
      value={{
        authorized,
        checking,
        tasks,
        selectedTask,
        selectedTaskId: selectedTask ? selectedTask.task_id : null,
        selectTask,
        loadTasks,
        error,
        setError,
        inputText,
        setInputText,
        selectedSentimentClass,
        setSelectedSentimentClass: updateSelectedSentimentClass,
        devInput,
        setDevInput,
        login,
        logout,
      }}
    >
      {children}
    </CaseContext.Provider>
  );
}

export function useReviewCase(): CaseContextType {
  return useContext(CaseContext);
}
