import axios from "../config/axios";
import type { ClassroomDetails, ClassroomSummary } from "../types";

export const getClassrooms = async (): Promise<ClassroomSummary[]> => {
  const { data } = await axios.get<ClassroomSummary[]>("/classrooms");
  return Array.isArray(data) ? data : [];
};

export const getClassroom = async (id: string): Promise<ClassroomDetails> => {
  const { data } = await axios.get<ClassroomDetails>(`/classrooms/${id}`);
  return data;
};

export const createClassroom = async (payload: {
  name: string;
  stack: string;
  templateProjectId?: string;
  aiEnabled?: boolean;
}) => {
  const { data } = await axios.post<{ _id: string; name: string; code: string; stack: string }>("/classrooms", payload);
  return data;
};

export const joinClassroom = async (code: string) => {
  const { data } = await axios.post<{ classroomId: string; projectId: string; alreadyJoined: boolean }>(
    "/classrooms/join",
    { code },
  );
  return data;
};

/** Teacher: allow or block Vex AI for the class's students. */
export const updateClassroom = async (id: string, settings: { aiEnabled: boolean }) => {
  const { data } = await axios.patch<{ aiEnabled: boolean }>(`/classrooms/${id}`, settings);
  return data;
};

export const deleteClassroom = async (id: string) => {
  await axios.delete(`/classrooms/${id}`);
};

/** Shareable invite link for a class code. */
export const classInviteLink = (code: string) => `${window.location.origin}/join/${code}`;
