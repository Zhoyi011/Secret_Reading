import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../firebase';
import { Post } from '../types';

// In-memory cache for Google Drive OAuth Access Token (per session)
let driveAccessToken: string | null = null;

export function getDriveAccessToken(): string | null {
  return driveAccessToken;
}

export function setDriveAccessToken(token: string | null) {
  driveAccessToken = token;
}

/**
 * Initiates Google OAuth Popup specifically requesting the drive.file scope.
 * This will authorize this app to manage files and folders it creates in the user's Drive.
 */
export async function connectGoogleDrive(): Promise<string> {
  const provider = new GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/drive.file');
  provider.setCustomParameters({ prompt: 'select_account' });

  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken;

    if (!token) {
      throw new Error('无法从 Google 授权中获取访问令牌 (Access Token)');
    }

    setDriveAccessToken(token);
    return token;
  } catch (error: any) {
    console.error('Google Drive auth error:', error);
    throw error;
  }
}

/**
 * Checks if the backup folder "私密阅读专栏备份" exists in the user's Google Drive.
 * If not, creates it. Returns the folder ID.
 */
export async function searchOrCreateFolder(token: string): Promise<string> {
  const folderName = '私密阅读专栏备份';
  const query = `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`;

  try {
    const searchRes = await fetch(searchUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!searchRes.ok) {
      if (searchRes.status === 401) {
        setDriveAccessToken(null);
        throw new Error('Google Drive 授权失效，请重新连接账号。');
      }
      throw new Error(`无法查询 Google Drive 目录，状态码: ${searchRes.status}`);
    }

    const data = await searchRes.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }

    // If not found, create it
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    });

    if (!createRes.ok) {
      throw new Error(`无法创建 Google Drive 备份文件夹，状态码: ${createRes.status}`);
    }

    const folderData = await createRes.json();
    return folderData.id;
  } catch (error: any) {
    console.error('Error finding/creating backup folder:', error);
    throw error;
  }
}

/**
 * Backs up a post as a Markdown file inside the backup folder on Google Drive.
 */
export async function backupPostToDrive(token: string, post: Post, folderId: string): Promise<any> {
  const fileName = `${post.title.replace(/[\/\\?%*:|"<>\s]/g, '_')}.md`;
  const fileContent = `# ${post.title}

> **本文已安全备份至您的 Google Drive**
> **作者**: ${post.authorName}
> **状态**: ${post.status === 'published' ? '已发布' : '草稿'}
> **分类标签**: ${post.tags && post.tags.length > 0 ? post.tags.join(', ') : '无'}
> **创建时间**: ${new Date(post.createdAt).toLocaleString()}
> **最后更新**: ${new Date(post.updatedAt).toLocaleString()}
${post.isR18 ? '> **注意**: 本文标注为 R-18 限制级内容\n' : ''}
---

${post.content}
`;

  // Multipart/related body boundary configuration
  const boundary = 'secret_reading_drive_backup_boundary';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelim = `\r\n--${boundary}--`;

  const metadata = {
    name: fileName,
    mimeType: 'text/markdown',
    parents: [folderId],
  };

  const body = 
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: text/markdown; charset=UTF-8\r\n\r\n' +
    fileContent +
    closeDelim;

  try {
    const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink';
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: body,
    });

    if (!response.ok) {
      if (response.status === 401) {
        setDriveAccessToken(null);
        throw new Error('Google Drive 授权失效，请重新连接账号。');
      }
      throw new Error(`备份上传失败，状态码: ${response.status}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error(`Failed to backup post "${post.title}" to Google Drive:`, error);
    throw error;
  }
}
