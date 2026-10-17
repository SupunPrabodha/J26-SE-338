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
import type { AccountResponse, ReviewTask } from "@j26/common/contracts";

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
});

export function CaseProvider({ children }: { children: ReactNode }) {
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);
  const [tasks, setTasks] = useState<ReviewTask[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [inputText, setInputText] = useState("");
  const [selectedSentimentClass, setSelectedSentimentClass] = useState<"Negative" | "Neutral" | "Positive">("Negative");

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
        setSelectedSentimentClass,
      }}
    >
      {children}
    </CaseContext.Provider>
  );
}

export function useReviewCase(): CaseContextType {
  return useContext(CaseContext);
}
