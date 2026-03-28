export type Page =
  | 'login'
  | 'register'
  | 'home'
  | 'documents'
  | 'profile'
  | 'scan'
  | 'edit'
  | 'convert'
  | 'askai';

export interface User {
  name: string;
  email: string;
  avatar?: string;
}

export interface DocFile {
  id: string;
  name: string;
  type: 'pdf' | 'doc' | 'xls' | 'jpg' | 'png' | 'txt';
  size: string;
  date: string;
  color: string;
  content?: string;      // text content (for edit/recognize)
  dataUrl?: string;      // image data url (in-memory only)
  mimeType?: string;     // original mime type
}
