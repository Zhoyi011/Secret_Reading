export interface AppUser {
  firebaseUid: string;
  email: string;
  username: string;
  birthday?: string;
  avatar: string;
  role: 'reader' | 'author' | 'owner';
  createdAt: string;
  onboarded?: boolean;
  filterR18?: boolean;
  status?: 'active' | 'frozen';
  level?: 'normal' | 'signed' | 'vip'; // Author contracts levels
  updatePlan?: string; // Author update plan / schedule
  lastPunchIn?: string; // ISO timestamp of last punch-in
  punchInStreak?: number; // Punch-in streak days
  ageConfirmed?: boolean; // R18 reading age confirmation
  isMuted?: boolean; // Mute state
}

export interface WritingSubscription {
  id: string; // userId_authorId
  userId: string;
  username: string;
  authorId: string;
  authorName: string;
  createdAt: string;
}

export interface Post {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  images: string[];
  coverImage?: string;
  likes: number;
  likers: string[];
  status: 'draft' | 'published';
  createdAt: string;
  updatedAt: string;
  isR18?: boolean;
  tags?: string[]; // Content tagging e.g., '纯爱', '虐心', '架空'
  isPinned?: boolean; // Pin to top
  isRecommended?: boolean; // Station master recommendation
  recommendedAt?: string | null; // Recommendation timestamp
  publishAt?: string | null; // Scheduled publishing timestamp
  lastEditedAt?: string | null; // Modified edited indicator
  views?: number; // Read counts
  collects?: number; // Total collections
  shortId?: string; // Random 6-digit collision-free sharing ID
  seriesId?: string; // Associated Series ID
  seriesTitle?: string; // Associated Series Title
  seriesOrder?: number; // Order index within the series
}

export interface Follow {
  id?: string;
  followerId: string;
  followerName: string;
  followerAvatar: string;
  followingId: string;
  followingName: string;
  followingAvatar: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  recipientId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  type: 'new_post' | 'follow' | 'like' | 'system';
  title: string;
  body: string;
  postId?: string;
  postTitle?: string;
  read: boolean;
  createdAt: string;
}

export interface Bookmark {
  id: string; // combination 'userId_postId'
  userId: string;
  postId: string;
  postTitle: string;
  authorName: string;
  coverImage?: string;
  state: 'want' | 'reading' | 'read'; // 想读 / 在读 / 已读
  progress: number; // Reading progress %
  updatedAt: string;
}

export interface HistoryItem {
  id: string; // combination 'userId_postId'
  userId: string;
  postId: string;
  postTitle: string;
  authorName: string;
  coverImage?: string;
  progress: number; // scroll progress percentage
  updatedAt: string;
}

export interface CommentReply {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  username: string;
  avatar: string;
  content: string;
  createdAt: string;
  replies?: CommentReply[]; // Nested array for author/owner replies
}

export interface Report {
  id: string;
  postId: string;
  postTitle: string;
  reporterId: string;
  reporterName: string;
  reason: string;
  details: string;
  status: 'pending' | 'resolved' | 'invalid';
  createdAt: string;
}

export interface AuthorApplication {
  id: string; // userId
  userId: string;
  username: string;
  email: string;
  bio: string;
  sampleContent: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  active: boolean;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  recipientId: string;
  recipientName: string;
  content: string;
  createdAt: string;
}

// Interactive Features Interfaces
export interface ShortReview {
  id: string;
  postId: string;
  userId: string;
  username: string;
  avatar: string;
  content: string;
  isFeatured: boolean;
  createdAt: string;
}

export interface AuthorQuestion {
  id: string;
  postId: string;
  userId: string;
  username: string;
  avatar: string;
  question: string;
  answer?: string;
  answeredAt?: string;
  createdAt: string;
}

export interface BountyClaim {
  id: string;
  userId: string;
  username: string;
  avatar: string;
  storyTitle: string;
  storyLink: string;
  comment: string;
  isAccepted: boolean;
  createdAt: string;
}

export interface StoryBounty {
  id: string;
  userId: string;
  username: string;
  avatar: string;
  title: string;
  description: string;
  rewardAmount: number;
  status: 'open' | 'claimed' | 'closed';
  claims: BountyClaim[];
  createdAt: string;
}

export interface CPCandidate {
  id: string;
  name: string;
  description: string;
  votes: number;
  voters: string[];
}

export interface CPVoteTheme {
  id: string;
  title: string;
  description: string;
  isActive: boolean;
  candidates: CPCandidate[];
  createdAt: string;
}

export interface UserStreak {
  id: string; // userId
  userId: string;
  username: string;
  streakCount: number;
  lastCheckedIn: string; // YYYY-MM-DD
  history: string[]; // List of checked-in dates (YYYY-MM-DD)
  badges: string[]; // Earned virtual badges e.g., '初级书虫', '狂热书圣', '同人真爱粉'
  updatedAt: string;
}

