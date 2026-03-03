// assets/js/cloudinary.js
export async function uploadImageToCloudinary(file) {
  const CLOUD_NAME = "dxqes4e20";
  const UPLOAD_PRESET = "reports_unsigned";

  const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", UPLOAD_PRESET);

  const res = await fetch(url, { method: "POST", body: fd });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error("Cloudinary upload failed: " + txt);
  }

  const data = await res.json();
  return data.secure_url;
}