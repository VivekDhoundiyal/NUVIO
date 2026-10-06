export interface SessionFile {
  file: File;
  bytes: Uint8Array;
  timestamp: number;
}

let activeSessionFile: SessionFile | null = null;

export class FileSessionStore {
  /**
   * Set the active file for session routing
   */
  static async setActiveFile(file: File): Promise<SessionFile> {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    activeSessionFile = {
      file,
      bytes,
      timestamp: Date.now(),
    };
    return activeSessionFile;
  }

  /**
   * Retrieve the active session file
   */
  static getActiveFile(): SessionFile | null {
    return activeSessionFile;
  }

  /**
   * Consume and clear active file (if one-time routing is preferred)
   */
  static consumeActiveFile(): SessionFile | null {
    const f = activeSessionFile;
    activeSessionFile = null;
    return f;
  }

  /**
   * Clear active session file
   */
  static clear(): void {
    activeSessionFile = null;
  }
}
