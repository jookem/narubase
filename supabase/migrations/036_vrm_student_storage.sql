-- Allow students to upload and manage their own VRM avatar in the situation-assets bucket
CREATE POLICY "Students upload own VRM"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'situation-assets'
    AND (storage.foldername(name))[1] = 'students'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

CREATE POLICY "Students update own VRM"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'situation-assets'
    AND (storage.foldername(name))[1] = 'students'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );
