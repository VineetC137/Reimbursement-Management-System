export type UserSummary = {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  manager: {
    id: string;
    fullName: string;
    email: string;
  } | null;
};
