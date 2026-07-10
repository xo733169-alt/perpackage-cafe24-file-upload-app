export type ReuploadRequestActivityInput = {
  status: string;
  expires_at: string;
  used_at: string | null;
  new_file_id: string | null;
};

export function isActiveReuploadRequest(
  request: ReuploadRequestActivityInput,
  now = Date.now()
) {
  const expiresAt = new Date(request.expires_at).getTime();

  return request.status === "requested"
    && !request.used_at
    && !request.new_file_id
    && Number.isFinite(expiresAt)
    && expiresAt > now;
}
