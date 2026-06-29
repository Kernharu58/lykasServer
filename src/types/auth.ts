export interface User {
  id?: string;
  _id?: string;
  displayName: string;
  email: string;
  role: 'super_admin' | 'admin' | 'staff' | 'user';
  profilePicture?: string;
  status?: 'active' | 'suspended' | 'locked';
  emailVerified?: boolean;
}

export interface AuthResponse {
  token: string;
  user: User;
  message?: string;
}
