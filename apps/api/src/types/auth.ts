export type AuthContext = {
  userId: string;
  companyId: string;
  email: string;
  roles: string[];
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    email: string;
    roles: string[];
  };
  company: {
    id: string;
    name: string;
    countryCode: string;
    baseCurrency: string;
  };
};
