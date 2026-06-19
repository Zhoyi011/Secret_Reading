export interface AppUser {
  firebaseUid: string;
  email: string;
  username: string;
  birthday: string;
  avatar: string;
  role: 'reader' | 'author' | 'owner';
  createdAt: string;
}

export interface Post {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  images: string[];
  likes: number;
  likers: string[];
  status: 'draft' | 'published';
  createdAt: string;
  updatedAt: string;
}
