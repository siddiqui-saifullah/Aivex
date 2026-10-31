import axios from "../config/axios";
import type { AiPolicy, AssignmentDetails, AssignmentSummary } from "../types";

export interface AssignmentInput {
  title: string;
  instructions: string;
  /** ISO date, or null for no due date. */
  dueAt: string | null;
  aiPolicy: AiPolicy;
  /** Create only: copy one of the teacher's projects as starter code. */
  templateProjectId?: string;
}

export const getAssignments = async (classroomId: string): Promise<AssignmentSummary[]> => {
  const { data } = await axios.get<AssignmentSummary[]>(`/classrooms/${classroomId}/assignments`);
  return Array.isArray(data) ? data : [];
};

export const getAssignment = async (id: string): Promise<AssignmentDetails> => {
  const { data } = await axios.get<AssignmentDetails>(`/assignments/${id}`);
  return data;
};

export const createAssignment = async (classroomId: string, input: AssignmentInput) => {
  const { data } = await axios.post<AssignmentSummary>(`/classrooms/${classroomId}/assignments`, input);
  return data;
};

export const updateAssignment = async (id: string, input: Partial<AssignmentInput>) => {
  const { data } = await axios.patch<AssignmentSummary>(`/assignments/${id}`, input);
  return data;
};

export const deleteAssignment = async (id: string) => {
  await axios.delete(`/assignments/${id}`);
};

/** Student: open (creating on first use) their own project for the assignment. */
export const startAssignment = async (id: string) => {
  const { data } = await axios.post<{ projectId: string; created: boolean }>(`/assignments/${id}/start`);
  return data;
};
