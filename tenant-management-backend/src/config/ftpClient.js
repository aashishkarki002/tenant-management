// config/ftpClient.js
import ftp from "basic-ftp";
import dotenv from "dotenv";
dotenv.config();

class FTPClient {
  constructor() {
    this.client = new ftp.Client();
    this.client.ftp.verbose = true; // optional, logs FTP commands
  }

  /**
   * Recursively create each directory component of `dirPath` starting from
   * the FTP root.  Works even when no part of the path exists yet.
   *
   * Uses a manual MKD → CD loop instead of basic-ftp's ensureDir because
   * ensureDir silently skips MKD errors and then throws on the subsequent CD
   * when the directory genuinely could not be created.  Our version logs
   * every step so failures are immediately visible in the server console.
   */
  async _mkdirp(dirPath) {
    const parts = dirPath.split("/").filter(Boolean);
    console.log("[FTP] _mkdirp — navigating to root then creating:", parts);

    await this.client.cd("/");

    for (const part of parts) {
      // MKD returns an error if the directory already exists — that is fine.
      try {
        await this.client.send("MKD " + part);
        console.log("[FTP] _mkdirp — created:", part);
      } catch (mkdErr) {
        console.log(
          "[FTP] _mkdirp — MKD skipped (already exists):",
          part,
          mkdErr.message,
        );
      }

      // CD must succeed — if it throws the directory really does not exist
      // (MKD was denied by the server) and we surface a clear error.
      try {
        await this.client.cd(part);
        console.log("[FTP] _mkdirp — entered:", part);
      } catch (cdErr) {
        throw new Error(
          `[FTP] _mkdirp — cannot enter directory "${part}" (MKD may have been denied): ${cdErr.message}`,
        );
      }
    }
  }

  async upload(localPath, remotePath) {
    console.log(
      "[FTP] upload called — host:",
      process.env.FTP_HOST,
      "localPath:",
      localPath,
      "remotePath:",
      remotePath,
    );
    try {
      await this.client.access({
        host: process.env.FTP_HOST,
        user: process.env.FTP_USER,
        password: process.env.FTP_PASSWORD,
        secure: false, // change to true if your server supports FTPS
      });
      console.log("[FTP] connected successfully");

      // Create every directory level in the path (safe to call on existing dirs)
      const remoteDir = remotePath.substring(0, remotePath.lastIndexOf("/"));
      await this._mkdirp(remoteDir);
      // After _mkdirp the CWD is remoteDir — upload using just the filename
      const filename = remotePath.substring(remotePath.lastIndexOf("/") + 1);
      console.log("[FTP] uploading from", localPath, "as", filename);
      await this.client.uploadFrom(localPath, filename);
      console.log("[FTP] upload successful:", remotePath);
      return true;
    } catch (err) {
      console.error(
        "[FTP] upload error — localPath:",
        localPath,
        "remotePath:",
        remotePath,
      );
      console.error("[FTP] upload error detail:", err.message ?? err);
      return false;
    } finally {
      this.client.close();
      console.log("[FTP] connection closed");
    }
  }

  async download(remotePath, localPath) {
    try {
      await this.client.access({
        host: process.env.FTP_HOST,
        user: process.env.FTP_USER,
        password: process.env.FTP_PASSWORD,
        secure: false,
      });

      await this.client.downloadTo(localPath, remotePath);
      console.log(`File downloaded successfully to ${localPath}`);
      return true;
    } catch (err) {
      console.error("FTP download error:", err);
      return false;
    } finally {
      this.client.close();
    }
  }

  async list(directoryPath) {
    try {
      await this.client.access({
        host: process.env.FTP_HOST,
        user: process.env.FTP_USER,
        password: process.env.FTP_PASSWORD,
        secure: false,
      });

      const files = await this.client.list(directoryPath);
      return files;
    } catch (err) {
      console.error("FTP list error:", err);
      throw err;
    } finally {
      this.client.close();
    }
  }

  async delete(remotePath) {
    try {
      await this.client.access({
        host: process.env.FTP_HOST,
        user: process.env.FTP_USER,
        password: process.env.FTP_PASSWORD,
        secure: false,
      });

      await this.client.remove(remotePath);
      return true;
    } catch (err) {
      console.error("FTP delete error:", err);
      return false;
    } finally {
      this.client.close();
    }
  }
}

export default new FTPClient();
