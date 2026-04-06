// config/ftpClient.js
import ftp from "basic-ftp";
import dotenv from "dotenv";
dotenv.config();

class FTPClient {
  constructor() {
    this.client = new ftp.Client();
    this.client.ftp.verbose = true; // optional, logs FTP commands
  }

  async upload(localPath, remotePath) {
    try {
      await this.client.access({
        host: process.env.FTP_HOST,
        user: process.env.FTP_USER,
        password: process.env.FTP_PASSWORD,
        secure: false, // change to true if your server supports FTPS
      });

      // Ensure remote directory exists
      const remoteDir = remotePath.substring(0, remotePath.lastIndexOf("/"));
      await this.client.ensureDir(remoteDir);

      // Upload file
      await this.client.uploadFrom(localPath, remotePath);
      console.log(`File uploaded successfully to ${remotePath}`);
      return true;
    } catch (err) {
      console.error("FTP upload error:", err);
      return false;
    } finally {
      this.client.close();
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
