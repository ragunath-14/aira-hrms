"use client";

import { createContext, useContext } from "react";

export type EmployeeProfile = {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string | null;
  email: string;
  phone: string | null;
  dateOfJoining: string | null;
  status: string;
  // Changes whenever the profile photo does; null when there is none.
  photoVersion: number | null;
  companyName: string;
  // The signed-in person's company role (owner, admin, hr, manager, employee...).
  role: string;
  departmentName: string | null;
  designationName: string | null;
  locationName: string | null;
  managerName: string | null;
};

type EmployeeContextValue = {
  employee: EmployeeProfile | null;
  reload: () => Promise<void>;
  unreadCount: number;
};

export const EmployeeContext = createContext<EmployeeContextValue>({
  employee: null,
  reload: async () => {},
  unreadCount: 0,
});

// The signed-in employee, loaded once by the My Workspace shell.
export function useEmployee() {
  return useContext(EmployeeContext);
}
