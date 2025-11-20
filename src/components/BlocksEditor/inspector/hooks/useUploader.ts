// inspector/hooks/useUploader.ts
export function useUploader(onUpload?: (f: File) => Promise<string>) {
  const pick = (inputRef: React.RefObject<HTMLInputElement>) =>
    inputRef.current?.click();
  const handle = async (file: File) => {
    if (!file) return "";
    if (onUpload) return onUpload(file);
    // fallback preview data URL
    const data = await new Promise<string>((res, rej) => {
      const fr = new FileReader();
      fr.onerror = rej;
      fr.onload = () => res(String(fr.result || ""));
      fr.readAsDataURL(file);
    });
    return data;
  };
  return { pick, handle };
}
