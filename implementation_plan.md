# Restore Initial Day 1 Photo Upload Flow

Remove the Google Drive-like background queue upload system (including the floating status panel) and restore the original photo upload flow where images are uploaded sequentially when clicking "Save Gallery".

## Proposed Changes

### [Admin Interface & Layout]

#### [MODIFY] [AdminLayout.tsx](file:///d:/code/DIVA%20SHOTS/Diva%20Gallary%252520selection/src/components/AdminLayout.tsx)
- Remove the `<UploadManager />` component import and render statement at the bottom of the layout.

---

### [Galleries Dashboard]

#### [MODIFY] [Galleries.tsx](file:///d:/code/DIVA%20SHOTS/Diva%20Gallary%252520selection/src/pages/admin/Galleries.tsx)
- Remove Zustand-based queue variables: `uploadQueue`, `cancelUpload`, `clearActiveUploads`, `addFilesToUploadQueue`.
- Import `uploadAndAddGallery` from `useStore`.
- Introduce local component states:
  - `localPhotos` (`Photo[]`): To hold selected images with local object URLs for previews.
  - `localFilesMap` (`Map<string, File>`): To map temporary photo IDs to actual File objects.
- Update file selection handlers (`handleFileChange`, `handleDrop`):
  - Generate a unique ID for each file.
  - Create a local object URL (`URL.createObjectURL(file)`) to display previews.
  - Add to `localPhotos` and `localFilesMap`.
- Update the previews strip to display `localPhotos` and allow removing files from local state (revoking object URLs).
- Update the form `handleSubmit`:
  - Construct the `Gallery` payload using the local photos.
  - Call `uploadAndAddGallery(gallery, localFilesMap)`.
  - Close the modal upon successful upload.
- Add a loading overlay blocker inside the form when `syncing` is true so the user is informed that the photos are being uploaded and saved sequentially.

---

## Verification Plan

### Automated Tests
- Run `npm run build` to ensure the project compiles cleanly.
- Run `npm run lint` (`oxlint`) to ensure zero errors and warnings.

### Manual Verification
- Verify that selecting files no longer triggers background uploads or displays the bottom-right popover.
- Verify that files are successfully uploaded sequentially when the gallery is saved.
