import { Post, AppUser } from './types';

export function isSandbox(): boolean {
  return !!localStorage.getItem('local_mock_user');
}

const DEFAULT_USERS: AppUser[] = [
  {
    firebaseUid: 'mock-uid-owner',
    email: 'zhoyilee@gmail.com',
    username: '站长 (Sandbox Owner)',
    birthday: '1995-10-12',
    avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80',
    role: 'owner',
    createdAt: new Date(Date.now() - 3600000 * 24 * 30).toISOString(),
  },
  {
    firebaseUid: 'mock-uid-author',
    email: 'author@sandbox.com',
    username: '专栏写手 (Sandbox Author)',
    birthday: '1998-05-20',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80',
    role: 'author',
    createdAt: new Date(Date.now() - 3600000 * 24 * 15).toISOString(),
  },
  {
    firebaseUid: 'mock-uid-reader',
    email: 'reader@sandbox.com',
    username: '纯粹读者 (Sandbox Reader)',
    birthday: '2001-08-04',
    avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&q=80',
    role: 'reader',
    createdAt: new Date(Date.now() - 3600000 * 24 * 5).toISOString(),
  }
];

const DEFAULT_POSTS: Post[] = [
  {
    id: 'mock-post-1',
    title: '纸墨心香：数字化时代下的深阅读价值',
    content: `# 纸墨心香：数字化时代下的深阅读价值\n\n在这个信息碎片化的时代，我们每天都被成千上万的信息流、短视频、140字的推文包围。我们的手机屏幕亮了又灭，灭了又亮。我们在看似博古通今的快节奏浏览中，内心却常感到一种莫名和虚无。\n\n## 什么是深阅读？\n深阅读不是简单地获取信息，而是在字里行间建立起与作者、与历史、与自我的深层次对话。当我们在一个安静的午后，泡一杯清茶，翻开一本精美的文学大作或学术史集，我们的脑电波会趋自专注。深阅读需要我们在漫漫长句中推敲逻辑，在优美辞藻中感受意境，在繁杂的故事线中体会人性的悲欢离合。\n\n## 沉浸艺术的三个微习惯\n1. **隔绝干扰**：每天晚上睡前半小时，将手机放置于客厅，给自己一个纯粹的无屏时光。\n2. **随手写记**：随时在书页边缘写下你当时的感悟和批注。正是在这些写写画画中，书本真正刻上了你的思想烙印。\n3. **反复咀嚼**：经典文章不应止于一读。每隔数年，重新翻开曾经影响过你灵魂的文字，你会发现，它依旧在闪烁着别样的微光。`,
    authorId: 'mock-uid-owner',
    authorName: '站长 (Sandbox Owner)',
    images: ['https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?auto=format&fit=crop&w=800&q=80'],
    likes: 42,
    likers: ['user-1', 'user-2'],
    status: 'published',
    createdAt: new Date(Date.now() - 3600000 * 24 * 3).toISOString(), // 3 days ago
    updatedAt: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
  },
  {
    id: 'mock-post-2',
    title: '古典叙事与现代主义的无声碰撞',
    content: `# 古典叙事与现代主义的无声碰撞\n\n从荷马史诗的史诗歌唱，到伍尔夫意识流的漫无边际，小说作为一门叙事艺术经历了波澜壮阔的百年变迁...\n\n### 秩序与混乱\n古典文学执着于构建一种和谐、因果井然的秩序。然而现代主义却尖锐地指出：生活本是无序而复杂的。我们如何在流动的意识中寻找真我？\n\n> "真正有灵魂的阅读，正是把自己的目光当成解剖人性的探照灯。"`,
    authorId: 'mock-uid-author',
    authorName: '专栏写手 (Sandbox Author)',
    images: ['https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&w=800&q=80'],
    likes: 18,
    likers: ['user-3'],
    status: 'published',
    createdAt: new Date(Date.now() - 3600000 * 24 * 1).toISOString(), // 1 day ago
    updatedAt: new Date(Date.now() - 3600000 * 24 * 1).toISOString(),
  },
  {
    id: 'mock-post-3',
    title: '【草稿】未来科幻小说的多维度切片',
    content: `# 未来科幻小说的多维度切片\n\n这是一个关于赛博庞克与意识融合的短篇大作实验...\n未来每一个人都可以将自己一生的感知记忆，打包成一本随时可提取的数字图书。这就是我们所说的「灵魂重塑论」。\n\n(草稿未完待续...)`,
    authorId: 'mock-uid-author',
    authorName: '专栏写手 (Sandbox Author)',
    images: ['https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=800&q=80'],
    likes: 0,
    likers: [],
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
];

export function getMockUsers(): AppUser[] {
  const custom = localStorage.getItem('local_mock_users');
  if (!custom) {
    localStorage.setItem('local_mock_users', JSON.stringify(DEFAULT_USERS));
    return DEFAULT_USERS;
  }
  try {
    return JSON.parse(custom);
  } catch (err) {
    return DEFAULT_USERS;
  }
}

export function updateMockUserRole(userId: string, nextRole: 'reader' | 'author' | 'owner'): void {
  const users = getMockUsers();
  const updated = users.map(u => {
    if (u.firebaseUid === userId) {
      return { ...u, role: nextRole };
    }
    return u;
  });
  localStorage.setItem('local_mock_users', JSON.stringify(updated));
}

export function deleteMockUser(userId: string): void {
  const users = getMockUsers();
  const filtered = users.filter(u => u.firebaseUid !== userId);
  localStorage.setItem('local_mock_users', JSON.stringify(filtered));
}

export function getMockPosts(): Post[] {
  const custom = localStorage.getItem('local_mock_posts');
  if (!custom) {
    localStorage.setItem('local_mock_posts', JSON.stringify(DEFAULT_POSTS));
    return DEFAULT_POSTS;
  }
  try {
    return JSON.parse(custom);
  } catch (err) {
    return DEFAULT_POSTS;
  }
}

export function saveMockPost(post: Omit<Post, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Post {
  const posts = getMockPosts();
  const nowStr = new Date().toISOString();
  
  if (post.id && posts.find(p => p.id === post.id)) {
    // Edit existing
    const updated = posts.map(p => {
      if (p.id === post.id) {
        return {
          ...p,
          ...post,
          updatedAt: nowStr
        } as Post;
      }
      return p;
    });
    localStorage.setItem('local_mock_posts', JSON.stringify(updated));
    return updated.find(p => p.id === post.id)!;
  } else {
    // Create new
    const newPost: Post = {
      ...post,
      id: post.id || `mock-post-${Date.now()}`,
      createdAt: nowStr,
      updatedAt: nowStr
    };
    posts.unshift(newPost);
    localStorage.setItem('local_mock_posts', JSON.stringify(posts));
    return newPost;
  }
}

export function deleteMockPost(id: string): void {
  const posts = getMockPosts();
  const filtered = posts.filter(p => p.id !== id);
  localStorage.setItem('local_mock_posts', JSON.stringify(filtered));
}

export function likeMockPost(id: string, userId: string): Post | null {
  const posts = getMockPosts();
  const postIndex = posts.findIndex(p => p.id === id);
  if (postIndex === -1) return null;
  
  const post = { ...posts[postIndex] };
  const hasLiked = post.likers.includes(userId);
  if (hasLiked) {
    post.likers = post.likers.filter(uid => uid !== userId);
    post.likes = Math.max(0, post.likes - 1);
  } else {
    post.likers = [...post.likers, userId];
    post.likes += 1;
  }
  
  posts[postIndex] = post;
  localStorage.setItem('local_mock_posts', JSON.stringify(posts));
  return post;
}
