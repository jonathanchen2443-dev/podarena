import React, { useRef, useState } from "react";
import { Camera, User, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

/**
 * AvatarUpload — shows avatar, clicking opens file picker.
 * Props: profile, onSaved(newUrl)
 */
export default function AvatarUpload({ profile, onSaved }) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(profile?.avatar_url || null);
  const inputRef = useRef(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image too large (max 5 MB).");
      return;
    }

    // Immediate local preview
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    setUploading(true);

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.Profile.update(profile.id, { avatar_url: file_url });
      setPreview(file_url);
      onSaved?.(file_url);
      toast.success("Avatar updated!");
    } catch (err) {
      // Revert preview on error
      setPreview(profile?.avatar_url || null);
      toast.error("Failed to upload avatar. Please try again.");
    } finally {
      setUploading(false);
      // reset input so the same file can be re-selected
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="relative w-20 h-20 flex-shrink-0">
      {/* Avatar circle */}
      <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-violet-500/30 bg-violet-500/10 flex items-center justify-center">
        {preview ? (
          <img src={preview} alt="Avatar" className="w-full h-full object-cover" />
        ) : (
          <User className="w-9 h-9 text-violet-400" />
        )}
      </div>

      {/* Upload overlay button */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="absolute inset-0 rounded-full flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity disabled:opacity-60"
        title="Change avatar"
      >
        {uploading
          ? <Loader2 className="w-5 h-5 text-white animate-spin" />
          : <Camera className="w-5 h-5 text-white" />
        }
      </button>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}