import { JobFilesList } from "../JobFilesList.jsx";

export function ResourcesTab({ jobId }) {
  return (
    <JobFilesList
      jobId={jobId}
      fileType="reference"
      emptyMessage="No reference files have been provided by CS or the client for this job yet."
    />
  );
}
