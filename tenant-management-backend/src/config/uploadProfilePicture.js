// helpers/fileUploadHelper.js
import { uploadSingleFile } from "../modules/tenant/uploads/upload.service.js";

/**
 * Process document uploads from multipart form
 * ✅ Now includes 'type' field required by Mongoose schema
 */
export default async function uploadProfilePicture(files) {
  if (!files) return null;

  const fieldMap = {
    profilePicture: "profile_pictures",
  };

  if (files.profilePicture) {
    try {
      const uploaded = await uploadSingleFile(files.profilePicture, {
        folder: fieldMap.profilePicture,
      });

      // ✅ Schema expects documents[].files[].url (not documents[].url)
      return uploaded;
    } catch (error) {
      console.error("Profile picture upload failed:", error);
      throw new Error("Failed to upload profile picture");
    }
  }
  return null;
}

export { uploadProfilePicture };
