// src/lib/bunnyStreamUpload.js
// Helper to upload a File directly to Bunny Stream using TUS from the browser.
// Requires: npm i tus-js-client

import api from "../api";
import * as tus from "tus-js-client";

/**
 * Create Bunny video + presigned headers
 * @param {{title: string, expiresInSec?: number}} params
 * @returns {Promise<{ok:boolean, videoId:string, libraryId:number, signature:string, expires:number, tusEndpoint:string, embedUrl:string}>}
 */
export async function createBunnyPresign(params) {
  const r = await api.post("/bunny/stream/presign", params || {});
  if (!r?.data?.ok)
    throw new Error(r?.data?.message || "Failed to presign Bunny upload");
  return r.data;
}

/**
 * Upload a File to Bunny via TUS using the presigned headers.
 * @param {{file: File, title: string, onProgress?:(pct:number)=>void}} args
 * @returns {Promise<{videoId:string, embedUrl:string}>}
 */
export async function uploadVideoToBunny({ file, title, onProgress }) {
  if (!file) throw new Error("No file provided");

  // 1) Get presign
  const { videoId, libraryId, signature, expires, tusEndpoint, embedUrl } =
    await createBunnyPresign({ title });

  // 2) Start tus upload
  await new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: tusEndpoint,
      retryDelays: [0, 3000, 5000, 10000, 20000, 60000],
      headers: {
        AuthorizationSignature: signature,
        AuthorizationExpire: expires,
        VideoId: videoId,
        LibraryId: libraryId,
      },
      metadata: {
        filetype: file.type || "application/octet-stream",
        title: title || file.name,
      },
      onError: (error) => reject(error),
      onProgress: (bytesUploaded, bytesTotal) => {
        const pct = bytesTotal
          ? Math.round((bytesUploaded / bytesTotal) * 100)
          : 0;
        if (onProgress) onProgress(pct);
      },
      onSuccess: () => resolve(),
    });

    upload.findPreviousUploads().then((previousUploads) => {
      if (previousUploads.length)
        upload.resumeFromPreviousUpload(previousUploads[0]);
      upload.start();
    });
  });

  return { videoId, embedUrl };
}

/**
 * Convenience: upload and then update your local /videos/:id record.
 * Saves { video_url, bunny_video_id } so we can do gated playback later.
 * If your backend ignores unknown fields, it's still safe.
 * @param {{videoIdLocal:string|number, file:File, title:string, onProgress?:(pct:number)=>void}} args
 */
export async function uploadAndSaveToVideoRecord({
  videoIdLocal,
  file,
  title,
  onProgress,
}) {
  const { videoId, embedUrl } = await uploadVideoToBunny({
    file,
    title,
    onProgress,
  });
  await api.put(`/videos/${videoIdLocal}`, {
    video_url: embedUrl,
    bunny_video_id: videoId, // <-- new
  });
  return { videoId, embedUrl };
}
